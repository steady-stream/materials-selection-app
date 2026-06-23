import csv
import re
from collections import defaultdict
from pathlib import Path

BASE = Path("g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel")
DERIVED_ROWS = BASE / "derived_workbook_candidate_rows.csv"
BASELINE_ROWS = BASE / "workbook_product_candidate_rows_filtered.csv"

OUT_HIGH = BASE / "derived_rows_high_confidence_new_vs_baseline.csv"
OUT_SUMMARY = BASE / "derived_rows_high_confidence_summary.csv"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
BAD_MODEL_TOKENS = {
    "HTTPS",
    "HTTP",
    "FALSE",
    "ALLOWANCE",
    "PERMIT",
    "LOUS",
    "SHOWER",
    "TRIM",
    "EST",
    "ADD-ON",
    "ADDON",
}
BAD_NAME_TOKENS = {
    "total",
    "deposit",
    "contract",
    "allowance",
    "install",
    "labor",
    "invoice",
}


def clean_model(s: str) -> str:
    s = (s or "").strip().upper()
    s = re.sub(r"^(MODEL\s*#?:?|SKU\s*:?|PART\s*#?:?)\s*", "", s)
    s = s.replace("\u00a0", " ").strip()
    return s


def model_high_confidence(model: str) -> bool:
    if not model:
        return False
    if model in BAD_MODEL_TOKENS:
        return False
    if DATE_RE.match(model):
        return False
    if "HTTP" in model:
        return False
    if len(model) > 40:
        return False
    # High-confidence: model should include at least one letter and one digit.
    if not re.search(r"[A-Z]", model):
        return False
    if not re.search(r"\d", model):
        return False
    return True


def is_noisy_name(name: str, desc: str) -> bool:
    text = f"{(name or '').strip().lower()} {(desc or '').strip().lower()}"
    return any(tok in text for tok in BAD_NAME_TOKENS)


def load_baseline_keys_and_models():
    keys = set()
    models = set()
    for r in csv.DictReader(BASELINE_ROWS.open(encoding="utf-8")):
        n = (r.get("name") or "").strip().lower()
        m = clean_model(r.get("modelNumber") or "")
        if n or m:
            keys.add((n, m))
        if m:
            models.add(m)
    return keys, models


def main():
    baseline_keys, baseline_models = load_baseline_keys_and_models()

    rows = list(csv.DictReader(DERIVED_ROWS.open(encoding="utf-8")))
    high = []
    per_workbook = defaultdict(lambda: {"high_conf_rows": 0, "high_conf_new_rows": 0, "high_conf_new_models": set()})

    for r in rows:
        model = clean_model(r.get("modelNumber") or "")
        name = (r.get("name") or "").strip()
        desc = (r.get("description") or "").strip()

        if not model_high_confidence(model):
            continue
        if is_noisy_name(name, desc):
            continue

        nkey = name.lower()
        key = (nkey, model)

        wb = r.get("workbook") or ""
        per_workbook[wb]["high_conf_rows"] += 1

        if key not in baseline_keys:
            rr = dict(r)
            rr["modelNumber"] = model
            rr["is_high_confidence"] = "1"
            rr["is_new_vs_baseline"] = "1"
            high.append(rr)
            per_workbook[wb]["high_conf_new_rows"] += 1
            if model not in baseline_models:
                per_workbook[wb]["high_conf_new_models"].add(model)

    fields = [
        "workbook",
        "sheet",
        "row",
        "name",
        "modelNumber",
        "manufacturer",
        "vendor",
        "description",
        "category",
        "price",
        "url",
        "finish",
        "color",
        "collection",
        "is_noise",
        "is_high_confidence",
        "is_new_vs_baseline",
    ]
    with OUT_HIGH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(high)

    summary_rows = []
    for wb, vals in per_workbook.items():
        summary_rows.append(
            {
                "workbook": wb,
                "high_conf_rows": vals["high_conf_rows"],
                "high_conf_new_rows": vals["high_conf_new_rows"],
                "high_conf_new_models": len(vals["high_conf_new_models"]),
            }
        )

    summary_rows.sort(key=lambda x: (x["high_conf_new_models"], x["high_conf_new_rows"]), reverse=True)

    with OUT_SUMMARY.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["workbook", "high_conf_rows", "high_conf_new_rows", "high_conf_new_models"])
        w.writeheader()
        w.writerows(summary_rows)

    print(f"wrote: {OUT_HIGH}")
    print(f"wrote: {OUT_SUMMARY}")
    print(f"high_conf_new_rows={len(high)}")


if __name__ == "__main__":
    main()
