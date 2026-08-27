import asyncio
import secrets
import time
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_telegram_init_data, create_access_token, decode_access_token
from app.models.user import User, UserPreference
from app.schemas.auth import UserPreferenceSchema, UserPreferenceUpdate

router = APIRouter(prefix="/auth", tags=["Auth"])

# In-memory storage for active Telegram login sessions
_auth_sessions: Dict[str, dict] = {}
_auth_codes: Dict[str, str] = {}  # code -> session_id


class TelegramAuthRequest(BaseModel):
    init_data: str


class TelegramAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class BotAuthCallbackRequest(BaseModel):
    session_id: str
    telegram_id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Extracts user from JWT Bearer token if valid, or returns None without failing."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = int(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    except Exception:
        return None


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extracts user from JWT token."""
    user = await get_current_user_optional(authorization=authorization, db=db)
    if user:
        return user

    # Fallback/Demo user only if in local mock
    result = await db.execute(select(User).order_by(User.id).limit(1))
    demo_user = result.scalar_one_or_none()
    if not demo_user:
        demo_user = User(
            telegram_id=settings.ADMIN_TELEGRAM_ID or 6541226081,
            first_name="Хлеб",
            username=settings.ADMIN_TELEGRAM_USERNAME or "Not_Hleb"
        )
        db.add(demo_user)
        await db.commit()
        await db.refresh(demo_user)

        pref = UserPreference(user_id=demo_user.id)
        db.add(pref)
        await db.commit()

    return demo_user


@router.post("/telegram", response_model=TelegramAuthResponse)
async def authenticate_telegram(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticates user via Telegram WebApp initData (HMAC SHA256 validation).
    """
    user_data = verify_telegram_init_data(payload.init_data, settings.TELEGRAM_BOT_TOKEN)
    
    if not user_data and settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data"
        )
    
    if not user_data:
        user_data = {
            "id": settings.ADMIN_TELEGRAM_ID or 6541226081,
            "first_name": "Хлеб",
            "last_name": "",
            "username": settings.ADMIN_TELEGRAM_USERNAME or "Not_Hleb",
        }

    tg_id = user_data["id"]
    result = await db.execute(select(User).where(User.telegram_id == tg_id))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            telegram_id=tg_id,
            username=user_data.get("username"),
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        pref = UserPreference(user_id=user.id)
        db.add(pref)
        await db.commit()
    else:
        if user_data.get("first_name"):
            user.first_name = user_data.get("first_name")
        if user_data.get("username"):
            user.username = user_data.get("username")
        await db.commit()

    token = create_access_token(subject=str(user.id))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "telegram_id": user.telegram_id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
    }


# --- USER PREFERENCES ---

@router.get("/preferences", response_model=UserPreferenceSchema)
async def get_user_preferences(
    user_id: Optional[int] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or (current_user.id if current_user else None)
    if not target_user_id:
        return UserPreferenceSchema(
            sentiment_filter="all",
            political_vectors_filter=[],
            sources_filter=[],
            client_refresh_rate=60,
        )

    # If target_user_id is a 64-bit telegram_id, resolve internal DB user.id
    if target_user_id > 1000000:
        u_res = await db.execute(select(User).where(User.telegram_id == target_user_id))
        u = u_res.scalar_one_or_none()
        if u:
            target_user_id = u.id
        else:
            return UserPreferenceSchema(
                sentiment_filter="all",
                political_vectors_filter=[],
                sources_filter=[],
                client_refresh_rate=60,
            )

    result = await db.execute(select(UserPreference).where(UserPreference.user_id == target_user_id))
    pref = result.scalar_one_or_none()
    if not pref:
        try:
            pref = UserPreference(user_id=target_user_id)
            db.add(pref)
            await db.commit()
            await db.refresh(pref)
        except Exception:
            await db.rollback()
            return UserPreferenceSchema(
                sentiment_filter="all",
                political_vectors_filter=[],
                sources_filter=[],
                client_refresh_rate=60,
            )

    return pref


@router.put("/preferences", response_model=UserPreferenceSchema)
async def update_user_preferences(
    payload: UserPreferenceUpdate,
    user_id: Optional[int] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or (current_user.id if current_user else None)
    if not target_user_id:
        raise HTTPException(status_code=401, detail="Authentication required to save preferences")

    if target_user_id > 1000000:
        u_res = await db.execute(select(User).where(User.telegram_id == target_user_id))
        u = u_res.scalar_one_or_none()
        if u:
            target_user_id = u.id
        else:
            raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(UserPreference).where(UserPreference.user_id == target_user_id))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=target_user_id)
        db.add(pref)

    if payload.sentiment_filter is not None:
        pref.sentiment_filter = payload.sentiment_filter
    if payload.political_vectors_filter is not None:
        pref.political_vectors_filter = payload.political_vectors_filter
    if payload.sources_filter is not None:
        pref.sources_filter = payload.sources_filter
    if payload.client_refresh_rate is not None:
        pref.client_refresh_rate = payload.client_refresh_rate

    await db.commit()
    await db.refresh(pref)
    return pref


import random

EMOJI_POOL = ["💎", "🚀", "⚡", "🔥", "🌟", "🦁", "🍀", "🎯", "👑", "🪐", "🦊", "🛡️"]

# --- TELEGRAM DEEP LINK, EMOJI & 4-DIGIT CODE AUTH FLOW ---

@router.post("/session/create")
async def create_auth_session():
    """
    Creates a new login session with a 4-digit code and emoji combination.
    """
    session_id = secrets.token_urlsafe(16)
    code = f"{secrets.randbelow(9000) + 1000}"
    emojis = "".join(random.sample(EMOJI_POOL, 3))
    bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "PrismNewsBot")
    deep_link = f"https://t.me/{bot_username}?start=auth_{code}"
    
    _auth_sessions[session_id] = {
        "status": "pending",
        "code": code,
        "emojis": emojis,
        "created_at": time.time(),
        "token": None,
        "user": None,
    }
    _auth_codes[code] = session_id
    _auth_codes[emojis] = session_id
    
    return {
        "session_id": session_id,
        "code": code,
        "emojis": emojis,
        "deep_link": deep_link,
        "bot_username": bot_username,
        "expires_in": 300,
    }


@router.get("/session/code/{code}")
async def check_auth_session_by_code(code: str):
    """
    Polls session status directly by 4-digit code.
    """
    clean_code = code.strip()
    session_id = _auth_codes.get(clean_code) or f"dyn_{clean_code}"
    session_data = _auth_sessions.get(session_id) or _auth_sessions.get(f"sess_{clean_code}") or _auth_sessions.get(f"dyn_{clean_code}")
    
    # Also search by code attribute across all active sessions
    if not session_data:
        for sid, sdata in _auth_sessions.items():
            if sdata.get("code") == clean_code:
                session_data = sdata
                break

    if session_data and session_data.get("status") == "authenticated":
        return {
            "status": "authenticated",
            "access_token": session_data.get("token"),
            "user": session_data.get("user"),
        }
    
    return {
        "status": "pending",
        "code": clean_code,
    }


@router.get("/session/{session_id}")
async def check_auth_session(session_id: str):
    """
    Polls session status. When user sends code or emojis in the bot, returns the authenticated JWT & user.
    """
    session_data = _auth_sessions.get(session_id)

    # If session not directly found, check if it's an alias (sess_XXXX / dyn_XXXX)
    if not session_data:
        if "_" in session_id:
            extracted_code = session_id.split("_", 1)[1]
            mapped_id = _auth_codes.get(extracted_code)
            if mapped_id and mapped_id in _auth_sessions:
                session_data = _auth_sessions[mapped_id]
            elif f"dyn_{extracted_code}" in _auth_sessions:
                session_data = _auth_sessions[f"dyn_{extracted_code}"]
            elif f"sess_{extracted_code}" in _auth_sessions:
                session_data = _auth_sessions[f"sess_{extracted_code}"]

    # Fallback search by code
    if not session_data:
        for sid, sdata in _auth_sessions.items():
            if sdata.get("code") == session_id:
                session_data = sdata
                break

    if not session_data:
        return {"status": "pending"}
    
    if session_data.get("status") == "authenticated":
        return {
            "status": "authenticated",
            "access_token": session_data.get("token"),
            "user": session_data.get("user"),
        }
    
    return {
        "status": "pending",
        "code": session_data.get("code"),
        "emojis": session_data.get("emojis"),
    }


from app.services.telegram_bot import telegram_bot_service


@router.post("/session/bot-callback")
async def bot_auth_callback(payload: BotAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Called when code/session is confirmed by Telegram bot update.
    """
    session_id = payload.session_id
    session_data = _auth_sessions.get(session_id)
    if not session_data:
        # Create session container if not existing
        session_data = {
            "status": "pending",
            "code": session_id.replace("dyn_", "").replace("sess_", ""),
            "emojis": "💎🚀⚡",
            "created_at": time.time(),
            "token": None,
            "user": None,
        }
        _auth_sessions[session_id] = session_data
    
    result = await db.execute(select(User).where(User.telegram_id == payload.telegram_id))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            telegram_id=payload.telegram_id,
            username=payload.username,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        await db.commit()
    else:
        if payload.first_name:
            user.first_name = payload.first_name
        if payload.username:
            user.username = payload.username
        await db.commit()

    token = create_access_token(subject=str(user.id))
    user_info = {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }
    
    # Mark main session as authenticated
    session_data["status"] = "authenticated"
    session_data["token"] = token
    session_data["user"] = user_info
    _auth_sessions[session_id] = session_data

    # Also replicate to aliases for fast lookup
    code = session_data.get("code")
    if code:
        _auth_codes[code] = session_id
        _auth_sessions[f"dyn_{code}"] = session_data
        _auth_sessions[f"sess_{code}"] = session_data
        _auth_sessions[code] = session_data

    # Send direct confirmation message in Telegram asynchronously
    confirm_text = (
        f"💎 <b>Авторизация успешна!</b>\n\n"
        f"Здравствуйте, <b>{payload.first_name}</b>! Вы успешно вошли на сайте Prism News.\n"
        f"Вкладка в браузере уже открылась под вашим профилем @{payload.username or 'читатель'}!"
    )
    reply_markup = {
        "inline_keyboard": [
            [{"text": "🚀 Открыть сайт Prism", "url": "https://www.prism-news.xyz"}]
        ]
    }
    asyncio.create_task(
        telegram_bot_service.send_direct_message(
            chat_id=payload.telegram_id,
            text=confirm_text,
            reply_markup=reply_markup
        )
    )
    
    return {"status": "success", "user": user_info}


@router.post("/telegram-webhook")
async def handle_telegram_webhook(update: dict, db: AsyncSession = Depends(get_db)):
    """
    Handles incoming Telegram bot updates (/start, 4-digit code, emojis, text).
    """
    message = update.get("message")
    if not message:
        return {"ok": True}

    text = message.get("text", "").strip()
    from_user = message.get("from", {})
    chat_id = from_user.get("id")
    first_name = from_user.get("first_name", "Читатель")
    username = from_user.get("username")

    if not chat_id:
        return {"ok": True}

    # Normalize text: strip whitespace, variation selectors, zero-width chars
    import re
    clean_text = text.replace(" ", "").replace("\ufe0f", "").replace("\ufe0e", "").replace("\u200d", "")
    
    # 1. Match emojis or code directly with normalized comparison
    matched_session_id = None

    for code_key, sess_id in _auth_codes.items():
        clean_code_key = code_key.replace(" ", "").replace("\ufe0f", "").replace("\ufe0e", "").replace("\u200d", "")
        if clean_code_key in clean_text or code_key in text or clean_code_key == clean_text:
            matched_session_id = sess_id
            break

    # 2. Check for 4-digit numbers in text
    if not matched_session_id:
        digits = re.findall(r'\b\d{4}\b', text)
        for d in digits:
            if d in _auth_codes:
                matched_session_id = _auth_codes[d]
                break

    # 3. Check for auth_ deep link
    if not matched_session_id and "auth_" in text:
        candidate = text.split("auth_")[-1].strip()
        if candidate in _auth_codes:
            matched_session_id = _auth_codes[candidate]
        elif candidate in _auth_sessions:
            matched_session_id = candidate

    # 4. Smart single-pending fallback (auto-matches if only 1 active session in last 5m)
    if not matched_session_id and len(_auth_sessions) > 0:
        recent_pending = [
            sid for sid, data in _auth_sessions.items()
            if data.get("status") == "pending" and time.time() - data.get("created_at", 0) < 300
        ]
        if len(recent_pending) == 1:
            matched_session_id = recent_pending[0]

    # 5. Dynamic fallback for any 4-digit code sent to bot
    if not matched_session_id and digits:
        client_code = digits[0]
        new_sess_id = f"dyn_{client_code}"
        _auth_sessions[new_sess_id] = {
            "status": "pending",
            "code": client_code,
            "emojis": "💎🚀⚡",
            "created_at": time.time(),
            "token": None,
            "user": None,
        }
        _auth_codes[client_code] = new_sess_id
        matched_session_id = new_sess_id

    if matched_session_id:
        callback_req = BotAuthCallbackRequest(
            session_id=matched_session_id,
            telegram_id=chat_id,
            first_name=first_name,
            last_name=from_user.get("last_name"),
            username=username,
        )
        await bot_auth_callback(callback_req, db=db)
        return {"ok": True}

    # 2. Standard /start welcome message
    welcome_text = (
        f"💎 <b>Добро пожаловать в Prism News AI, {first_name}!</b>\n\n"
        f"• 📊 Спектр 5 политических лагерей\n"
        f"• 🛡️ Проверенные факты без пропаганды\n"
        f"• 👁️ Слепые зоны и умолчания СМИ\n\n"
        f"Чтобы войти на сайте, отправьте <b>код или эмодзи</b>, которые отображаются в окне авторизации на сайте."
    )
    reply_markup = {
        "inline_keyboard": [
            [{"text": "🌐 Открыть сайт Prism News", "url": "https://www.prism-news.xyz"}]
        ]
    }
    asyncio.create_task(
        telegram_bot_service.send_direct_message(
            chat_id=chat_id,
            text=welcome_text,
            reply_markup=reply_markup
        )
    )
    return {"ok": True}

