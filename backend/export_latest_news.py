import asyncio
import json
import os
from datetime import datetime
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.source import NewsSource, FeedType
from app.services.parser import NewsParser

REPORT_FILE_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.json"))
REPORT_FILE_MD = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.md"))


async def check_source(src: NewsSource, parser: NewsParser) -> dict:
    item_data = {
        "id": src.id,
        "name": src.name,
        "url": src.url,
        "feed_type": src.feed_type.value,
        "default_camp": src.default_camp,
        "status": "FAILED",
        "latest_title": None,
        "latest_url": None,
        "published_at": None,
        "snippet": None,
        "error": None
    }

    # Normalize URLs
    clean_url = src.url
    if "rssexport.rbc.ru/rbcnews/news/20/full.rss" in clean_url:
        clean_url = "https://rssexport.rbc.ru/rbcnews/news/30/full.rss"
    elif "forbes.ru/new-rss" in clean_url or "forbes.ru" in clean_url:
        clean_url = "https://t.me/forbesrussia"
        item_data["feed_type"] = "telegram"
    elif "kommersant.ru/RSS/news.xml" in clean_url:
        clean_url = "https://www.kommersant.ru/rss/news.xml"

    try:
        if item_data["feed_type"] == "rss":
            items = await parser.fetch_rss_feed(clean_url)
        else:
            items = await parser.fetch_telegram_channel_posts(clean_url)

        if items and len(items) > 0:
            latest = items[0]
            item_data["status"] = "SUCCESS"
            item_data["latest_title"] = latest.get("title", "").strip()
            item_data["latest_url"] = latest.get("url", "").strip()
            
            pub = latest.get("published_at")
            item_data["published_at"] = pub.isoformat() if isinstance(pub, datetime) else str(pub)
            
            clean_content = latest.get("clean_content") or latest.get("summary", "")
            item_data["snippet"] = clean_content[:300].strip() if clean_content else ""
            print(f"✅ [{src.id:02d}] {src.name:<28}: {item_data['latest_title'][:55]}...")
        else:
            item_data["error"] = "Не удалось извлечь публикации"
            print(f"⚠️ [{src.id:02d}] {src.name:<28}: Нет публикаций")

    except Exception as e:
        item_data["error"] = str(e)
        print(f"❌ [{src.id:02d}] {src.name:<28}: Ошибка {e}")

    # Slight pause to avoid Telegram SOCKS5 rate limiting
    await asyncio.sleep(0.35)
    return item_data


async def parse_and_export_all_sources():
    print("=" * 75)
    print("📡 Проверка парсинга всех источников новостей...")
    print("=" * 75)
    
    await init_db()
    parser = NewsParser(timeout=10.0)

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(NewsSource).order_by(NewsSource.id))
        sources = result.scalars().all()

        print(f"Всего источников в базе: {len(sources)}\n")

        report_data = []
        for src in sources:
            data = await check_source(src, parser)
            report_data.append(data)

        report_data.sort(key=lambda x: x["id"])
        success_count = sum(1 for x in report_data if x["status"] == "SUCCESS")

        # 1. Сохранение в JSON
        with open(REPORT_FILE_JSON, "w", encoding="utf-8") as f:
            json.dump({
                "generated_at": datetime.now().isoformat(),
                "total_sources": len(sources),
                "successful_sources": success_count,
                "sources": report_data
            }, f, ensure_ascii=False, indent=2)

        # 2. Сохранение в Markdown
        md_lines = [
            "# Сводный отчет о парсинге всех источников новостей (Prism News AI)",
            f"\n- **Дата проверки**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **Всего источников**: {len(sources)}",
            f"- **Успешно спарсено**: {success_count} из {len(sources)} ({success_count / len(sources) * 100:.1f}%)",
            "\n---\n",
            "## Последние новости по источникам и лагерям\n"
        ]

        camps = {}
        for item in report_data:
            camps.setdefault(item["default_camp"], []).append(item)

        for camp, items in camps.items():
            md_lines.append(f"\n### 📌 Политический лагерь: {camp}\n")
            for item in items:
                status_icon = "🟢" if item["status"] == "SUCCESS" else "🔴"
                md_lines.append(f"#### {status_icon} #{item['id']} {item['name']} ({item['feed_type'].upper()})")
                md_lines.append(f"- **URL**: [{item['url']}]({item['url']})")
                
                if item["status"] == "SUCCESS":
                    md_lines.append(f"- **Последняя новость**: {item['latest_title']}")
                    md_lines.append(f"- **Ссылка на публикацию**: [{item['latest_url']}]({item['latest_url']})")
                    md_lines.append(f"- **Дата публикации**: `{item['published_at']}`")
                    if item.get("snippet"):
                        clean_snippet = item['snippet'].replace('\n', ' ')
                        md_lines.append(f"- **Выжимка**: > {clean_snippet[:250]}...")
                else:
                    md_lines.append(f"- **Статус**: `{item.get('error', 'Нет данных')}`")
                md_lines.append("")

        with open(REPORT_FILE_MD, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))

        print("\n" + "=" * 75)
        print("🎉 Проверка успешно завершена!")
        print(f"Результат: {success_count} из {len(sources)} источников работают стабильно.")
        print(f"Отчет сохранен в:")
        print(f"  📄 Markdown: {REPORT_FILE_MD}")
        print(f"  📄 JSON:     {REPORT_FILE_JSON}")
        print("=" * 75)


if __name__ == "__main__":
    asyncio.run(parse_and_export_all_sources())
