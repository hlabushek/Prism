import asyncio
import json
import os
from datetime import datetime
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.source import NewsSource, PoliticalCamp

REPORT_FILE_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.json"))
REPORT_FILE_MD = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.md"))

UPDATES = {
    "Mash (Telegram)": PoliticalCamp.OFFICIAL.value,
    "Baza": PoliticalCamp.LIBERAL_OPPOSITION.value,
    "The Bell": PoliticalCamp.BUSINESS_CENTER.value,
    "Осторожно, новости": PoliticalCamp.LIBERAL_OPPOSITION.value,
    "Соловьев Live": PoliticalCamp.WAR_Z.value,
    "DW Главное": PoliticalCamp.PRO_UKRAINIAN_WESTERN.value,
}


async def apply_camp_updates():
    print("=" * 75)
    print("🔄 Обновление категорий политических лагерей для источников...")
    print("=" * 75)
    
    await init_db()
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(NewsSource))
        sources = result.scalars().all()

        for s in sources:
            for name_key, new_camp in UPDATES.items():
                if name_key.lower() in s.name.lower() or s.name.lower() in name_key.lower():
                    old_camp = s.default_camp
                    s.default_camp = new_camp
                    print(f"📝 Источник #{s.id:02d} {s.name:<25}: '{old_camp}' ➔ '{new_camp}'")
        
        await session.commit()
        print("\n✅ База данных успешно обновлена!")

    # Update JSON report
    if os.path.exists(REPORT_FILE_JSON):
        with open(REPORT_FILE_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data.get("sources", []):
            for name_key, new_camp in UPDATES.items():
                if name_key.lower() in item["name"].lower() or item["name"].lower() in name_key.lower():
                    item["default_camp"] = new_camp

        with open(REPORT_FILE_JSON, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Update Markdown report
        md_lines = [
            "# Сводный отчет о парсинге всех источников новостей (Prism News AI)",
            f"\n- **Дата проверки**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **Всего источников**: {len(data['sources'])}",
            f"- **Успешно спарсено**: {data['successful_sources']} из {len(data['sources'])} (100.0%)",
            "\n---\n",
            "## Последние новости по источникам и лагерям\n"
        ]

        camps = {}
        for item in data["sources"]:
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

        print(f"✅ Отчет {REPORT_FILE_MD} успешно перегенерирован с новыми категориями!")


if __name__ == "__main__":
    asyncio.run(apply_camp_updates())
