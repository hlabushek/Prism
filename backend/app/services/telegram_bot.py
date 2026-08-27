import asyncio
import json
import html
from typing import Optional, List
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger("prism_news.telegram")


class TelegramChannelBotService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self.emoji_id = getattr(settings, "TELEGRAM_CUSTOM_EMOJI_ID", "5222200612938099305")
        self.proxy = settings.PROXY_URL if settings.PROXY_URL else None

    def _get_client(self, timeout: float = 12.0) -> httpx.AsyncClient:
        kwargs = {"timeout": timeout}
        if self.proxy:
            kwargs["proxy"] = self.proxy
        return httpx.AsyncClient(**kwargs)

    def _escape_html(self, text: str) -> str:
        if not text:
            return ""
        return html.escape(text, quote=False)

    def _brand_icon(self) -> str:
        if self.emoji_id:
            return f'<tg-emoji emoji-id="{self.emoji_id}">💎</tg-emoji>'
        return "💎"

    async def _download_image_bytes(self, url: str) -> Optional[bytes]:
        """Downloads image bytes from source URL with custom headers and fallback proxy."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Referer": "https://yandex.ru/"
        }
        # First attempt: via scraper client
        try:
            async with self._get_client(timeout=8.0) as client:
                resp = await client.get(url, headers=headers, follow_redirects=True)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    return resp.content
        except Exception as e:
            logger.debug(f"Client download failed for {url}: {e}")

        # Fallback attempt: direct without proxy
        try:
            async with httpx.AsyncClient(timeout=8.0) as direct_client:
                resp = await direct_client.get(url, headers=headers, follow_redirects=True)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    return resp.content
        except Exception as e:
            logger.debug(f"Direct download failed for {url}: {e}")

        return None

    async def post_story_to_channel(
        self,
        cluster_id: int,
        title: str,
        summary: str,
        verified_facts: List[str],
        sentiment: float,
        consensus_score: Optional[int] = None,
        sources_list: Optional[List[str]] = None,
        media_urls: Optional[List[str]] = None,
        channel_id: Optional[str] = None,
    ) -> Optional[int]:
        """
        Formats and publishes a high-priority story cluster to the Telegram channel
        with Custom Brand Emoji, strict HTML parse_mode, multi-photo support, and inline WebApp button.
        """
        target_channel = channel_id or getattr(settings, "TELEGRAM_CHANNEL_ID", None)
        if not self.api_url or not target_channel:
            logger.info("Telegram bot token or channel_id not configured. Skipping channel publish.")
            return None

        icon = self._brand_icon()
        safe_title = self._escape_html(title)
        safe_summary = self._escape_html(summary)

        facts_lines = []
        for fact in (verified_facts or [])[:3]:
            facts_lines.append(f"• {self._escape_html(fact)}")
        facts_text = "\n".join(facts_lines)

        sentiment_sign = "+" if sentiment > 0 else ""
        sentiment_val = f"{sentiment_sign}{sentiment:.2f}"
        consensus_text = f" | <b>Консенсус:</b> {consensus_score}%" if consensus_score else ""

        sources_text = ""
        if sources_list:
            safe_sources = ", ".join([self._escape_html(s) for s in sources_list[:5]])
            sources_text = f"\n📰 <b>Осветили СМИ:</b> <i>{safe_sources}</i>"

        channel_username = target_channel.replace("@", "") if "@" in str(target_channel) else "PrismNewsAI"
        channel_link = f"https://t.me/{channel_username}"

        caption = (
            f"{icon} <b>{safe_title}</b>\n\n"
            f"{safe_summary}\n\n"
            f"🛡️ <b>Верифицированные факты:</b>\n{facts_text}\n"
            f"{sources_text}\n\n"
            f"📊 <b>Тональность:</b> <code>{sentiment_val}</code>{consensus_text}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"{icon} <b><a href=\"{channel_link}\">Prism News AI</a></b> • <i>Многополярный анализ</i>"
        )

        if len(caption) > 1020:
            overflow = len(caption) - 1010
            short_summary = safe_summary[:-overflow] + "..."
            caption = (
                f"{icon} <b>{safe_title}</b>\n\n"
                f"{short_summary}\n\n"
                f"🛡️ <b>Верифицированные факты:</b>\n{facts_text}\n"
                f"{sources_text}\n\n"
                f"📊 <b>Тональность:</b> <code>{sentiment_val}</code>{consensus_text}\n\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"{icon} <b><a href=\"{channel_link}\">Prism News AI</a></b> • <i>Многополярный анализ</i>"
            )

        bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "PrismNewsBot")
        webapp_url = f"https://t.me/{bot_username}/app?startapp=story_{cluster_id}"
        btn = {
            "text": "Открыть в Prism AI",
            "url": webapp_url,
        }
        if self.emoji_id:
            btn["icon_custom_emoji_id"] = str(self.emoji_id)
        reply_markup = {"inline_keyboard": [[btn]]}

        images = [u for u in (media_urls or []) if u and u.startswith("http")]

        for attempt in range(1, 3):
            try:
                async with self._get_client(timeout=15.0) as client:
                    photo_sent = False
                    msg_id = None

                    # 1. Try sending photos from available candidate sources one by one
                    for img_idx, img_url in enumerate(images):
                        img_bytes = await self._download_image_bytes(img_url)
                        if img_bytes:
                            files = {"photo": (f"photo_{img_idx}.jpg", img_bytes, "image/jpeg")}
                            data = {
                                "chat_id": str(target_channel),
                                "caption": caption,
                                "parse_mode": "HTML",
                                "reply_markup": json.dumps(reply_markup),
                            }
                            resp = await client.post(f"{self.api_url}/sendPhoto", data=data, files=files)
                            if resp.status_code == 200:
                                res_json = resp.json()
                                msg_id = res_json.get("result", {}).get("message_id")
                                logger.info(f"Published cluster #{cluster_id} to Telegram with photo #{img_idx+1}. Message ID: {msg_id}")
                                photo_sent = True
                                return msg_id
                            else:
                                logger.warning(f"Telegram rejected image #{img_idx+1} ({img_url}): {resp.text}. Trying next source photo...")

                    # 2. If no photo could be downloaded or sent, fallback to text message
                    if not photo_sent:
                        resp = await client.post(
                            f"{self.api_url}/sendMessage",
                            json={
                                "chat_id": str(target_channel),
                                "text": caption,
                                "parse_mode": "HTML",
                                "reply_markup": reply_markup,
                                "disable_web_page_preview": False,
                            },
                        )
                        if resp.status_code == 200:
                            res_json = resp.json()
                            msg_id = res_json.get("result", {}).get("message_id")
                            logger.info(f"Published cluster #{cluster_id} to Telegram (text fallback). Message ID: {msg_id}")
                            return msg_id
                        else:
                            logger.error(f"Failed to post text message to Telegram: {resp.text}")
            except Exception as e:
                logger.warning(f"Error publishing story to Telegram (attempt {attempt}): {e}")
                if attempt < 2:
                    await asyncio.sleep(1.5)
        return None

    async def update_story_in_channel(
        self,
        cluster_id: int,
        message_id: int,
        title: str,
        summary: str,
        verified_facts: List[str],
        sentiment: float,
        consensus_score: Optional[int] = None,
        sources_list: Optional[List[str]] = None,
        channel_id: Optional[str] = None,
    ) -> bool:
        """
        Updates/edits an existing Telegram channel post when new facts arrive.
        """
        target_channel = channel_id or getattr(settings, "TELEGRAM_CHANNEL_ID", None)
        if not self.api_url or not target_channel or not message_id:
            return False

        icon = self._brand_icon()
        safe_title = self._escape_html(title)
        safe_summary = self._escape_html(summary)

        facts_lines = []
        for fact in (verified_facts or [])[:3]:
            facts_lines.append(f"• {self._escape_html(fact)}")
        facts_text = "\n".join(facts_lines)

        sentiment_sign = "+" if sentiment > 0 else ""
        sentiment_val = f"{sentiment_sign}{sentiment:.2f}"
        consensus_text = f" | <b>Консенсус:</b> {consensus_score}%" if consensus_score else ""

        sources_text = ""
        if sources_list:
            safe_sources = ", ".join([self._escape_html(s) for s in sources_list[:5]])
            sources_text = f"\n📰 <b>Осветили СМИ:</b> <i>{safe_sources}</i>"

        channel_username = target_channel.replace("@", "") if "@" in str(target_channel) else "PrismNewsAI"
        channel_link = f"https://t.me/{channel_username}"

        caption = (
            f"⚡ <b>[ОБНОВЛЕНО]</b> {icon} <b>{safe_title}</b>\n\n"
            f"{safe_summary}\n\n"
            f"🛡️ <b>Верифицированные факты:</b>\n{facts_text}\n"
            f"{sources_text}\n\n"
            f"📊 <b>Тональность:</b> <code>{sentiment_val}</code>{consensus_text}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"{icon} <b><a href=\"{channel_link}\">Prism News AI</a></b> • <i>Многополярный анализ</i>"
        )

        bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "PrismNewsBot")
        webapp_url = f"https://t.me/{bot_username}/app?startapp=story_{cluster_id}"
        btn = {
            "text": "Открыть в Prism AI",
            "url": webapp_url,
        }
        if self.emoji_id:
            btn["icon_custom_emoji_id"] = str(self.emoji_id)
        reply_markup = {"inline_keyboard": [[btn]]}

        try:
            async with self._get_client(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.api_url}/editMessageCaption",
                    json={
                        "chat_id": target_channel,
                        "message_id": message_id,
                        "caption": caption,
                        "parse_mode": "HTML",
                        "reply_markup": reply_markup,
                    },
                )
                if resp.status_code == 200:
                    logger.info(f"Updated Telegram post #{message_id} for cluster #{cluster_id}")
                    return True
                
                resp_text = await client.post(
                    f"{self.api_url}/editMessageText",
                    json={
                        "chat_id": target_channel,
                        "message_id": message_id,
                        "text": caption,
                        "parse_mode": "HTML",
                        "reply_markup": reply_markup,
                    },
                )
                return resp_text.status_code == 200
        except Exception as e:
            logger.error(f"Failed to update Telegram message: {e}")
            return False

    async def forward_web_comment_to_discussion(
        self,
        discussion_group_id: str,
        reply_to_message_id: int,
        author_name: str,
        comment_text: str,
    ) -> Optional[int]:
        """
        Forwards a comment written on the web into the Telegram discussion thread.
        """
        if not self.api_url or not discussion_group_id:
            return None

        safe_author = self._escape_html(author_name)
        safe_text = self._escape_html(comment_text)
        text = f"💬 <b>{safe_author}</b> <i>(с сайта Prism)</i>:\n{safe_text}"
        
        try:
            async with self._get_client(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.api_url}/sendMessage",
                    json={
                        "chat_id": discussion_group_id,
                        "reply_to_message_id": reply_to_message_id,
                        "text": text,
                        "parse_mode": "HTML",
                    },
                )
                if resp.status_code == 200:
                    return resp.json().get("result", {}).get("message_id")
        except Exception as e:
            logger.error(f"Error forwarding comment to Telegram: {e}")
        return None

    async def send_direct_message(
        self,
        chat_id: int | str,
        text: str,
        reply_markup: Optional[dict] = None
    ) -> Optional[int]:
        """Sends a direct message to a user in Telegram (e.g. auth confirmation, notifications)."""
        if not self.api_url or not chat_id:
            return None

        try:
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
            }
            if reply_markup:
                payload["reply_markup"] = reply_markup

            async with self._get_client(timeout=10.0) as client:
                resp = await client.post(f"{self.api_url}/sendMessage", json=payload)
                if resp.status_code == 200:
                    return resp.json().get("result", {}).get("message_id")
                else:
                    logger.warning(f"Telegram sendMessage failed {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Error sending direct message to {chat_id}: {e}")
        return None



telegram_bot_service = TelegramChannelBotService()


async def run_telegram_poller(db_session_factory):
    """
    Continuous Long Polling loop for Telegram Bot (works flawlessly behind proxy, bypasses RKN blocks).
    """
    if not telegram_bot_service.api_url:
        return

    logger.info("Starting Telegram Bot Long Poller (proxy-enabled)...")
    last_update_id = 0

    # Ensure webhook is removed so getUpdates works
    try:
        async with telegram_bot_service._get_client(timeout=10.0) as client:
            await client.post(f"{telegram_bot_service.api_url}/deleteWebhook")
    except Exception as e:
        logger.warning(f"deleteWebhook note: {e}")

    while True:
        try:
            async with telegram_bot_service._get_client(timeout=35.0) as client:
                params = {"timeout": 20, "limit": 50}
                if last_update_id > 0:
                    params["offset"] = last_update_id + 1

                resp = await client.get(f"{telegram_bot_service.api_url}/getUpdates", params=params)
                if resp.status_code == 200:
                    updates = resp.json().get("result", [])
                    for update in updates:
                        last_update_id = max(last_update_id, update.get("update_id", 0))
                        async with db_session_factory() as db:
                            from app.api.routes.auth import handle_telegram_webhook
                            await handle_telegram_webhook(update, db=db)
                elif resp.status_code == 409:
                    await client.post(f"{telegram_bot_service.api_url}/deleteWebhook")
                    await asyncio.sleep(2)
                else:
                    await asyncio.sleep(2)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Telegram polling tick note: {e}")
            await asyncio.sleep(2)

