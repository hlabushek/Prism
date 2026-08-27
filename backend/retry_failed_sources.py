import asyncio
import json
import os
from datetime import datetime
from app.models.source import FeedType
from app.services.parser import NewsParser

REPORT_FILE_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.json"))
REPORT_FILE_MD = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.md"))


async def retry_failed():
    if not os.path.exists(REPORT_FILE_JSON):
        print(f"Report file {REPORT_FILE_JSON} not found.")
        return

    with open(REPORT_FILE_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    sources = data.get("sources", [])
    failed_sources = [s for s in sources if s.get("status") == "FAILED"]

    print("=" * 75)
    print(f"🔄 Повторный парсинг неудачных источников (найдено: {len(failed_sources)})...")
    print("=" * 75)

    if not failed_sources:
        print("Все источники уже успешно спарсены!")
        return

    parser = NewsParser(timeout=14.0)
    recovered_count = 0

    for s in failed_sources:
        print(f"\n👉 Повторная попытка: #{s['id']} {s['name']} ({s['feed_type']}) - {s['url']}")
        
        clean_url = s["url"]
        feed_type = s["feed_type"]

        # Known endpoint fixes
        if "iz.ru" in clean_url:
            clean_url = "https://iz.ru/xml/rss/all.xml"
        elif "forbes.ru" in clean_url:
            clean_url = "https://t.me/forbesrussia"
            feed_type = "telegram"

        items = []
        for attempt in range(1, 4):
            try:
                if feed_type == "rss":
                    items = await parser.fetch_rss_feed(clean_url)
                else:
                    items = await parser.fetch_telegram_channel_posts(clean_url)

                if items and len(items) > 0:
                    break
            except Exception as e:
                print(f"   [Попытка {attempt}/3] Ошибка: {e}")
            await asyncio.sleep(0.8)

        if items and len(items) > 0:
            latest = items[0]
            s["status"] = "SUCCESS"
            s["latest_title"] = latest.get("title", "").strip()
            s["latest_url"] = latest.get("url", "").strip()
            
            pub = latest.get("published_at")
            s["published_at"] = pub.isoformat() if isinstance(pub, datetime) else str(pub)
            
            clean_content = latest.get("clean_content") or latest.get("summary", "")
            s["snippet"] = clean_content[:300].strip() if clean_content else ""
            s["error"] = None
            recovered_count += 1
            print(f"   ✅ УСПЕШНО ВОССТАНОВЛЕНО: {s['latest_title'][:65]}...")
        else:
            print(f"   ⚠️ По-прежнему не удалось получить данные")

    # Update summary counts
    success_count = sum(1 for s in sources if s.get("status") == "SUCCESS")
    data["successful_sources"] = success_count
    data["updated_at"] = datetime.now().isoformat()

    # 1. Update JSON file
    with open(REPORT_FILE_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 2. Re-generate Markdown file
    md_lines = [
        "# Сводный отчет о парсинге всех источников новостей (Prism News AI)",
        f"\n- **Дата проверки**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Всего источников**: {len(sources)}",
        f"- **Успешно спарсено**: {success_count} из {len(sources)} ({success_count / len(sources) * 100:.1f}%)",
        "\n---\n",
        "## Последние новости по источникам и лагерям\n"
    ]

    camps = {}
    for item in sources:
        camps.setdefault(item.get("default_camp", "Общие"), []).append(item)

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
    print(f"🎉 Повторная обработка завершена!")
    print(f"Восстановлено источников: {recovered_count} из {len(failed_sources)}")
    print(f"Общий итог: {success_count} из {len(sources)} работают стабильно.")
    print(f"Обновлен отчет: {REPORT_FILE_MD}")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(retry_failed())
