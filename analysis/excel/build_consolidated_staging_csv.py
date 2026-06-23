import csv
import re
from collections import defaultdict
from pathlib import Path

BASE = Path("g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel")

BASELINE = BASE / "workbook_product_candidate_rows_filtered.csv"
DERIVED = BASE / "derived_rows_high_confidence_new_vs_baseline.csv"

OUT_STAGING = BASE / "consolidated_product_staging.csv"
OUT_CONFLICTS = BASE / "consolidated_product_staging_conflicts.csv"
OUT_SUMMARY = BASE / "consolidated_product_staging_summary.csv"

MODEL_PREFIX_RE = re.compile(r"^(MODEL\s*#?:?|SKU\s*:?|PART\s*#?:?)\s*", re.IGNORECASE)
WS_RE = re.compile(r"\s+")


def s(value):
    return "" if value is None else str(value).strip()


def normalize_name(name: str) -> str:
    text = s(name).lower()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    return WS_RE.sub(" ", text).strip()


def normalize_model(model: str) -> str:
    text = s(model).upper().replace("\u00a0", " ")
    text = MODEL_PREFIX_RE.sub("", text).strip()
    text = re.sub(r"\s+", "", text)
    return text


def normalize_company(value: str) -> str:
    text = s(value).lower()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    return WS_RE.sub(" ", text).strip()


def normalize_price(value: str) -> str:
    text = s(value)
    if not text:
        return ""
    text = text.replace("$", "").replace(",", "").strip()
    try:
        return f"{float(text):.2f}"
    except Exception:
        return ""


def confidence_for_row(source: str, row: dict) -> str:
    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = normalize_company(row.get("manufacturer", ""))
    vendor = normalize_company(row.get("vendor", ""))
    name = normalize_name(row.get("name", ""))

    if source == "baseline" and model and manufacturer and name:
        return "high"
    if source == "derived" and model and name:
        return "high"
    if model and (manufacturer or vendor):
        return "medium"
    return "low"


def make_key(row: dict):
    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = normalize_company(row.get("manufacturer", ""))
    name = normalize_name(row.get("name", ""))

    if model and manufacturer:
        return ("mm", manufacturer, model)
    if model and name:
        return ("mn", name, model)
    if manufacturer and name:
        return ("mnf", manufacturer, name)
    if name:
        return ("n", name)
    return None


def to_staging_row(source: str, row: dict) -> dict:
    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = s(row.get("manufacturer", ""))
    vendor = s(row.get("vendor", ""))
    name = s(row.get("name", ""))
    description = s(row.get("description", ""))
    category = s(row.get("category", ""))
    price = normalize_price(row.get("price", ""))
    url = s(row.get("url", ""))
    image_url = s(row.get("imageUrl", ""))
    color = s(row.get("color", ""))
    finish = s(row.get("finish", ""))
    collection = s(row.get("collection", ""))

    src_workbook = ""
    src_sheet = s(row.get("sheet", ""))
    src_row = s(row.get("row", ""))
    if source == "derived":
        src_workbook = s(row.get("workbook", ""))

    confidence = confidence_for_row(source, row)

    return {
        "name": name,
        "modelNumber": model,
        "manufacturer": manufacturer,
        "vendor": vendor,
        "description": description,
        "category": category,
        "unit": "ea",
        "tier": "",
        "collection": collection,
        "color": color,
        "finish": finish,
        "price": price,
        "productUrl": url,
        "imageUrl": image_url,
        "sourceType": source,
        "sourceWorkbook": src_workbook,
        "sourceSheet": src_sheet,
        "sourceRow": src_row,
        "confidence": confidence,
    }


def merge_rows(existing: dict, incoming: dict) -> dict:
    merged = dict(existing)
    for field in [
        "name",
        "modelNumber",
        "manufacturer",
        "vendor",
        "description",
        "category",
        "collection",
        "color",
        "finish",
        "price",
        "productUrl",
        "imageUrl",
    ]:
        if not s(merged.get(field)) and s(incoming.get(field)):
            merged[field] = incoming[field]

    if merged.get("sourceType") != incoming.get("sourceType"):
        merged["sourceType"] = "merged"

    # Prefer higher confidence.
    rank = {"low": 1, "medium": 2, "high": 3}
    if rank.get(incoming.get("confidence", "low"), 1) > rank.get(merged.get("confidence", "low"), 1):
        merged["confidence"] = incoming["confidence"]

    # Keep provenance chain.
    for f in ["sourceWorkbook", "sourceSheet", "sourceRow"]:
        a = s(merged.get(f, ""))
        b = s(incoming.get(f, ""))
        if b and b not in a.split(" | "):
            merged[f] = f"{a} | {b}" if a else b

    return merged


def main():
    baseline_rows = list(csv.DictReader(BASELINE.open(encoding="utf-8")))
    derived_rows = list(csv.DictReader(DERIVED.open(encoding="utf-8")))

    staging_by_key = {}
    conflict_rows = []

    counts = defaultdict(int)

    for row in baseline_rows:
        st = to_staging_row("baseline", row)
        key = make_key(st)
        if not key:
            counts["dropped_no_key"] += 1
            continue

        if key in staging_by_key:
            before = staging_by_key[key]
            if s(before.get("name")) and s(st.get("name")) and normalize_name(before["name"]) != normalize_name(st["name"]):
                conflict_rows.append({
                    "key": str(key),
                    "field": "name",
                    "existing": before.get("name", ""),
                    "incoming": st.get("name", ""),
                    "existing_source": before.get("sourceSheet", ""),
                    "incoming_source": st.get("sourceSheet", ""),
                })
            staging_by_key[key] = merge_rows(before, st)
            counts["merged_duplicates"] += 1
        else:
            staging_by_key[key] = st
            counts["baseline_added"] += 1

    for row in derived_rows:
        st = to_staging_row("derived", row)
        key = make_key(st)
        if not key:
            counts["dropped_no_key"] += 1
            continue

        if key in staging_by_key:
            before = staging_by_key[key]
            if s(before.get("name")) and s(st.get("name")) and normalize_name(before["name"]) != normalize_name(st["name"]):
                conflict_rows.append({
                    "key": str(key),
                    "field": "name",
                    "existing": before.get("name", ""),
                    "incoming": st.get("name", ""),
                    "existing_source": before.get("sourceSheet", ""),
                    "incoming_source": f"{st.get('sourceWorkbook','')}::{st.get('sourceSheet','')}",
                })
            staging_by_key[key] = merge_rows(before, st)
            counts["merged_duplicates"] += 1
        else:
            staging_by_key[key] = st
            counts["derived_added"] += 1

    rows_out = list(staging_by_key.values())
    rows_out.sort(key=lambda r: (normalize_company(r.get("manufacturer", "")), normalize_model(r.get("modelNumber", "")), normalize_name(r.get("name", ""))))

    fieldnames = [
        "name",
        "modelNumber",
        "manufacturer",
        "vendor",
        "description",
        "category",
        "unit",
        "tier",
        "collection",
        "color",
        "finish",
        "price",
        "productUrl",
        "imageUrl",
        "sourceType",
        "sourceWorkbook",
        "sourceSheet",
        "sourceRow",
        "confidence",
    ]

    with OUT_STAGING.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    with OUT_CONFLICTS.open("w", newline="", encoding="utf-8") as f:
        if conflict_rows:
            writer = csv.DictWriter(f, fieldnames=["key", "field", "existing", "incoming", "existing_source", "incoming_source"])
            writer.writeheader()
            writer.writerows(conflict_rows)
        else:
            writer = csv.writer(f)
            writer.writerow(["key", "field", "existing", "incoming", "existing_source", "incoming_source"])

    conf_counts = defaultdict(int)
    for r in rows_out:
        conf_counts[r.get("confidence", "")] += 1

    summary_rows = [
        {"metric": "baseline_input_rows", "value": str(len(baseline_rows))},
        {"metric": "derived_input_rows", "value": str(len(derived_rows))},
        {"metric": "output_unique_rows", "value": str(len(rows_out))},
        {"metric": "baseline_added", "value": str(counts["baseline_added"])},
        {"metric": "derived_added", "value": str(counts["derived_added"])},
        {"metric": "merged_duplicates", "value": str(counts["merged_duplicates"])},
        {"metric": "dropped_no_key", "value": str(counts["dropped_no_key"])},
        {"metric": "confidence_high", "value": str(conf_counts["high"])},
        {"metric": "confidence_medium", "value": str(conf_counts["medium"])},
        {"metric": "confidence_low", "value": str(conf_counts["low"])},
        {"metric": "name_conflicts_logged", "value": str(len(conflict_rows))},
    ]

    with OUT_SUMMARY.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["metric", "value"])
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"wrote: {OUT_STAGING}")
    print(f"wrote: {OUT_CONFLICTS}")
    print(f"wrote: {OUT_SUMMARY}")
    print(f"output_rows={len(rows_out)}")


if __name__ == "__main__":
    main()
