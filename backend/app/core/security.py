import hmac
import hashlib
import json
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import logging
import jwt
from app.core.config import settings

logger = logging.getLogger(__name__)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a signed JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except Exception as e:
        logger.debug(f"JWT decode error: {e}")
        return None


def validate_telegram_init_data(init_data: str, bot_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Validates Telegram WebApp initData string using HMAC-SHA-256 according to Telegram specifications.
    Returns parsed user dict if valid, or None if validation fails.
    """
    token = bot_token or settings.TELEGRAM_BOT_TOKEN
    
    if not init_data:
        return None

    # Development fallback if token is default/mock
    if token in ("mock_bot_token", "", None) or settings.ENVIRONMENT == "development":
        try:
            parsed = dict(urllib.parse.parse_qsl(init_data))
            if "user" in parsed:
                return json.loads(parsed["user"])
            return {"id": 123456789, "first_name": "Demo", "username": "demo_user"}
        except Exception as e:
            logger.debug(f"Parsing mock initData: {e}")
            return {"id": 123456789, "first_name": "Demo", "username": "demo_user"}

    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data))
        if "hash" not in parsed_data:
            return None

        received_hash = parsed_data.pop("hash")
        
        # Sort key=value pairs alphabetically
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))

        # Secret key: HMAC-SHA256 of bot token with constant string "WebAppData"
        secret_key = hmac.new(b"WebAppData", token.encode("utf-8"), hashlib.sha256).digest()
        
        # Calculated hash
        calculated_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

        if hmac.compare_digest(calculated_hash, received_hash):
            if "user" in parsed_data:
                return json.loads(parsed_data["user"])
            return parsed_data
        else:
            logger.warning("Telegram initData validation failed: Hash mismatch")
            return None
    except Exception as e:
        logger.error(f"Error during Telegram initData validation: {e}")
        return None


# Alias for backward compatibility
verify_telegram_init_data = validate_telegram_init_data

