import csv
import re
from collections import defaultdict
from pathlib import Path

BASE = Path("g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel")
IN_CSV = BASE / "consolidated_product_staging.csv"
OUT_CSV = BASE / "consolidated_product_staging_cleaned.csv"
OUT_AUDIT = BASE / "consolidated_product_staging_cleaning_audit.csv"
OUT_SUMMARY = BASE / "consolidated_product_staging_cleaned_summary.csv"

URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
DATETIME_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?\b")
FLOAT_RE = re.compile(r"\b\d+\.\d{2,}\b")
MULTISPACE_RE = re.compile(r"\s+")
NON_ALNUM_SPACE_RE = re.compile(r"[^a-z0-9\s]+")

UNIT_PATTERNS = [
    ("sqft", re.compile(r"\b(?:sq\.?\s*ft|sqft|sq\s*ft|\d+\s*sq\s*ft|\bsf\b)\b", re.IGNORECASE)),
    ("lnft", re.compile(r"\b(?:linear\s*ft|lin\.?\s*ft|lnft|\blf\b)\b", re.IGNORECASE)),
    ("box", re.compile(r"\bbox(?:es)?\b", re.IGNORECASE)),
    ("case", re.compile(r"\bcase(?:s)?\b", re.IGNORECASE)),
    ("gal", re.compile(r"\bgal(?:lon)?(?:s)?\b", re.IGNORECASE)),
    ("ea", re.compile(r"\b(?:each|ea|pcs?|piece(?:s)?)\b", re.IGNORECASE)),
]

NOISE_TOKENS = [
    "false",
    "true",
    "0.0",
    "0.00",
    "nan",
]

GENERIC_NOISY_WORDS = {
    "false",
    "true",
    "estimate",
    "estimated",
    "allowance",
    "deposit",
    "contract",
}


def s(value):
    return "" if value is None else str(value).strip()


def normalize_text_for_compare(text: str) -> str:
    t = s(text).lower()
    t = NON_ALNUM_SPACE_RE.sub(" ", t)
    return MULTISPACE_RE.sub(" ", t).strip()


def normalize_model(model: str) -> str:
    m = s(model).upper().replace("\u00a0", " ").strip()
    m = re.sub(r"^(MODEL\s*#?:?|SKU\s*:?|PART\s*#?:?)\s*", "", m, flags=re.IGNORECASE)
    return re.sub(r"\s+", "", m)


def remove_phrase_ci(text: str, phrase: str) -> str:
    p = s(phrase)
    if not p:
        return text
    return re.sub(re.escape(p), " ", text, flags=re.IGNORECASE)


def clean_text_blob(text: str) -> str:
    t = s(text)
    t = URL_RE.sub(" ", t)
    t = DATETIME_RE.sub(" ", t)
    t = t.replace("|", " ")
    t = t.replace("***", " ")
    t = t.replace("  -", " ")
    t = t.replace("-  ", " ")
    for tok in NOISE_TOKENS:
        t = re.sub(rf"\b{re.escape(tok)}\b", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip(" ,;-")


def text_quality_score(text: str) -> int:
    """Higher score means cleaner/more product-like text."""
    t = s(text)
    if not t:
        return -999

    score = 0
    lower = t.lower()
    words = re.findall(r"[A-Za-z]+", t)
    nums = re.findall(r"\d+(?:\.\d+)?", t)

    score += min(len(words) * 2, 40)
    score -= min(len(nums), 10)

    if URL_RE.search(t):
        score -= 20
    if DATETIME_RE.search(t):
        score -= 15
    if FLOAT_RE.search(t):
        score -= 8

    for token in GENERIC_NOISY_WORDS:
        if token in lower:
            score -= 6

    # Penalize strings that are mostly numeric/punctuation.
    alpha_chars = len(re.findall(r"[A-Za-z]", t))
    digit_chars = len(re.findall(r"\d", t))
    if digit_chars > alpha_chars:
        score -= 10

    return score


def strip_extracted_values(name: str, row: dict) -> str:
    t = clean_text_blob(name)

    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = s(row.get("manufacturer", ""))
    vendor = s(row.get("vendor", ""))
    price = s(row.get("price", ""))

    # Remove model token if present as a full-ish token.
    if model:
        t = re.sub(rf"\b{re.escape(model)}\b", " ", t, flags=re.IGNORECASE)

    # Remove vendor/manufacturer phrases when present in name.
    t = remove_phrase_ci(t, manufacturer)
    t = remove_phrase_ci(t, vendor)

    # Remove exact price values if embedded in name.
    if price:
        p = price.replace("$", "").replace(",", "")
        try:
            pf = float(p)
            variants = {p, f"{pf}", f"{pf:.2f}"}
            for v in variants:
                if v:
                    t = re.sub(rf"\b{re.escape(v)}\b", " ", t)
        except Exception:
            pass

    # Remove trailing UID-like fragments.
    t = re.sub(r"\buid=\d+\b", " ", t, flags=re.IGNORECASE)

    # Remove standalone date-ish numbers left behind (YYYY-MM-DD split remnants).
    t = re.sub(r"\b\d{4}\b", " ", t)

    # Remove isolated decimal residue often left from extracted cost/timestamps.
    t = re.sub(r"\b\d+\.\d+\b", " ", t)
    t = re.sub(r"\b[01]\.0\b", " ", t)

    # Remove leftover model separators after model token removal.
    t = re.sub(r"\b-\d+\b", " ", t)
    t = re.sub(r"\b-[A-Z0-9]{1,4}\b", " ", t)

    # Collapse punctuation and whitespace.
    t = re.sub(r"\s{2,}", " ", t)
    t = t.strip(" ,;:-")

    return t


def clean_description(desc: str, row: dict, cleaned_name: str) -> str:
    t = clean_text_blob(desc)

    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = s(row.get("manufacturer", ""))
    vendor = s(row.get("vendor", ""))

    if model:
        t = re.sub(rf"\b{re.escape(model)}\b", " ", t, flags=re.IGNORECASE)
    t = remove_phrase_ci(t, manufacturer)
    t = remove_phrase_ci(t, vendor)

    # If description collapses to same as name after normalization, blank it.
    if normalize_text_for_compare(t) == normalize_text_for_compare(cleaned_name):
        t = ""

    t = re.sub(r"\s{2,}", " ", t).strip(" ,;:-")
    return t


def infer_unit(row: dict) -> str:
    blob = " ".join(
        [
            s(row.get("name", "")),
            s(row.get("description", "")),
            s(row.get("category", "")),
            s(row.get("modelNumber", "")),
        ]
    )
    for unit, pattern in UNIT_PATTERNS:
        if pattern.search(blob):
            return unit
    return ""


def dedupe_key(row: dict):
    name = normalize_text_for_compare(row.get("name", ""))
    model = normalize_model(row.get("modelNumber", ""))
    manufacturer = normalize_text_for_compare(row.get("manufacturer", ""))

    if manufacturer and model:
        return ("mm", manufacturer, model)
    if name and model:
        return ("nm", name, model)
    if name:
        return ("n", name)
    return None


def merge_rows(a: dict, b: dict) -> dict:
    out = dict(a)
    for f in [
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
    ]:
        if not s(out.get(f)) and s(b.get(f)):
            out[f] = b[f]

    # Keep strongest confidence.
    rank = {"low": 1, "medium": 2, "high": 3}
    if rank.get(s(b.get("confidence", "low")), 1) > rank.get(s(out.get("confidence", "low")), 1):
        out["confidence"] = b["confidence"]

    # Combine provenance fields.
    for f in ["sourceWorkbook", "sourceSheet", "sourceRow"]:
        av = s(out.get(f))
        bv = s(b.get(f))
        if bv and bv not in av.split(" | "):
            out[f] = f"{av} | {bv}" if av else bv

    # Prefer cleaner text candidates for name/description.
    if text_quality_score(s(b.get("name"))) > text_quality_score(s(out.get("name"))):
        out["name"] = b.get("name", out.get("name", ""))

    if text_quality_score(s(b.get("description"))) > text_quality_score(s(out.get("description"))):
        out["description"] = b.get("description", out.get("description", ""))

    return out


def main():
    rows = list(csv.DictReader(IN_CSV.open(encoding="utf-8")))

    audit = []
    cleaned_rows = []
    names_changed = 0
    desc_changed = 0
    units_changed = 0

    for idx, row in enumerate(rows, start=2):
        original_name = s(row.get("name", ""))
        original_desc = s(row.get("description", ""))
        original_unit = s(row.get("unit", ""))

        new_name = strip_extracted_values(original_name, row)
        if not new_name:
            new_name = original_name

        new_desc = clean_description(original_desc, row, new_name)

        inferred_unit = infer_unit({**row, "name": new_name, "description": new_desc})
        new_unit = original_unit or "ea"
        if inferred_unit and (new_unit.lower() in {"", "ea"}):
            new_unit = inferred_unit

        if new_name != original_name:
            names_changed += 1
        if new_desc != original_desc:
            desc_changed += 1
        if new_unit != original_unit:
            units_changed += 1

        out = dict(row)
        out["name"] = new_name
        out["description"] = new_desc
        out["unit"] = new_unit
        cleaned_rows.append(out)

        if new_name != original_name or new_desc != original_desc or new_unit != original_unit:
            audit.append(
                {
                    "csv_row": idx,
                    "before_name": original_name,
                    "after_name": new_name,
                    "before_description": original_desc,
                    "after_description": new_desc,
                    "before_unit": original_unit,
                    "after_unit": new_unit,
                    "sourceSheet": s(row.get("sourceSheet", "")),
                    "sourceRow": s(row.get("sourceRow", "")),
                }
            )

    # Re-dedupe after cleaning names.
    deduped = {}
    merged_after_clean = 0
    for row in cleaned_rows:
        key = dedupe_key(row)
        if not key:
            continue
        if key in deduped:
            deduped[key] = merge_rows(deduped[key], row)
            merged_after_clean += 1
        else:
            deduped[key] = row

    final_rows = list(deduped.values())
    final_rows.sort(
        key=lambda r: (
            normalize_text_for_compare(r.get("manufacturer", "")),
            normalize_model(r.get("modelNumber", "")),
            normalize_text_for_compare(r.get("name", "")),
        )
    )

    fields = [
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
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(final_rows)

    with OUT_AUDIT.open("w", newline="", encoding="utf-8") as f:
        if audit:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "csv_row",
                    "before_name",
                    "after_name",
                    "before_description",
                    "after_description",
                    "before_unit",
                    "after_unit",
                    "sourceSheet",
                    "sourceRow",
                ],
            )
            writer.writeheader()
            writer.writerows(audit)
        else:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "csv_row",
                    "before_name",
                    "after_name",
                    "before_description",
                    "after_description",
                    "before_unit",
                    "after_unit",
                    "sourceSheet",
                    "sourceRow",
                ]
            )

    summary = [
        {"metric": "input_rows", "value": str(len(rows))},
        {"metric": "output_rows_after_clean_dedupe", "value": str(len(final_rows))},
        {"metric": "names_changed", "value": str(names_changed)},
        {"metric": "descriptions_changed", "value": str(desc_changed)},
        {"metric": "units_changed", "value": str(units_changed)},
        {"metric": "rows_with_any_change", "value": str(len(audit))},
        {"metric": "merged_after_clean", "value": str(merged_after_clean)},
    ]
    with OUT_SUMMARY.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["metric", "value"])
        writer.writeheader()
        writer.writerows(summary)

    print(f"wrote: {OUT_CSV}")
    print(f"wrote: {OUT_AUDIT}")
    print(f"wrote: {OUT_SUMMARY}")
    print(f"input_rows={len(rows)} output_rows={len(final_rows)}")


if __name__ == "__main__":
    main()
