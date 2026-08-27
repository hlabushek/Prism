import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
import feedparser
import trafilatura
from bs4 import BeautifulSoup
from app.services.cleaner import TextCleaner
from app.core.config import settings

logger = logging.getLogger(__name__)


class NewsParser:
    def __init__(self, timeout: float = 12.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ru,en;q=0.9"
        }
        self.proxy = settings.PROXY_URL if settings.PROXY_URL else None

    async def _fetch_url_with_retry(self, url: str, use_proxy: bool = False, max_retries: int = 3) -> Optional[str]:
        """Fetches URL text with retries and specified proxy mode."""
        client_kwargs = {
            "timeout": self.timeout,
            "follow_redirects": True,
            "headers": self.headers
        }
        if use_proxy and self.proxy:
            client_kwargs["proxy"] = self.proxy

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(**client_kwargs) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        return resp.text
            except Exception as e:
                logger.debug(f"Attempt {attempt}/{max_retries} failed for {url} (proxy={use_proxy}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * attempt)
        return None

    async def fetch_rss_feed(self, feed_url: str) -> List[Dict[str, Any]]:
        """Parses an RSS or Atom feed and extracts initial article candidates with intelligent fallbacks."""
        results = []
        try:
            # 1. Fetch via SOCKS5 proxy first with direct fallback
            html_text = None
            if self.proxy:
                html_text = await self._fetch_url_with_retry(feed_url, use_proxy=True, max_retries=2)
            if not html_text:
                html_text = await self._fetch_url_with_retry(feed_url, use_proxy=False, max_retries=2)

            parsed_feed = feedparser.parse(html_text) if html_text else feedparser.parse(feed_url, agent=self.headers["User-Agent"])

            # 2. Check known fallbacks if RSS is empty or dead
            if not parsed_feed.entries:
                if "forbes.ru" in feed_url:
                    logger.info("Forbes RSS 404, falling back to official Telegram @forbesrussia")
                    return await self.fetch_telegram_channel_posts("https://t.me/forbesrussia")
                if "thebell.io" in feed_url:
                    return await self.fetch_telegram_channel_posts("https://t.me/thebell_io")
                if "iz.ru" in feed_url:
                    logger.info("Izvestia RSS blocked, falling back to official Telegram @izvestia")
                    return await self.fetch_telegram_channel_posts("https://t.me/izvestia")

            for entry in parsed_feed.entries[:30]:  # Top 30 latest entries
                title = entry.get("title", "").strip()
                link = entry.get("link", "").strip()
                if not title or not link:
                    continue

                link = TextCleaner.strip_tracking_params(link)
                
                # Extract date
                pub_date = datetime.utcnow()
                if "published_parsed" in entry and entry.published_parsed:
                    pub_date = datetime(*entry.published_parsed[:6])
                elif "updated_parsed" in entry and entry.updated_parsed:
                    pub_date = datetime(*entry.updated_parsed[:6])

                summary = entry.get("summary", "") or entry.get("description", "")
                
                # Media image extraction from enclosures/media
                media_url = None
                if "media_content" in entry and entry.media_content:
                    media_url = entry.media_content[0].get("url")
                elif "enclosures" in entry and entry.enclosures:
                    media_url = entry.enclosures[0].get("href")

                results.append({
                    "title": title,
                    "url": link,
                    "summary": summary,
                    "published_at": pub_date,
                    "media_url": media_url
                })
        except Exception as e:
            logger.error(f"Error reading RSS feed {feed_url}: {e}")
        return results

    async def extract_full_content(self, url: str, fallback_summary: str = "") -> str:
        """Fetches HTML and extracts clean body text using Trafilatura & BeautifulSoup."""
        try:
            # Try proxy first for opposition/blocked sites, then direct
            downloaded_html = None
            if self.proxy:
                downloaded_html = await self._fetch_url_with_retry(url, use_proxy=True, max_retries=2)
            if not downloaded_html:
                downloaded_html = await self._fetch_url_with_retry(url, use_proxy=False, max_retries=1)

            if downloaded_html:
                extracted = trafilatura.extract(
                    downloaded_html,
                    include_comments=False,
                    include_tables=False,
                    no_fallback=False
                )
                if extracted and len(extracted.strip()) > 80:
                    return TextCleaner.clean_html_and_ads(extracted)
        except Exception as e:
            logger.debug(f"Full content extraction failed for {url} ({e}), falling back to summary.")

        return TextCleaner.clean_html_and_ads(fallback_summary)

    async def fetch_telegram_channel_posts(self, channel_name_or_url: str) -> List[Dict[str, Any]]:
        """
        Parses public Telegram channel posts via official Telegram web preview (t.me/s/{channel})
        using SOCKS5 proxy with automatic retries.
        """
        channel = channel_name_or_url.replace("https://t.me/", "").replace("@", "").strip("/").split("/")[0]
        preview_url = f"https://t.me/s/{channel}"
        results = []

        try:
            # Telegram web preview requires proxy in regions with censorship
            html_text = await self._fetch_url_with_retry(preview_url, use_proxy=True, max_retries=3)
            if not html_text:
                html_text = await self._fetch_url_with_retry(preview_url, use_proxy=False, max_retries=2)

            if not html_text:
                logger.warning(f"Cannot access Telegram channel {preview_url}")
                return []

            soup = BeautifulSoup(html_text, "html.parser")
            messages = soup.select(".tgme_widget_message_wrap")

            for msg in messages[-25:]:  # Last 25 messages
                text_el = msg.select_one(".tgme_widget_message_text")
                if not text_el:
                    continue
                
                raw_text = text_el.get_text(separator="\n").strip()
                clean_text = TextCleaner.clean_html_and_ads(raw_text)
                if len(clean_text) < 40:
                    continue

                # Extract post URL
                link_el = msg.select_one(".tgme_widget_message_date")
                post_url = link_el.get("href", "") if link_el else f"https://t.me/{channel}"

                # Extract photo if available
                media_url = None
                photo_el = msg.select_one(".tgme_widget_message_photo_wrap")
                if photo_el and "style" in photo_el.attrs:
                    style_str = photo_el["style"]
                    if "url('" in style_str:
                        media_url = style_str.split("url('")[1].split("')")[0]
                    elif "url(" in style_str:
                        media_url = style_str.split("url(")[1].split(")")[0]

                # Title from first sentence or first 120 chars
                first_line = clean_text.split("\n")[0].strip()
                title = first_line[:120] if len(first_line) > 10 else f"Сообщение канала @{channel}"

                time_el = msg.select_one("time")
                pub_date = datetime.utcnow()
                if time_el and time_el.get("datetime"):
                    try:
                        pub_date = datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00")).replace(tzinfo=None)
                    except Exception:
                        pass

                results.append({
                    "title": title,
                    "url": post_url,
                    "clean_content": clean_text,
                    "raw_content": raw_text,
                    "published_at": pub_date,
                    "media_url": media_url
                })
        except Exception as e:
            logger.error(f"Error parsing Telegram channel @{channel}: {e}")

        return results
