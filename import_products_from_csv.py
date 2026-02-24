#!/usr/bin/env python3
"""
Product Import Script - Materials Selection App

Imports products from CSV file into DynamoDB with validation,
URL checking, and optional S3 image upload.

Usage:
    python import_products_from_csv.py product-import-template.csv [--upload-images] [--dry-run]
    
Arguments:
    csv_file        : Path to CSV file with product data
    --upload-images : Download images and upload to S3 (optional)
    --dry-run       : Validate only, don't insert into DynamoDB
    --validate-urls : Check that all URLs are reachable (slow)

CSV Format:
    manufacturerName,name,modelNumber,description,category,unit,tier,collection,imageUrl,productUrl,primaryVendor,vendorSku,vendorCost,notes
    
    Required: manufacturerName, name
    Optional: All other fields
    Vendor Association: If primaryVendor is specified, vendorCost is required
"""

import boto3
import csv
import sys
import argparse
from uuid import uuid4
from datetime import datetime
import requests
from urllib.parse import urlparse
import time

# AWS Configuration
REGION = 'us-east-1'
PRODUCTS_TABLE = 'MaterialsSelection-Products'
MANUFACTURERS_TABLE = 'MaterialsSelection-Manufacturers'
VENDORS_TABLE = 'MaterialsSelection-Vendors'
PRODUCT_VENDORS_TABLE = 'MaterialsSelection-ProductVendors'
S3_BUCKET = 'materials-selection-app-7525'  # Your app's S3 bucket
S3_IMAGES_PREFIX = 'product-images/'

# Valid values for controlled fields
VALID_TIERS = ['good', 'better', 'best', '']
VALID_UNITS = ['ea', 'sqft', 'lnft', 'box', 'gal', 'case', '']

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✓{Colors.RESET} {msg}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {msg}")

def print_error(msg):
    print(f"{Colors.RED}✗{Colors.RESET} {msg}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {msg}")

def load_manufacturers():
    """Load all manufacturers from DynamoDB and create name->id mapping"""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(MANUFACTURERS_TABLE)
    
    print_info(f"Loading manufacturers from {MANUFACTURERS_TABLE}...")
    response = table.scan()
    manufacturers = {item['name'].strip(): item['id'] for item in response['Items']}
    
    print_success(f"Loaded {len(manufacturers)} manufacturers:")
    for name in sorted(manufacturers.keys()):
        print(f"  • {name}")
    
    return manufacturers

def load_vendors():
    """Load all vendors from DynamoDB and create name->id mapping"""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(VENDORS_TABLE)
    
    print_info(f"Loading vendors from {VENDORS_TABLE}...")
    response = table.scan()
    vendors = {item['name'].strip(): item['id'] for item in response['Items']}
    
    print_success(f"Loaded {len(vendors)} vendors:")
    for name in sorted(vendors.keys()):
        print(f"  • {name}")
    
    return vendors

def validate_url(url, timeout=5):
    """Check if URL is reachable"""
    if not url or url.strip() == '':
        return True  # Empty URLs are okay
    
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code < 400
    except:
        return False

def download_image(url, timeout=10):
    """Download image from URL and return bytes"""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print_error(f"Failed to download image: {e}")
        return None

def upload_to_s3(image_data, filename):
    """Upload image to S3 and return public URL"""
    s3 = boto3.client('s3', region_name=REGION)
    key = f"{S3_IMAGES_PREFIX}{filename}"
    
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=image_data,
            ContentType='image/jpeg',
            CacheControl='max-age=31536000'
        )
        url = f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
        return url
    except Exception as e:
        print_error(f"Failed to upload to S3: {e}")
        return None

def validate_row(row, row_num, manufacturers, vendors):
    """Validate a single CSV row and return errors"""
    errors = []
    
    # Required fields
    if not row.get('manufacturerName', '').strip():
        errors.append(f"Row {row_num}: Missing manufacturerName")
    elif row['manufacturerName'].strip() not in manufacturers:
        errors.append(f"Row {row_num}: Manufacturer '{row['manufacturerName']}' not found in database")
    
    if not row.get('name', '').strip():
        errors.append(f"Row {row_num}: Missing name")
    
    # Tier validation
    tier = row.get('tier', '').strip().lower()
    if tier and tier not in VALID_TIERS:
        errors.append(f"Row {row_num}: Invalid tier '{tier}' (must be: good, better, or best)")
    
    # Unit validation (warning only)
    unit = row.get('unit', '').strip().lower()
    if unit and unit not in VALID_UNITS:
        print_warning(f"Row {row_num}: Unusual unit '{unit}' (common: ea, sqft, lnft, box, gal, case)")
    
    # Vendor validation (if provided)
    primary_vendor = row.get('primaryVendor', '').strip()
    vendor_cost = row.get('vendorCost', '').strip()
    
    if primary_vendor:
        if primary_vendor not in vendors:
            errors.append(f"Row {row_num}: Vendor '{primary_vendor}' not found in database")
        
        if not vendor_cost:
            errors.append(f"Row {row_num}: vendorCost required when primaryVendor is specified")
        else:
            try:
                float(vendor_cost)
            except ValueError:
                errors.append(f"Row {row_num}: vendorCost must be a number, got '{vendor_cost}'")
    
    return errors

def process_csv(csv_file, upload_images=False, dry_run=False, validate_urls_flag=False):
    """Main import logic"""
    
    # Load manufacturers and vendors
    manufacturers = load_manufacturers()
    vendors = load_vendors()
    
    # Read CSV
    print_info(f"\nReading CSV file: {csv_file}")
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        print_error(f"File not found: {csv_file}")
        return 1
    except Exception as e:
        print_error(f"Failed to read CSV: {e}")
        return 1
    
    print_success(f"Found {len(rows)} products to import")
    
    # Validate all rows first
    print_info("\nValidating data...")
    all_errors = []
    for i, row in enumerate(rows, start=2):  # Start at 2 (row 1 is header)
        errors = validate_row(row, i, manufacturers, vendors)
        all_errors.extend(errors)
    
    if all_errors:
        print_error(f"\nValidation failed with {len(all_errors)} errors:")
        for error in all_errors:
            print(f"  {error}")
        return 1
    
    print_success("All rows validated successfully")
    
    # Validate URLs if requested
    if validate_urls_flag:
        print_info("\nValidating URLs (this may take a while)...")
        for i, row in enumerate(rows, start=2):
            product_url = row.get('productUrl', '').strip()
            image_url = row.get('imageUrl', '').strip()
            
            if product_url and not validate_url(product_url):
                print_warning(f"Row {i}: Product URL may be invalid: {product_url}")
            
            if image_url and not validate_url(image_url):
                print_warning(f"Row {i}: Image URL may be invalid: {image_url}")
            
            time.sleep(0.5)  # Be polite to servers
    
    # Dry run - stop here
    if dry_run:
        print_success(f"\n✓ DRY RUN COMPLETE - {len(rows)} products validated, no data inserted")
        return 0
    
    # Import to DynamoDB
    print_info(f"\nImporting to {PRODUCTS_TABLE}...")
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    products_table = dynamodb.Table(PRODUCTS_TABLE)
    product_vendors_table = dynamodb.Table(PRODUCT_VENDORS_TABLE)
    
    success_count = 0
    error_count = 0
    vendor_associations_count = 0
    
    for i, row in enumerate(rows, start=2):
        manufacturer_id = manufacturers[row['manufacturerName'].strip()]
        
        # Handle image upload if requested
        image_url = row.get('imageUrl', '').strip()
        if upload_images and image_url:
            print_info(f"  Downloading image for {row['name']}...")
            image_data = download_image(image_url)
            if image_data:
                filename = f"{row.get('modelNumber', '').replace('/', '-')}.jpg"
                s3_url = upload_to_s3(image_data, filename)
                if s3_url:
                    image_url = s3_url
                    print_success(f"  Uploaded to S3: {s3_url}")
        
        # Prepare item for DynamoDB
        timestamp = datetime.utcnow().isoformat() + 'Z'
        item = {
            'id': str(uuid4()),
            'manufacturerId': manufacturer_id,
            'name': row['name'].strip(),
            'modelNumber': row.get('modelNumber', '').strip(),
            'description': row.get('description', '').strip(),
            'category': row.get('category', '').strip(),
            'unit': row.get('unit', '').strip().lower(),
            'tier': row.get('tier', '').strip().lower(),
            'collection': row.get('collection', '').strip(),
            'imageUrl': image_url,
            'productUrl': row.get('productUrl', '').strip(),
            'createdAt': timestamp,
            'updatedAt': timestamp,
        }
        
        try:
            products_table.put_item(Item=item)
            product_id = item['id']  # Save for vendor association
            print_success(f"Row {i}: {row['name']} ({row.get('modelNumber', 'N/A')})")
            success_count += 1
            
            # Create vendor association if specified
            primary_vendor = row.get('primaryVendor', '').strip()
            if primary_vendor and primary_vendor in vendors:
                vendor_id = vendors[primary_vendor]
                vendor_cost = float(row.get('vendorCost', 0))
                vendor_sku = row.get('vendorSku', '').strip()
                
                product_vendor_item = {
                    'id': str(uuid4()),
                    'productId': product_id,
                    'vendorId': vendor_id,
                    'cost': vendor_cost,
                    'sku': vendor_sku,
                    'isPrimary': True,
                    'createdAt': timestamp,
                    'updatedAt': timestamp,
                }
                
                try:
                    product_vendors_table.put_item(Item=product_vendor_item)
                    print_success(f"  → Added vendor association: {primary_vendor} @ ${vendor_cost}")
                    vendor_associations_count += 1
                except Exception as ve:
                    print_warning(f"  → Failed to create vendor association: {ve}")
            
        except Exception as e:
            print_error(f"Row {i}: Failed to insert {row['name']}: {e}")
            error_count += 1
    
    # Summary
    print(f"\n{Colors.BOLD}Import Summary:{Colors.RESET}")
    print_success(f"{success_count} products imported successfully")
    if vendor_associations_count:
        print_success(f"{vendor_associations_count} vendor associations created")
    if error_count:
        print_error(f"{error_count} products failed")
    
    return 0 if error_count == 0 else 1

def main():
    parser = argparse.ArgumentParser(
        description='Import products from CSV to DynamoDB',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('csv_file', help='Path to CSV file')
    parser.add_argument('--upload-images', action='store_true', 
                       help='Download images and upload to S3')
    parser.add_argument('--dry-run', action='store_true',
                       help='Validate only, do not insert into DynamoDB')
    parser.add_argument('--validate-urls', action='store_true',
                       help='Check that all URLs are reachable (slow)')
    
    args = parser.parse_args()
    
    print(f"{Colors.BOLD}Product Import Tool{Colors.RESET}")
    print(f"CSV File: {args.csv_file}")
    print(f"Upload Images: {args.upload_images}")
    print(f"Dry Run: {args.dry_run}")
    print(f"Validate URLs: {args.validate_urls}")
    print()
    
    try:
        exit_code = process_csv(
            args.csv_file,
            upload_images=args.upload_images,
            dry_run=args.dry_run,
            validate_urls_flag=args.validate_urls
        )
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print_warning("\n\nImport cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
