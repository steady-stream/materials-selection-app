# Product Import Guide

Complete guide for bulk importing products from CSV into the Materials Selection App.

---

## Overview

This tool allows you to:

- Manually collect product data from manufacturer websites
- Organize it in a spreadsheet
- Bulk import into DynamoDB with validation
- Optionally download and host product images in your S3 bucket

**No application changes required** - this is a data import utility only.

---

## Quick Start

### 1. Prepare Your Data

Use the provided template `product-import-template.csv` as your starting point:

```csv
manufacturerName,name,modelNumber,description,category,unit,tier,collection,imageUrl,productUrl,primaryVendor,vendorSku,vendorCost,notes
Kohler,Caxton Sink,K-2209-0,17" oval undermount sink,Plumbing,ea,better,Caxton,https://...,https://...,Ferguson,K-2209-0,245.00,White finish
```

### 2. Fill in Product Data

For each product you want to import:

1. Visit the manufacturer's product page
2. Copy relevant information into your CSV
3. Include full URLs for images and product pages

### 3. Run Import (Dry Run First)

Test your CSV without importing:

```powershell
python import_products_from_csv.py product-import-template.csv --dry-run
```

### 4. Import for Real

```powershell
python import_products_from_csv.py product-import-template.csv
```

---

## CSV Fields Reference

### Required Fields

| Field              | Description                      | Example            |
| ------------------ | -------------------------------- | ------------------ |
| `manufacturerName` | Exact name as stored in database | `Kohler`           |
| `name`             | Product name                     | `Caxton Oval Sink` |

### Optional Fields

| Field         | Description                   | Example                             | Validation           |
| ------------- | ----------------------------- | ----------------------------------- | -------------------- |
| `modelNumber` | Manufacturer's model/SKU      | `K-2209-0`                          | -                    |
| `description` | Detailed description          | `17" oval undermount bathroom sink` | -                    |
| `category`    | Product category              | `Plumbing`, `Flooring`, `Hardware`  | -                    |
| `unit`        | Unit of measure               | `ea`, `sqft`, `lnft`, `box`, `gal`  | Warns if unusual     |
| `tier`        | Quality tier                  | `good`, `better`, `best`            | Must be one of three |
| `collection`  | Product line/collection       | `Caxton`, `Corbelle`                | -                    |
| `imageUrl`    | Product image URL             | `https://kohler.scene7.com/...`     | Optional URL check   |
| `productUrl`  | Manufacturer product page     | `https://www.kohler.com/...`        | Optional URL check   |
| `notes`       | Internal notes (not imported) | `White finish only`                 | Not saved to DB      |

### Vendor Association Fields (Optional)

These fields create a ProductVendor relationship automatically:

| Field           | Description                          | Example    | Validation                                   |
| --------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `primaryVendor` | Vendor name (exact match in DB)      | `Ferguson` | Must exist in Vendors table                  |
| `vendorSku`     | Vendor's SKU (may differ from model) | `K-2209-0` | -                                            |
| `vendorCost`    | Your cost from this vendor           | `245.00`   | Required if primaryVendor specified, numeric |

**How it works:**

- If `primaryVendor` is specified, the script creates a ProductVendor record
- This links the product to the vendor with pricing information
- The vendor relationship is marked as `isPrimary: true`
- You can add additional vendors later through the web app

---

## Import Script Options

### Basic Import

Validates and imports all products:

```powershell
python import_products_from_csv.py your-products.csv
```

### Dry Run (Recommended First)

Validates CSV without importing:

```powershell
python import_products_from_csv.py your-products.csv --dry-run
```

### Validate URLs

Checks that all URLs are reachable (slow, makes HTTP requests):

```powershell
python import_products_from_csv.py your-products.csv --dry-run --validate-urls
```

### Upload Images to S3

Downloads images from URLs and uploads to your S3 bucket:

```powershell
python import_products_from_csv.py your-products.csv --upload-images
```

**Note:** This modifies the `imageUrl` to point to your S3 bucket instead of the manufacturer's site.

---

## Workflow for Collecting Data

### Manual Collection from Manufacturer Sites

1. **Visit Product Page**
   - Example: https://www.kohler.com/en/products/bathroom-sinks/shop-bathroom-sinks/caxton-17-oval-undermount-bathroom-sink-2209-2209?skuId=2209-0

2. **Collect Information**
   - Product name
   - Model number (usually in URL or product title)
   - Description
   - Copy image URL (right-click image → Copy Image Address)
   - Copy page URL

3. **Add to CSV**
   - Paste into Excel/Google Sheets
   - Or edit CSV directly in VS Code

4. **Repeat** for each product

### Tips for Efficient Collection

- **Group by manufacturer** - collect all Kohler products together
- **Use browser tabs** - open multiple product pages
- **Template formulas** - use Excel formulas to build URLs if they follow patterns
- **Manufacturer catalogs** - some provide downloadable spreadsheets to dealers
- **Product line at a time** - collect entire collections (e.g., all Corbelle products)

---

## Validation Rules

### Manufacturer Validation

The script checks that `manufacturerName` exactly matches an existing manufacturer in your database.

**Current manufacturers:**

Run this to see them:

```powershell
aws dynamodb scan --table-name MaterialsSelection-Manufacturers --query 'Items[*].name.S' --output text --region us-east-1
```

**If manufacturer doesn't exist**, add it first using the app's Manufacturer page or via API.

### Tier Validation

Must be one of:

- `good`
- `better`
- `best`
- (empty string is okay)

Case-insensitive, will be lowercased during import.

### Unit Warning

Common units:

- `ea` - each
- `sqft` - square foot
- `lnft` - linear foot
- `box` - box/carton
- `gal` - gallon
- `case` - case

Other units will generate a warning but still import.

---

## Vendor Associations

### Why Use Vendor Associations?

Products are linked to manufacturers (who makes them), but you purchase from vendors (who sells them). The same product may be available from multiple vendors at different prices.

**Example:**

- **Product:** Kohler Caxton Sink (K-2209-0)
- **Manufacturer:** Kohler
- **Vendors:** Ferguson ($245), Home Depot ($229), Amazon ($199)

### Creating Vendor Associations During Import

Include these three fields in your CSV:

```csv
manufacturerName,name,modelNumber,...,primaryVendor,vendorSku,vendorCost
Kohler,Caxton Sink,K-2209-0,...,Ferguson,K-2209-0,245.00
```

The script will:

1. Create the product
2. Create a ProductVendor record linking product → vendor
3. Store the vendor's SKU and cost
4. Mark this vendor as primary (isPrimary: true)

### Adding Multiple Vendors

The import script creates **one vendor association** per product (the primary vendor). To add additional vendors:

1. **Option A:** Import same product multiple times with different vendor names
   - First import: primaryVendor = Ferguson (isPrimary: true)
   - Second import: primaryVendor = Home Depot (isPrimary: false)
2. **Option B:** Add additional vendors through the web app
   - Go to Products page
   - Click on product
   - Add vendor associations manually

3. **Option C:** Create separate CSV imports
   - products-ferguson.csv (all Ferguson products)
   - products-homedepot.csv (all Home Depot products)

### Vendor Names Must Match Exactly

The vendor name in your CSV must **exactly match** a vendor in your database:

✅ Correct: `Ferguson`  
❌ Wrong: `ferguson` (lowercase)  
❌ Wrong: `Ferguson Supply` (extra words)

To see your current vendors:

```powershell
aws dynamodb scan --table-name MaterialsSelection-Vendors --query 'Items[*].name.S' --output table --region us-east-1
```

---

## Troubleshooting

### "Manufacturer 'XYZ' not found in database"

**Solution:** Add the manufacturer first using the web app or create via API:

```python
# Quick script to add manufacturer
import boto3
from uuid import uuid4

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('MaterialsSelection-Manufacturers')

table.put_item(Item={
    'id': str(uuid4()),
    'name': 'Your Manufacturer Name',
    'description': '',
    'website': '',
    'contactEmail': '',
    'phone': ''
})
```

### "Vendor 'XYZ' not found in database"

**Solution:** Add the vendor first using the web app or create via API:

```python
import boto3
from uuid import uuid4

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('MaterialsSelection-Vendors')

table.put_item(Item={
    'id': str(uuid4()),
    'name': 'Your Vendor Name',
    'description': '',
    'website': '',
    'contactEmail': '',
    'phone': ''
})
```

### "vendorCost required when primaryVendor is specified"

**Solution:** If you specify a `primaryVendor`, you must also include `vendorCost`. The `vendorSku` field is optional.

```csv
# ❌ Missing vendorCost
Kohler,Caxton Sink,K-2209-0,...,Ferguson,,

# ✅ Correct
Kohler,Caxton Sink,K-2209-0,...,Ferguson,,245.00

# ✅ Also correct (with vendorSku)
Kohler,Caxton Sink,K-2209-0,...,Ferguson,K-2209-0,245.00
```

1. Save As → CSV UTF-8 (Comma delimited) (\*.csv)

### Image URLs not working

**Possible causes:**

- URL requires authentication
- Image moved/deleted
- Temporary/session-based URL

**Solution:**

- Use `--validate-urls` flag to check before importing
- Or use `--upload-images` to download and host in your S3

### Import succeeds but images don't show in app

**Check:**

1. Is image URL publicly accessible? (paste in browser)
2. Is it HTTPS? (required for CloudFront site)
3. Does server allow hotlinking?

**Solution:** Use `--upload-images` to host in your S3 bucket.

---

## Advanced: S3 Image Hosting

### Why Upload to S3?

- **Reliability** - Images stay available even if manufacturer changes site
- **Performance** - Faster loading from your CDN
- **Control** - No external dependencies
- **Hotlinking** - Some sites block direct image links

### How It Works

With `--upload-images`:

1. Script downloads image from `imageUrl`
2. Uploads to `s3://materials-selection-app-7525/product-images/`
3. Replaces `imageUrl` with S3 URL in database
4. Images served via CloudFront for fast delivery

### Storage Costs

Product images are typically 50-200 KB each. At AWS S3 rates:

- 1,000 products × 100 KB = 100 MB
- Cost: ~$0.02/month storage + minimal transfer

---

## Example Workflows

### Scenario 1: Import 50 Kohler Products

```powershell
# 1. Start with template
copy product-import-template.csv kohler-products.csv

# 2. Fill in 50 products manually by visiting kohler.com

# 3. Validate
python import_products_from_csv.py kohler-products.csv --dry-run --validate-urls

# 4. Fix any errors

# 5. Import
python import_products_from_csv.py kohler-products.csv --upload-images
```

**Time estimate:** 2-3 minutes per product = ~2 hours for 50 products

### Scenario 2: Quick Import Without Images

```powershell
# Skip image URLs if you don't have time
python import_products_from_csv.py products.csv
```

You can add images later via the web app's product edit feature.

### Scenario 3: Import from Dealer Catalog

If manufacturer provides Excel catalog:

```powershell
# 1. Open their catalog in Excel
# 2. Map their columns to your template columns
# 3. Save as CSV
# 4. Import
python import_products_from_csv.py dealer-catalog.csv
```

### Scenario 4: Import with Vendor Associations

Create products with primary vendor pricing:

```powershell
# 1. Create CSV with vendor columns filled in
# Example row:
# Kohler,Caxton Sink,K-2209-0,...,Ferguson,K-2209-0,245.00

# 2. Dry run to validate vendors exist
python import_products_from_csv.py products-with-vendors.csv --dry-run

# 3. Import products and create vendor associations
python import_products_from_csv.py products-with-vendors.csv
```

**Result:**

- Products created in Products table
- ProductVendor records created automatically
- Can immediately use in project line items with vendor pricing

### Scenario 5: Same Products, Multiple Vendors

Import same products from different vendor catalogs:

```csv
# ferguson-products.csv
Kohler,Caxton Sink,K-2209-0,...,Ferguson,K-2209-0,245.00
Kohler,Corbelle Toilet,K-30810-0,...,Ferguson,K-30810-0,425.00

# homedepot-products.csv
Kohler,Caxton Sink,K-2209-0,...,Home Depot,2209-0,229.00
Kohler,Corbelle Toilet,K-30810-0,...,Home Depot,30810-0,399.00
```

```powershell
# Import Ferguson products first
python import_products_from_csv.py ferguson-products.csv

# Import Home Depot products (creates duplicates, but that's OK for now)
python import_products_from_csv.py homedepot-products.csv
```

**Note:** This creates duplicate products. Future enhancement will support update mode to add vendors to existing products instead.

---

## Next Steps After Import

1. **Verify in Web App**
   - Navigate to Products page
   - Check that all products imported
   - Verify images load correctly
   - Click on products to verify vendor associations were created

2. **Add Additional Vendor Relationships**
   - If you only imported primary vendors, add alternatives
   - Use Product detail page to add more vendors with different pricing
   - Mark best vendor as primary if needed

3. **Organize by Collection**
   - Use collection field to group related products
   - Helps with selection in project line items

4. **Update as Needed**
   - Manufacturers change products regularly
   - Re-run import with updated CSV
   - Duplicate check: same modelNumber = update existing (future enhancement)

---

## Future Enhancements

Possible improvements to this tool:

- **Duplicate detection** - Check if product exists before inserting
- **Update mode** - Update existing products instead of always inserting
- **Excel support** - Read .xlsx directly instead of requiring CSV
- **Bulk update** - Update specific fields across many products
- **Image optimization** - Resize/compress images before uploading
- **Manufacturer auto-creation** - Create manufacturers if they don't exist
- **Progress bar** - Visual feedback for large imports

Want any of these? Let me know!

---

## Support

Questions or issues? Check:

- This guide
- Script help: `python import_products_from_csv.py --help`
- Example template: `product-import-template.csv`
- Database schema: `docs/DATABASE_SCHEMA.md`
