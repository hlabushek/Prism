import httpx, asyncio
from app.core.config import settings

async def check():
    headers = {"Authorization": f"Bearer {settings.ROUTERAI_API_KEY}"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{settings.ROUTERAI_BASE_URL}/models", headers=headers)
        if r.status_code == 200:
            models = [m["id"] for m in r.json().get("data", [])]
            cheap = [m for m in models if any(k in m.lower() for k in ["flash", "mini", "glm", "qwen", "deepseek", "haiku"])]
            print("Cheap / Flash models found:", cheap[:25])
        else:
            print("Error:", r.status_code, r.text)

if __name__ == "__main__":
    asyncio.run(check())
