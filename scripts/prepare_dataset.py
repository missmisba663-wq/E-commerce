"""
Builds ShopVerse's catalogue from the Kaggle "Amazon Products Dataset 2023 (1.4M Products)".
https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products

Usage:
    python scripts/prepare_dataset.py <dir containing amazon_products.csv and amazon_categories.csv>

Download the dataset first, e.g.:
    pip install kagglehub
    python -c "import kagglehub; print(kagglehub.dataset_download('asaniczka/amazon-products-dataset-2023-1-4m-products'))"

Output (committed to the repo so the server can seed itself on any host):
    server/data/products.csv.gz   - sampled, cleaned products
    server/data/catalog.json      - departments and categories
"""
import csv
import gzip
import heapq
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "server" / "data"

# Products kept per category: the most popular ones (bought last month, then reviews).
DEFAULT_PER_CATEGORY = 450
BIG_CATEGORIES = 1200  # flagship categories get a deeper catalogue
BIG = {
    110, 116, 114, 122, 84, 91, 118, 123, 112, 120,  # fashion
    71, 75, 57, 81, 82, 79, 69, 68, 65, 63,  # electronics & computers
    270, 217, 220, 221, 223, 224, 227, 229, 230,  # toys
    170, 165, 164, 166, 201,  # home
    45, 48, 49, 47, 46,  # beauty
    198, 199, 200,  # sports
    180, 179,  # pets
    255, 261, 260, 262,  # video games
}
EXCLUDED = {125, 134, 256, 194}  # gift cards, sexual wellness, online services, thermostat checker

# (slug, name, icon, category ids)
DEPARTMENTS = [
    ("fashion", "Fashion", "shirt", [110, 112, 113, 114, 116, 118, 120, 121, 122, 123, 84, 87, 88, 89, 90, 91, 94, 95, 96, 97, 98, 265]),
    ("electronics", "Electronics", "headphones", [68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 82, 26]),
    ("computers", "Computers", "laptop", [54, 55, 56, 57, 58, 60, 63, 64, 65, 66, 81]),
    ("smart-home", "Smart Home", "house-wifi", list(range(185, 198))),
    ("video-games", "Video Games", "gamepad", [83, 241, 242, 243, 244, 245, 248, 249, 250, 251, 252, 253, 254, 255, 259, 260, 261, 262, 263]),
    ("toys-games", "Toys & Games", "puzzle", [216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 270]),
    ("home-kitchen", "Home & Kitchen", "sofa", [124, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 201]),
    ("beauty", "Beauty & Personal Care", "sparkles", [45, 46, 47, 48, 49, 50, 51, 52, 53, 126]),
    ("health", "Health & Household", "heart-pulse", [127, 128, 129, 130, 131, 132, 133, 135, 136]),
    ("baby", "Baby", "baby", [29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 264]),
    ("sports-outdoors", "Sports & Outdoors", "dumbbell", [198, 199, 200]),
    ("pets", "Pet Supplies", "paw-print", [178, 179, 180, 181, 182, 183, 184]),
    ("luggage", "Luggage & Travel", "luggage", [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109]),
    ("automotive", "Automotive", "car", [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28]),
    ("tools", "Tools & Home Improvement", "hammer", [203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215]),
    ("arts-crafts", "Arts, Crafts & Office", "palette", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 137]),
    ("industrial", "Industrial & Scientific", "flask", list(range(138, 163))),
]

IMG_RE = re.compile(r"/images/I/([A-Za-z0-9+%\-]+)\.")


def slugify(text):
    text = text.lower().replace("&", "and").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    names = {}
    with open(src / "amazon_categories.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            names[int(row["id"])] = row["category_name"]

    cat_to_dept = {}
    for slug, _name, _icon, ids in DEPARTMENTS:
        for cid in ids:
            if cid in EXCLUDED:
                continue
            assert cid not in cat_to_dept, f"category {cid} mapped twice"
            cat_to_dept[cid] = slug
    unmapped = set(names) - set(cat_to_dept) - EXCLUDED
    assert not unmapped, f"unmapped categories: {unmapped}"

    heaps = {cid: [] for cid in cat_to_dept}
    seen = 0
    with open(src / "amazon_products.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            seen += 1
            cid = int(row["category_id"])
            if cid not in heaps:
                continue
            try:
                price = float(row["price"])
                list_price = float(row["listPrice"])
                stars = float(row["stars"])
                reviews = int(row["reviews"])
                bought = int(row["boughtInLastMonth"])
            except ValueError:
                continue
            title = " ".join(row["title"].split())
            m = IMG_RE.search(row["imgUrl"])
            if price <= 0 or stars <= 0 or not m or len(title) < 8 or price > 20000:
                continue
            limit = BIG_CATEGORIES if cid in BIG else DEFAULT_PER_CATEGORY
            item = (
                bought, reviews, row["asin"],
                [row["asin"], title[:400], m.group(1), stars, reviews,
                 round(price * 100), round(list_price * 100) if list_price > price else 0,
                 cid, 1 if row["isBestSeller"] == "True" else 0, bought],
            )
            h = heaps[cid]
            if len(h) < limit:
                heapq.heappush(h, item)
            elif item[:3] > h[0][:3]:
                heapq.heapreplace(h, item)

    asins = set()
    rows = []
    for cid, h in heaps.items():
        for item in sorted(h, reverse=True):
            if item[2] in asins:
                continue
            asins.add(item[2])
            rows.append(item[3])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT_DIR / "products.csv.gz", "wt", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["asin", "title", "image", "stars", "reviews", "price_cents", "list_price_cents", "category_id", "bestseller", "bought_last_month"])
        w.writerows(rows)

    counts = {}
    for r in rows:
        counts[r[7]] = counts.get(r[7], 0) + 1
    catalog = []
    for i, (slug, name, icon, ids) in enumerate(DEPARTMENTS):
        cats = [
            {"id": cid, "slug": slugify(names[cid]), "name": names[cid]}
            for cid in ids if cid in cat_to_dept and counts.get(cid)
        ]
        catalog.append({"slug": slug, "name": name, "icon": icon, "sort": i, "categories": cats})
    (OUT_DIR / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"read {seen:,} rows -> kept {len(rows):,} products in {len(counts)} categories")


if __name__ == "__main__":
    main()
