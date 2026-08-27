import asyncio
from app.services.telegram_bot import telegram_bot_service

async def delete_dup_tg():
    success = await telegram_bot_service.delete_story_from_channel(102)
    print(f"Delete message 102 result: {success}")

if __name__ == "__main__":
    asyncio.run(delete_dup_tg())
