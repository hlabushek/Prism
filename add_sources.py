import requests

sources = [
    # Официально-лоялистская
    {"name": "Известия", "url": "https://iz.ru/xml/rss/all.xml", "feed_type": "rss", "default_camp": "Официально-лоялистская", "is_active": True},
    {"name": "Российская газета", "url": "https://rg.ru/xml/index.xml", "feed_type": "rss", "default_camp": "Официально-лоялистская", "is_active": True},
    {"name": "Соловьев Live", "url": "https://t.me/SolovievLive", "feed_type": "telegram", "default_camp": "Официально-лоялистская", "is_active": True},

    # Военкоры/Z
    {"name": "Рыбарь", "url": "https://t.me/rybar", "feed_type": "telegram", "default_camp": "Военкоры/Z", "is_active": True},
    {"name": "Readovka", "url": "https://t.me/readovkanews", "feed_type": "telegram", "default_camp": "Военкоры/Z", "is_active": True},
    {"name": "WarGonzo", "url": "https://t.me/wargonzo", "feed_type": "telegram", "default_camp": "Военкоры/Z", "is_active": True},
    {"name": "Александр Коц", "url": "https://t.me/sashakots", "feed_type": "telegram", "default_camp": "Военкоры/Z", "is_active": True},

    # Деловая/Центристская
    {"name": "Forbes Russia", "url": "https://www.forbes.ru/new-rss", "feed_type": "rss", "default_camp": "Деловая/Центристская", "is_active": True},
    {"name": "Осторожно, новости", "url": "https://t.me/ostorozhno_novosti", "feed_type": "telegram", "default_camp": "Деловая/Центристская", "is_active": True},
    {"name": "Baza", "url": "https://t.me/bazabazon", "feed_type": "telegram", "default_camp": "Деловая/Центристская", "is_active": True},
    {"name": "Интерфакс", "url": "https://www.interfax.ru/rss.asp", "feed_type": "rss", "default_camp": "Деловая/Центристская", "is_active": True},

    # Либерально-оппозиционная
    {"name": "Медиазона", "url": "https://zona.media/rss", "feed_type": "rss", "default_camp": "Либерально-оппозиционная", "is_active": True},
    {"name": "The Bell", "url": "https://t.me/thebell_io", "feed_type": "telegram", "default_camp": "Либерально-оппозиционная", "is_active": True},
    {"name": "Телеканал Дождь", "url": "https://t.me/tvrain", "feed_type": "telegram", "default_camp": "Либерально-оппозиционная", "is_active": True},
    {"name": "Холод", "url": "https://t.me/holodmedia", "feed_type": "telegram", "default_camp": "Либерально-оппозиционная", "is_active": True},

    # Проукраинская/Внешняя
    {"name": "DW Главное", "url": "https://t.me/dwrussian", "feed_type": "telegram", "default_camp": "Проукраинская/Внешняя", "is_active": True},
    {"name": "РБК-Украина", "url": "https://www.rbc.ua/static/rss/newsline.rus.rss.xml", "feed_type": "rss", "default_camp": "Проукраинская/Внешняя", "is_active": True},
    {"name": "Суспільне Новини", "url": "https://t.me/suspilnenews", "feed_type": "telegram", "default_camp": "Проукраинская/Внешняя", "is_active": True},
    {"name": "Инсайдер UA", "url": "https://t.me/insiderUKR", "feed_type": "telegram", "default_camp": "Проукраинская/Внешняя", "is_active": True}
]

BASE_URL = "https://www.prism-news.xyz/api/v1"

for source in sources:
    try:
        response = requests.post(f"{BASE_URL}/sources", json=source)
        print(f"[{response.status_code}] {source['name']}")
    except Exception as e:
        print(f"[ERR] {source['name']}: {e}")