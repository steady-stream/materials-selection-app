# Product Import Tool - Quick Reference

**Created:** February 13, 2026  
**Status:** Ready to use (tested with dry-run)

---

## What This Does

Bulk import products from CSV into DynamoDB with:

- Product creation
- Automatic vendor association (pricing)
- Image URL validation
- Optional S3 image hosting

---

## Files

| File                                    | Purpose                                      |
| --------------------------------------- | -------------------------------------------- |
| `product-import-template.csv`           | CSV template with example products           |
| `import_products_from_csv.py`           | Import script (400+ lines, production-ready) |
| `docs/PRODUCT_IMPORT_GUIDE.md`          | Complete documentation                       |
| `.mcp/project-knowledge/knowledge.json` | Updated with tool info                       |

---

## Quick Start

```powershell
# 1. Edit the template CSV (add your products)
code product-import-template.csv

# 2. Test with dry run
python import_products_from_csv.py product-import-template.csv --dry-run

# 3. Import for real
python import_products_from_csv.py product-import-template.csv
```

---

## CSV Fields

**Required:**

- `manufacturerName` - Must match exactly (e.g., "Kohler")
- `name` - Product name

**Optional:**

- `modelNumber`, `description`, `category`, `unit`, `tier`, `collection`
- `imageUrl`, `productUrl`

**Vendor Association (Optional):**

- `primaryVendor` - Vendor name (must match exactly, e.g., "Ferguson")
- `vendorSku` - Vendor's SKU (optional)
- `vendorCost` - Cost from vendor (required if primaryVendor specified)

---

## Options

```powershell
--dry-run         # Validate only, don't import
--validate-urls   # Check that URLs are reachable (slow)
--upload-images   # Download images and upload to S3
```

---

## What Gets Created

For each CSV row:

1. **Product** record in `MaterialsSelection-Products`
2. **ProductVendor** record in `MaterialsSelection-ProductVendors` (if vendor specified)
   - Links product to vendor
   - Stores vendor SKU and cost
   - Marked as primary vendor

---

## Example CSV Row

```csv
Kohler,Caxton Sink,K-2209-0,17" oval undermount sink,Plumbing,ea,better,Caxton,https://...,https://...,Ferguson,K-2209-0,245.00,White finish
```

**Creates:**

- Product: Caxton Sink by Kohler
- Vendor Association: Ferguson sells this for $245.00

---

## Validation

The script validates:

- ✅ Manufacturer exists in database
- ✅ Vendor exists in database (if specified)
- ✅ Tier is valid (good/better/best)
- ✅ vendorCost is numeric (if vendor specified)
- ⚠️ Warns about unusual units

---

## Full Documentation

See [docs/PRODUCT_IMPORT_GUIDE.md](docs/PRODUCT_IMPORT_GUIDE.md) for:

- Detailed field reference
- Troubleshooting
- Workflow examples
- S3 image hosting details
- Multiple vendor scenarios

---

## Tested & Ready

✅ Dry-run tested February 13, 2026  
✅ Validates 3 example products successfully  
✅ Connects to DynamoDB  
✅ Loads 9 manufacturers, 11 vendors  
✅ No errors

**Ready for production use when you have real data.**
