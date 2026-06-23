import csv
import collections

p = r"g:/Projects/MegaPros/MaterialsSelectionApp/WebPrototype/analysis/excel/consolidated_product_staging_aggressive.csv"
rows = list(csv.DictReader(open(p, encoding="utf-8")))

by_model = collections.Counter(
    (r["modelNumber"] or "").strip().upper()
    for r in rows
    if (r["modelNumber"] or "").strip()
)
by_model_vendor = collections.Counter(
    (
        (r["modelNumber"] or "").strip().upper(),
        (r["vendor"] or "").strip().lower(),
    )
    for r in rows
    if (r["modelNumber"] or "").strip()
)
by_name_model = collections.Counter(
    (
        (r["name"] or "").strip().lower(),
        (r["modelNumber"] or "").strip().upper(),
    )
    for r in rows
    if (r["name"] or "").strip() or (r["modelNumber"] or "").strip()
)

print("total_rows", len(rows))
print("models_with_multiple_rows", sum(1 for _k, v in by_model.items() if v > 1))
print("rows_in_repeated_models", sum(v for v in by_model.values() if v > 1))
print("model_vendor_pairs_with_multiple_rows", sum(1 for _k, v in by_model_vendor.items() if v > 1))
print("rows_in_repeated_model_vendor_pairs", sum(v for v in by_model_vendor.values() if v > 1))
print("exact_name_model_duplicates", sum(1 for _k, v in by_name_model.items() if v > 1))

print("\nTop repeated models:")
for model, count in sorted(((m, c) for m, c in by_model.items() if c > 1), key=lambda x: (-x[1], x[0]))[:25]:
    print(model, count)
