import re
import urllib.parse
from bs4 import BeautifulSoup
from typing import Tuple, Optional


class TextCleaner:
    # Common advertising, promotional and subscription patterns in Russian/English news
    AD_PATTERNS = [
        r"(?i)подписывайтесь на наш (telegram|телеграм|канал|vk|дзен)[^\.\n]*",
        r"(?i)читайте также:[^\.\n]*",
        r"(?i)читайте подробнее[^\.\n]*",
        r"(?i)источник:\s*https?://\S+",
        r"(?i)фото:\s*[^\.\n]+",
        r"(?i)реклама(\s+18\+)?(\s+erid:\s*\S+)?",
        r"(?i)все права защищены[^\.\n]*",
        r"(?i)exclusive:?[^\.\n]*",
        r"(?i)ранее мы писали[^\.\n]*",
        r"(?i)передает корреспондент[^\.\n]*",
        r"(?i)по данным источника[^\.\n]*",
        r"https?://t\.me/\S+",
        r"https?://bit\.ly/\S+",
        r"https?://\S+\b",
    ]

    @classmethod
    def clean_html_and_ads(cls, raw_html_or_text: str) -> str:
        """Removes HTML markup, tracking URLs, advertising banners, and subscription noise."""
        if not raw_html_or_text:
            return ""

        # Remove HTML tags using BeautifulSoup
        soup = BeautifulSoup(raw_html_or_text, "html.parser")
        
        # Remove script, style, and iframe tags
        for tag in soup(["script", "style", "iframe", "noscript", "aside", "nav", "footer"]):
            tag.decompose()

        text = soup.get_text(separator="\n")

        # Strip ad patterns and promo links
        for pattern in cls.AD_PATTERNS:
            text = re.sub(pattern, " ", text)

        # Normalize whitespace and line breaks
        lines = [line.strip() for line in text.split("\n") if len(line.strip()) > 15]
        cleaned = "\n".join(lines)
        
        # Clean multiple spaces
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        return cleaned.strip()

    @classmethod
    def extract_embedding_text(cls, title: str, clean_text: str) -> str:
        """
        Combines headline and first informative paragraph with doubled headline weight
        to ensure distinct entities (locations, objects, proper nouns) dominate semantic vector.
        """
        title = title.strip()
        paragraphs = [p.strip() for p in clean_text.split("\n") if len(p.strip()) > 30]
        first_para = paragraphs[0] if paragraphs else clean_text[:300]
        
        return f"{title}\n{title}\n\n{first_para}".strip()

    @classmethod
    def strip_tracking_params(cls, url: str) -> str:
        """Removes UTM, FBCLID, YCLID tracking query parameters from URLs."""
        if not url:
            return ""
        parsed = urllib.parse.urlparse(url)
        query_params = urllib.parse.parse_qsl(parsed.query)
        clean_params = [
            (k, v) for k, v in query_params
            if not k.lower().startswith(("utm_", "fbclid", "gclid", "yclid", "_ga", "from"))
        ]
        clean_query = urllib.parse.urlencode(clean_params)
        return urllib.parse.urlunparse(parsed._replace(query=clean_query))
