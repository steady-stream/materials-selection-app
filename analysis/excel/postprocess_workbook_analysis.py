import csv
import re
from pathlib import Path

BASE = Path("g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel")
INV_PATH = BASE / "workbook_tab_inventory.csv"
ROWS_PATH = BASE / "workbook_product_candidate_rows.csv"

OUT_RECS = BASE / "workbook_tab_recommendations.csv"
OUT_FILTERED = BASE / "workbook_product_candidate_rows_filtered.csv"


def rec_type(row):
    s = row["sheet"].strip().lower()
    cls = row["classification"]

    if cls == "template":
        return "exclude-template"
    if "don't use" in s or "dont use" in s:
        return "exclude-do-not-use"
    if s in {
        "products",
        "vendor",
        "manufacturer",
        "finishes",
        "frequent material model price",
        "apia items",
        "service products",
        "installation services",
    }:
        return "priority-reference-tab"
    if re.search(r"\b(\d{4,6}|thc|lnc|cjc|lnx|thpt|bath|kitchen|basement|shower|condo)\b", s):
        return "project-history-tab"
    return "review-manually"


def main():
    inv = list(csv.DictReader(INV_PATH.open(encoding="utf-8")))
    rows = list(csv.DictReader(ROWS_PATH.open(encoding="utf-8")))

    for row in inv:
        row["recommendation"] = rec_type(row)
        if row["recommendation"] == "priority-reference-tab":
            row["review_priority"] = "1"
        elif row["recommendation"] == "review-manually":
            row["review_priority"] = "2"
        else:
            row["review_priority"] = "3"

    inv_sorted = sorted(
        inv,
        key=lambda r: (
            r["review_priority"],
            -int(float(r["product_extract_signal_score"] or 0)),
        ),
    )

    with OUT_RECS.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(inv_sorted[0].keys()))
        writer.writeheader()
        writer.writerows(inv_sorted)

    exclude_patterns = [
        r"^total",
        r"^contract",
        r"^additional",
        r"^amount to finance",
        r"^deposit",
        r"^eta",
        r"^install",
        r"^something wrong",
        r"^remove ",
        r"^paint ",
        r"^in front",
    ]

    filtered = []
    for row in rows:
        s = row["sheet"].strip().lower()
        if re.search(r"\btemplate\b", s):
            continue
        if any(x in s for x in ["don't use", "dont use", "service products", "installation services"]):
            continue

        text = f"{row.get('name', '')} {row.get('description', '')}".strip().lower()
        if not text:
            continue
        if any(re.search(pattern, text) for pattern in exclude_patterns):
            continue

        has_model = bool((row.get("modelNumber") or "").strip())
        has_vendor_or_manufacturer = bool((row.get("vendor") or "").strip() or (row.get("manufacturer") or "").strip())
        has_nameish = bool((row.get("name") or "").strip() or (row.get("description") or "").strip())

        if has_nameish and (has_model or has_vendor_or_manufacturer):
            filtered.append(row)

    fields = [
        "sheet",
        "row",
        "name",
        "modelNumber",
        "manufacturer",
        "description",
        "category",
        "vendor",
        "price",
        "url",
        "imageUrl",
        "color",
        "finish",
        "collection",
        "raw_nonempty_cells",
    ]

    with OUT_FILTERED.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(filtered)

    print(f"wrote recommendations: {OUT_RECS}")
    print(f"wrote filtered rows: {OUT_FILTERED}")
    print(f"filtered_count={len(filtered)}")


if __name__ == "__main__":
    main()
