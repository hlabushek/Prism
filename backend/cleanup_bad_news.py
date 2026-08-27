import asyncio
import sys
import os
import httpx

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.core.config import settings

async def cleanup_telegram_spam():
    bot_token = settings.TELEGRAM_BOT_TOKEN
    target_channel = getattr(settings, "TELEGRAM_CHANNEL_ID", None)
    api_url = f"https://api.telegram.org/bot{bot_token}" if bot_token else None
    
    if not api_url or not target_channel:
        print("Telegram bot token or channel ID not configured.")
        return

    print("Cleaning up bad messages from Telegram channel...")
    async with httpx.AsyncClient() as client:
        # Brute force delete messages sent during the flood.
        # ID 33 was the last good message, so we delete from 34 onwards.
        for msg_id in range(34, 100):
            try:
                resp = await client.post(
                    f"{api_url}/deleteMessage",
                    json={
                        "chat_id": target_channel,
                        "message_id": msg_id
                    }
                )
                if resp.status_code == 200:
                    print(f"Deleted Telegram message ID: {msg_id}")
            except Exception as e:
                pass
    print("Telegram cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_telegram_spam())
