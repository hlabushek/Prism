import asyncio
import json
import os
from datetime import datetime
import httpx
from bs4 import BeautifulSoup

REPORT_FILE_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.json"))
REPORT_FILE_MD = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "parsed_sources_report.md"))
PROXY = "socks5://nnpA9B:8VTTJM@85.195.81.147:10108"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

TARGETS = {
    8: "milinfolive",
    9: "izvestia",
    16: "forbesrussia",
    17: "ostorozhno_novosti",
    23: "holodmedia",
    24: "dwrussian",
    26: "suspilnenews",
    27: "insiderUKR"
}


async def fetch_tg_channel(channel: str):
    url = f"https://t.me/s/{channel}"
    for attempt in range(1, 4):
        try:
            async with httpx.AsyncClient(proxy=PROXY, headers=HEADERS, timeout=12.0, follow_redirects=True) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    soup = BeautifulSoup(r.text, "html.parser")
                    msgs = soup.select(".tgme_widget_message_wrap")
                    for msg in reversed(msgs):
                        txt = msg.select_one(".tgme_widget_message_text")
                        if txt and len(txt.get_text(strip=True)) > 20:
                            clean = txt.get_text(separator=" ").strip()
                            link_el = msg.select_one(".tgme_widget_message_date")
                            post_url = link_el.get("href", "") if link_el else f"https://t.me/{channel}"
                            time_el = msg.select_one("time")
                            pub = datetime.now().isoformat()
                            if time_el and time_el.get("datetime"):
                                pub = time_el.get("datetime")
                            title = clean.split("\n")[0][:120]
                            return {
                                "title": title,
                                "url": post_url,
                                "published_at": pub,
                                "snippet": clean[:300]
                            }
        except Exception as e:
            print(f"   [Попытка {attempt}] Ошибка: {e}")
            await asyncio.sleep(0.8)
    return None


async def run_fix():
    print("=" * 75)
    print("🚀 Допарсинг оставшихся источников через SOCKS5...")
    print("=" * 75)

    with open(REPORT_FILE_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    for s in data["sources"]:
        if s["id"] in TARGETS:
            channel = TARGETS[s["id"]]
            print(f"👉 Обработка #{s['id']} {s['name']} (@{channel})...")
            res = await fetch_tg_channel(channel)
            if res:
                s["status"] = "SUCCESS"
                s["latest_title"] = res["title"]
                s["latest_url"] = res["url"]
                s["published_at"] = res["published_at"]
                s["snippet"] = res["snippet"]
                s["error"] = None
                print(f"   ✅ УСПЕШНО: {res['title'][:65]}...")
            else:
                print(f"   ❌ НЕ УДАЛОСЬ")
            await asyncio.sleep(0.5)

    success_count = sum(1 for s in data["sources"] if s["status"] == "SUCCESS")
    data["successful_sources"] = success_count
    data["updated_at"] = datetime.now().isoformat()

    # 1. Update JSON
    with open(REPORT_FILE_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 2. Update Markdown
    md_lines = [
        "# Сводный отчет о парсинге всех источников новостей (Prism News AI)",
        f"\n- **Дата обновления**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Всего источников**: {len(data['sources'])}",
        f"- **Успешно спарсено**: {success_count} из {len(data['sources'])} ({success_count / len(data['sources']) * 100:.1f}%)",
        "\n---\n",
        "## Последние новости по источникам и лагерям\n"
    ]

    camps = {}
    for item in data["sources"]:
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
    print(f"🎉 ИТОГ: {success_count} из {len(data['sources'])} источников УСПЕШНО спарсены!")
    print(f"Файл Markdown: {REPORT_FILE_MD}")
    print(f"Файл JSON:     {REPORT_FILE_JSON}")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(run_fix())
