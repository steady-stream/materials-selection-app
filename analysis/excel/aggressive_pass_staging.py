import csv
import re
from collections import defaultdict
from pathlib import Path

BASE = Path("g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel")
IN_CSV = BASE / "consolidated_product_staging_cleaned.csv"

OUT_CSV = BASE / "consolidated_product_staging_aggressive.csv"
OUT_DROPPED = BASE / "consolidated_product_staging_aggressive_dropped.csv"
OUT_SUMMARY = BASE / "consolidated_product_staging_aggressive_summary.csv"

URL_RE = re.compile(r"https?://", re.IGNORECASE)
MODEL_GOOD_RE = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Z0-9\-_/\.]{3,40}$")
DATE_LIKE_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
FLOAT_RE = re.compile(r"\b\d+\.\d+\b")
NUMERIC_ONLY_RE = re.compile(r"^\d+(?:\.\d+)?$")

DROP_NAME_PATTERNS = [
    r"\bover allowances\b",
    r"\badditional work\b",
    r"\bcontract cost\b",
    r"\bdeposit\b",
    r"\ballowance\b",
    r"\blabor\b",
    r"\binstall\b",
    r"\bplumbing fixtures\b",
    r"\bhall bathroom plumbing\b",
    r"\bmaster bathroom plumbing\b",
    r"\bmaster bath finishes\b",
    r"\bhall bath finishes\b",
]

DROP_DESC_PATTERNS = [
    r"\bamount to finance\b",
    r"\bcontract\b",
    r"\bdeposit\b",
    r"\ballowance\b",
    r"\badd on\b",
]

GENERIC_NAME_BLOCKLIST = {
    "mirror",
    "sink",
    "faucet",
    "toilet",
    "quartz",
    "chandelier",
    "range hood",
    "vanity",
    "electrical",
}


def s(v):
    return "" if v is None else str(v).strip()


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", s(text)).strip()


def normalize_name_key(text: str) -> str:
    t = s(text).lower()
    t = re.sub(r"[^a-z0-9\s]+", " ", t)
    return normalize_spaces(t)


def normalize_model(model: str) -> str:
    m = s(model).upper().replace("\u00a0", " ")
    m = re.sub(r"^(MODEL\s*#?:?|SKU\s*:?|PART\s*#?:?)\s*", "", m, flags=re.IGNORECASE)
    m = re.sub(r"\s+", "", m)
    return m


def aggressive_clean_name(name: str, model: str, vendor: str, manufacturer: str, price: str) -> str:
    t = s(name)
    if not t:
        return ""

    # Remove urls and dates.
    t = re.sub(r"https?://\S+", " ", t, flags=re.IGNORECASE)
    t = DATE_LIKE_RE.sub(" ", t)

    # Remove extracted entities already in dedicated columns.
    for token in [model, vendor, manufacturer]:
        token = s(token)
        if token:
            t = re.sub(re.escape(token), " ", t, flags=re.IGNORECASE)

    # Remove price echoes from name.
    p = s(price).replace("$", "").replace(",", "")
    if p:
        try:
            pf = float(p)
            for pv in {p, f"{pf}", f"{pf:.2f}"}:
                if pv:
                    t = re.sub(rf"\b{re.escape(pv)}\b", " ", t)
        except Exception:
            pass

    # Remove low-signal numeric residue.
    t = re.sub(r"\b[01]\.0\b", " ", t)
    t = FLOAT_RE.sub(" ", t)

    # Remove trailing hyphen fragments after model stripping.
    t = re.sub(r"\b-[A-Z0-9]{1,4}\b", " ", t)
    t = re.sub(r"\b-\d+\b", " ", t)

    # Noise tokens.
    t = re.sub(r"\b(false|true|nan)\b", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"\*+", " ", t)

    return normalize_spaces(t).strip(" ,;:-")


def infer_unit(row: dict) -> str:
    blob = " ".join([s(row.get("name")), s(row.get("description")), s(row.get("category"))])
    checks = [
        ("sqft", r"\b(?:sq\.?\s*ft|sqft|\d+\s*sq\s*ft|\bsf\b)\b"),
        ("lnft", r"\b(?:linear\s*ft|lin\.?\s*ft|lnft|\blf\b)\b"),
        ("box", r"\bbox(?:es)?\b"),
        ("case", r"\bcase(?:s)?\b"),
        ("gal", r"\bgal(?:lon)?(?:s)?\b"),
        ("ea", r"\b(?:each|ea|pcs?|piece(?:s)?)\b"),
    ]
    for unit, pattern in checks:
        if re.search(pattern, blob, flags=re.IGNORECASE):
            return unit
    return s(row.get("unit")) or "ea"


def should_drop(row: dict):
    name = s(row.get("name"))
    desc = s(row.get("description"))
    model = normalize_model(row.get("modelNumber"))
    confidence = s(row.get("confidence")).lower()
    category = s(row.get("category")).lower()
    product_url = s(row.get("productUrl"))

    # Confidence gate for aggressive pass.
    if confidence not in {"high", "medium"}:
        return True, "low-confidence"

    lname = name.lower()
    ldesc = desc.lower()

    # Obvious finance/rollup rows.
    for p in DROP_NAME_PATTERNS:
        if re.search(p, lname):
            return True, "name-finance-rollup"
    for p in DROP_DESC_PATTERNS:
        if re.search(p, ldesc):
            return True, "desc-finance-rollup"

    # Numeric-only names.
    if NUMERIC_ONLY_RE.match(name):
        return True, "name-numeric-only"

    # Ensure there is product identity signal.
    has_model = bool(model and MODEL_GOOD_RE.match(model))
    has_url = bool(product_url and URL_RE.search(product_url))
    has_name = len(name) >= 6

    if not ((has_model or has_url) and has_name):
        return True, "insufficient-identity-signal"

    # Drop overly generic names unless strong supporting data.
    if normalize_name_key(name) in GENERIC_NAME_BLOCKLIST and not (has_model and has_url):
        return True, "generic-name"

    # Drop if category is clearly non-product rollup and identity weak.
    if any(k in category for k in ["contract", "allowance", "add on", "finance"]) and not (has_model and has_url):
        return True, "non-product-category"

    # Date-like artifacts in model are suspect.
    if DATE_LIKE_RE.search(model):
        return True, "date-like-model"

    return False, ""


def row_key(row: dict):
    model = normalize_model(row.get("modelNumber"))
    manufacturer = normalize_name_key(row.get("manufacturer"))
    name = normalize_name_key(row.get("name"))

    if manufacturer and model:
        return ("mm", manufacturer, model)
    if name and model:
        return ("nm", name, model)
    if name:
        return ("n", name)
    return None


def quality_score(row: dict) -> int:
    score = 0
    name = s(row.get("name"))
    model = normalize_model(row.get("modelNumber"))
    url = s(row.get("productUrl"))
    vendor = s(row.get("vendor"))
    manufacturer = s(row.get("manufacturer"))
    desc = s(row.get("description"))

    if model and MODEL_GOOD_RE.match(model):
        score += 30
    if url and URL_RE.search(url):
        score += 20
    if vendor:
        score += 10
    if manufacturer:
        score += 10
    if desc:
        score += 6

    if len(name) < 8:
        score -= 8
    if FLOAT_RE.search(name):
        score -= 10
    if DATE_LIKE_RE.search(name):
        score -= 15
    if NUMERIC_ONLY_RE.match(name):
        score -= 25

    return score


def merge_rows(a: dict, b: dict):
    # Keep higher quality row as base.
    base, alt = (b, a) if quality_score(b) > quality_score(a) else (a, b)
    out = dict(base)

    for field in [
        "description",
        "vendor",
        "manufacturer",
        "category",
        "collection",
        "color",
        "finish",
        "price",
        "productUrl",
        "imageUrl",
    ]:
        if not s(out.get(field)) and s(alt.get(field)):
            out[field] = alt[field]

    # Combine provenance.
    for f in ["sourceWorkbook", "sourceSheet", "sourceRow"]:
        av = s(out.get(f))
        bv = s(alt.get(f))
        if bv and bv not in av.split(" | "):
            out[f] = f"{av} | {bv}" if av else bv

    # Keep stronger confidence.
    rank = {"low": 1, "medium": 2, "high": 3}
    if rank.get(s(alt.get("confidence")).lower(), 1) > rank.get(s(out.get("confidence")).lower(), 1):
        out["confidence"] = alt["confidence"]

    return out


def main():
    rows = list(csv.DictReader(IN_CSV.open(encoding="utf-8")))

    kept = []
    dropped = []

    for row in rows:
        model = normalize_model(row.get("modelNumber"))
        row["modelNumber"] = model
        row["name"] = aggressive_clean_name(
            row.get("name", ""),
            model,
            row.get("vendor", ""),
            row.get("manufacturer", ""),
            row.get("price", ""),
        )
        row["description"] = normalize_spaces(s(row.get("description", "")))
        row["unit"] = infer_unit(row)

        drop, reason = should_drop(row)
        if drop:
            d = dict(row)
            d["dropReason"] = reason
            dropped.append(d)
        else:
            kept.append(row)

    # Final dedupe with quality preference.
    deduped = {}
    merged = 0
    for row in kept:
        key = row_key(row)
        if not key:
            d = dict(row)
            d["dropReason"] = "no-dedupe-key"
            dropped.append(d)
            continue
        if key in deduped:
            deduped[key] = merge_rows(deduped[key], row)
            merged += 1
        else:
            deduped[key] = row

    final_rows = list(deduped.values())
    final_rows.sort(key=lambda r: (normalize_name_key(r.get("manufacturer", "")), normalize_model(r.get("modelNumber", "")), normalize_name_key(r.get("name", ""))))

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

    with OUT_DROPPED.open("w", newline="", encoding="utf-8") as f:
        dfields = fields + ["dropReason"]
        writer = csv.DictWriter(f, fieldnames=dfields)
        writer.writeheader()
        writer.writerows(dropped)

    drop_counts = defaultdict(int)
    for d in dropped:
        drop_counts[d.get("dropReason", "unknown")] += 1

    summary_rows = [
        {"metric": "input_rows", "value": str(len(rows))},
        {"metric": "kept_before_dedupe", "value": str(len(kept))},
        {"metric": "output_rows", "value": str(len(final_rows))},
        {"metric": "dropped_rows", "value": str(len(dropped))},
        {"metric": "merged_duplicates", "value": str(merged)},
    ]

    for k in sorted(drop_counts.keys()):
        summary_rows.append({"metric": f"dropped_{k}", "value": str(drop_counts[k])})

    with OUT_SUMMARY.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["metric", "value"])
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"wrote: {OUT_CSV}")
    print(f"wrote: {OUT_DROPPED}")
    print(f"wrote: {OUT_SUMMARY}")
    print(f"input={len(rows)} kept={len(final_rows)} dropped={len(dropped)}")


if __name__ == "__main__":
    main()
