# DynamoDB Database Schema - Materials Selection App

## Table Status Overview

### ✅ ACTIVE TABLES (Currently Used - Hyphen Format)

These tables use **hyphens** (`MaterialsSelection-TableName`) and are actively used by the application:

1. **MaterialsSelection-Projects**
2. **MaterialsSelection-Categories**
3. **MaterialsSelection-LineItems**
4. **MaterialsSelection-Vendors**
5. **MaterialsSelection-Manufacturers**
6. **MaterialsSelection-Products**
7. **MaterialsSelection-ProductVariations**
8. **MaterialsSelection-Orders**
9. **MaterialsSelection-OrderItems**
10. **MaterialsSelection-Receipts**
11. **MaterialsSelection-ProductVendors**

### ❌ OBSOLETE TABLES (Can Be Deleted - Underscore Format)

These tables use **underscores** (`MaterialsSelection_TableName`) and are **NOT used** by the application. They are likely from early development iterations.

1. ❌ **MaterialsSelection_Projects** - DUPLICATE, can delete
2. ❌ **MaterialsSelection_Categories** - DUPLICATE, can delete
3. ❌ **MaterialsSelection_LineItems** - DUPLICATE, can delete
4. ❌ **MaterialsSelection_Vendors** - DUPLICATE, can delete
5. ❌ **MaterialsSelection_Manufacturers** - DUPLICATE, can delete
6. ❌ **MaterialsSelection_Products** - DUPLICATE, can delete

**Safe to Delete:** All underscore tables can be safely deleted without affecting the application.

---

## Active Table Descriptions

### 1. MaterialsSelection-Projects

**Purpose:** Stores project information (top-level container for everything)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `name` (String) - Project name
- `description` (String) - Project description
- `startDate` (String) - ISO date string
- `endDate` (String) - ISO date string
- `status` (String) - Project status
- `budget` (Number) - Total project budget

**Relationships:**

- One project has many categories
- One project has many line items

**Example:**

```json
{
  "id": "proj-123",
  "name": "Vance Bathroom Remodel",
  "description": "Complete bathroom renovation",
  "startDate": "2025-01-15",
  "status": "active",
  "budget": 45000
}
```

---

### 2. MaterialsSelection-Categories

**Purpose:** Organizational containers within a project (e.g., "Plumbing", "Electrical", "Flooring")

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `projectId` (String) - Foreign key to Projects
- `name` (String) - Category name
- `description` (String) - Category description
- `allowance` (Number) - Budget allowance for this category

**Relationships:**

- Belongs to one project
- Has many line items

**Indexes:**

- ProjectIdIndex (GSI) - Query all categories for a project

**Example:**

```json
{
  "id": "cat-123",
  "projectId": "proj-123",
  "name": "Plumbing",
  "description": "All plumbing fixtures and materials",
  "allowance": 12000
}
```

---

### 3. MaterialsSelection-LineItems

**Purpose:** Individual items/materials to be purchased for a project (the core of the application)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `projectId` (String) - Foreign key to Projects
- `categoryId` (String) - Foreign key to Categories
- `name` (String) - Item name
- `material` (String) - Material description
- `quantity` (Number) - Quantity needed
- `unit` (String) - Unit of measure (ea, sq ft, etc.)
- `unitCost` (Number) - Cost per unit
- `totalCost` (Number) - Calculated: quantity \* unitCost
- `allowance` (Number) - Budget allowance for this line item
- `notes` (String) - Additional notes
- `status` (String) - pending | approved | ordered | received | installed
- `vendorId` (String) - Foreign key to Vendors (optional)
- `manufacturerId` (String) - Foreign key to Manufacturers (optional)
- `productId` (String) - Foreign key to Products (optional)
- `modelNumber` (String) - Product model number

**Relationships:**

- Belongs to one project
- Belongs to one category
- Optionally linked to vendor, manufacturer, product
- Has many order items (when ordered)
- Has many receipts (when received)

**Indexes:**

- CategoryIdIndex (GSI) - Query line items by category
- ProjectIdIndex (GSI) - Query line items by project

**Example:**

```json
{
  "id": "item-123",
  "projectId": "proj-123",
  "categoryId": "cat-123",
  "name": "Undermount Sink",
  "material": "Undermount Bathroom Sink - White",
  "quantity": 2,
  "unit": "ea",
  "unitCost": 245.0,
  "totalCost": 490.0,
  "allowance": 500.0,
  "status": "ordered",
  "vendorId": "vendor-123",
  "manufacturerId": "mfr-kohler",
  "productId": "prod-123",
  "modelNumber": "K-2209-0"
}
```

---

### 4. MaterialsSelection-Vendors

**Purpose:** Suppliers/vendors where materials can be purchased

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `name` (String) - Vendor name
- `contact` (String) - Contact information
- `phone` (String) - Phone number
- `email` (String) - Email address
- `website` (String) - Website URL

**Relationships:**

- Has many line items
- Has many orders
- Has many product-vendor relationships

**Example:**

```json
{
  "id": "vendor-123",
  "name": "Ferguson",
  "contact": "John Smith",
  "phone": "555-1234",
  "email": "john@ferguson.com",
  "website": "https://www.ferguson.com"
}
```

---

### 5. MaterialsSelection-Manufacturers

**Purpose:** Product manufacturers (e.g., Kohler, Moen, Delta)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `name` (String) - Manufacturer name
- `website` (String) - Website URL

**Relationships:**

- Has many products
- Referenced by line items

**Example:**

```json
{
  "id": "mfr-kohler",
  "name": "Kohler",
  "website": "https://www.kohler.com"
}
```

---

### 6. MaterialsSelection-Products

**Purpose:** Product catalog (specific items from manufacturers)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `manufacturerId` (String) - Foreign key to Manufacturers
- `name` (String) - Product name
- `modelNumber` (String) - Model/SKU number
- `modelStem` (String) - Normalized model identity stem used for duplicate detection
- `description` (String) - Product description
- `category` (String) - Product category
- `unit` (String) - Default unit of measure
- `tier` (String) - good | better | best (optional)
- `collection` (String) - Product line/collection (optional)
- `color` (String) - Optional default/base color
- `finish` (String) - Optional default/base finish
- `imageUrl` (String) - Product image URL
- `productUrl` (String) - Product page URL (optional)

**Relationships:**

- Belongs to one manufacturer
- Has many product-vendor relationships (different vendors may carry same product)
- Has many product variations
- Referenced by line items

**Indexes:**

- ManufacturerIdIndex (GSI) - Query products by manufacturer

**Example:**

```json
{
  "id": "prod-123",
  "manufacturerId": "mfr-kohler",
  "name": "Undermount Sink",
  "modelNumber": "K-2209-0",
  "modelStem": "K22090",
  "description": "Undermount Bathroom Sink - White",
  "category": "Plumbing",
  "unit": "ea",
  "tier": "better",
  "collection": "Caxton",
  "color": "White",
  "finish": null,
  "imageUrl": "",
  "productUrl": "https://www.kohler.com/..."
}
```

---

### 7. MaterialsSelection-ProductVariations

**Purpose:** Product variation records tied to a base product (color/finish/effective model)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `productId` (String) - Foreign key to Products
- `modelNumber` (String) - Optional explicit variation model number
- `effectiveModelNumber` (String) - Effective model used by selection workflows
- `color` (String) - Optional variation color
- `finish` (String) - Optional variation finish
- `imageUrl` (String) - Optional variation-specific image
- `sortOrder` (Number) - Presentation ordering
- `isDefault` (Boolean) - Default variation for product
- `createdAt` (String) - ISO timestamp
- `updatedAt` (String) - ISO timestamp

**Relationships:**

- Belongs to one product
- May be referenced by line items and line item options

**Indexes:**

- ProductIdIndex (GSI) - Query variations for a product

**Example:**

```json
{
  "id": "var-123",
  "productId": "prod-123",
  "modelNumber": "K-2209-0",
  "effectiveModelNumber": "K-2209-0",
  "color": "White",
  "finish": null,
  "imageUrl": "",
  "sortOrder": 1,
  "isDefault": true,
  "createdAt": "2026-06-01T10:00:00Z",
  "updatedAt": "2026-06-01T10:00:00Z"
}
```

---

### 8. MaterialsSelection-ProductVendors

**Purpose:** Junction table linking products to vendors with pricing (many-to-many relationship)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `productId` (String) - Foreign key to Products
- `vendorId` (String) - Foreign key to Vendors
- `cost` (Number - Decimal) - Vendor's price for this product
- `isPrimary` (Boolean) - Is this the primary/preferred vendor for this product?
- `createdAt` (String) - ISO timestamp
- `updatedAt` (String) - ISO timestamp

**Relationships:**

- Links one product to one vendor with a specific price
- One product can have multiple vendor entries (sold by multiple vendors)
- One vendor can have multiple product entries (sells multiple products)

**Indexes:**

- ProductIdIndex (GSI) - Query all vendors for a product
- VendorIdIndex (GSI) - Query all products from a vendor

**Example:**

```json
{
  "id": "pv-123",
  "productId": "prod-123",
  "vendorId": "vendor-123",
  "cost": 245.0,
  "isPrimary": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Business Logic:**

- Same product can have different costs at different vendors
- When product selected in UI, system queries this table to get vendor options and prices
- Only one vendor per product can have `isPrimary: true`

---

### 9. MaterialsSelection-Orders

**Purpose:** Purchase orders placed with vendors

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `vendorId` (String) - Foreign key to Vendors
- `orderNumber` (String) - Human-readable order number
- `orderDate` (String) - ISO date string
- `notes` (String) - Order notes
- `createdAt` (String) - ISO timestamp

**Relationships:**

- Belongs to one vendor
- Has many order items

**Indexes:**

- VendorIdIndex (GSI) - Query orders by vendor

**Example:**

```json
{
  "id": "order-123",
  "vendorId": "vendor-123",
  "orderNumber": "PO-2025-001",
  "orderDate": "2025-01-20",
  "notes": "Deliver to job site",
  "createdAt": "2025-01-20T09:00:00Z"
}
```

---

### 10. MaterialsSelection-OrderItems

**Purpose:** Individual items within an order (links orders to line items)

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `orderId` (String) - Foreign key to Orders
- `lineItemId` (String) - Foreign key to LineItems
- `orderedQuantity` (Number) - Quantity ordered
- `orderedPrice` (Number) - Price at time of order (may differ from current price)
- `createdAt` (String) - ISO timestamp

**Relationships:**

- Belongs to one order
- References one line item
- Has many receipts (for partial deliveries)

**Indexes:**

- OrderIdIndex (GSI) - Query items in an order
- LineItemIdIndex (GSI) - Query all orders for a line item

**Example:**

```json
{
  "id": "oi-123",
  "orderId": "order-123",
  "lineItemId": "item-123",
  "orderedQuantity": 2,
  "orderedPrice": 245.0,
  "createdAt": "2025-01-20T09:00:00Z"
}
```

**Business Logic:**

- One line item can appear in multiple orders (split orders, reorders)
- Tracks historical pricing (orderedPrice may differ from current LineItem.unitCost)
- Total order cost = SUM(orderedQuantity \* orderedPrice) for all order items

---

### 11. MaterialsSelection-Receipts

**Purpose:** Receiving records when ordered items arrive

**Key Attributes:**

- `id` (String) - Primary Key, UUID
- `orderItemId` (String) - Foreign key to OrderItems
- `receivedDate` (String) - ISO date string
- `receivedQuantity` (Number) - Quantity received
- `notes` (String) - Receiving notes
- `createdAt` (String) - ISO timestamp

**Relationships:**

- Belongs to one order item
- Through order item, links to line item

**Indexes:**

- OrderItemIdIndex (GSI) - Query receipts for an order item

**Example:**

```json
{
  "id": "receipt-123",
  "orderItemId": "oi-123",
  "receivedDate": "2025-01-25",
  "receivedQuantity": 2,
  "notes": "All items in good condition",
  "createdAt": "2025-01-25T14:30:00Z"
}
```

**Business Logic:**

- Multiple receipts can exist for one order item (partial deliveries)
- Updates line item status to "received" when quantities match
- Tracks receiving history for auditing

---

## Data Flow & Relationships

### Entity Relationship Diagram (Simplified)

```
Projects (1) ──── (M) Categories (1) ──── (M) LineItems (M) ──── (M) OrderItems (M) ──── (1) Orders (M) ──── (1) Vendors
                                              │                          │
                                              │                          │
                                              │                      (1) │ (M)
                                              │                          │
                                              │                      Receipts
                                              │
                                          (M) │ (1)
                                              │
                                          Products (M) ──── (M) ProductVendors (M) ──── (1) Vendors
                                              │
                      (M) │ (1)
                                              │
                                        Manufacturers
                        │
                      (1) │ (M)
                        │
                    ProductVariations
```

### Key Relationships Explained

**Project → Category → LineItem**

- Hierarchical structure for organizing materials
- Project has categories, categories have line items

**LineItem → Product → ProductVendor → Vendor**

- Line item optionally references a product from the catalog
- Product can be sold by multiple vendors at different prices
- ProductVendors junction table holds vendor-specific pricing

**Product → ProductVariation**

- Products can define color/finish/model variants
- Variation identity is managed per product
- Project selection and options can reference specific variation IDs

**LineItem → OrderItem → Order → Vendor**

- Order workflow: Create order → Add line items to order → Place order with vendor
- OrderItem links line items to specific orders
- Tracks historical pricing and quantities

**OrderItem → Receipt**

- Receiving workflow: Order arrives → Create receipt records
- Supports partial deliveries (multiple receipts per order item)

---

## Typical Data Flow Example

### Scenario: Adding a bathroom sink to a project

1. **Create Line Item**

   ```
   Project: "Vance Bathroom Remodel"
   Category: "Plumbing"
   LineItem: "Undermount Sink"
     → Select Product: "K-2209-0" (Kohler)
     → Auto-populate manufacturer: Kohler
     → System queries ProductVendors for K-2209-0
     → Shows Ferguson ($245), Home Depot ($230)
     → Select Ferguson (primary vendor)
     → Line item created with all references
   ```

2. **Create Order**

   ```
   Vendor: Ferguson
   Order: PO-2025-001
   OrderItem: Links to "Undermount Sink" line item
     → orderedQuantity: 2
     → orderedPrice: $245 (locked in at time of order)
   ```

3. **Receive Items**
   ```
   OrderItem: "Undermount Sink" from PO-2025-001
   Receipt:
     → receivedDate: 2025-01-25
     → receivedQuantity: 2
     → Line item status updated to "received"
   ```

---

## DynamoDB Access Patterns

### Common Query Patterns

1. **Get all categories for a project**
   - Use: CategoryIdIndex GSI
   - Query: `projectId = ?`

2. **Get all line items for a category**
   - Use: CategoryIdIndex GSI
   - Query: `categoryId = ?`

3. **Get all products from a manufacturer**
   - Use: ManufacturerIdIndex GSI
   - Query: `manufacturerId = ?`

4. **Get all vendors for a product (with pricing)**
   - Use: ProductIdIndex GSI on ProductVendors
   - Query: `productId = ?`

5. **Get all variations for a product**

- Use: ProductIdIndex GSI on ProductVariations
- Query: `productId = ?`

6. **Get all orders for a vendor**
   - Use: VendorIdIndex GSI
   - Query: `vendorId = ?`

7. **Get all order items in an order**
   - Use: OrderIdIndex GSI
   - Query: `orderId = ?`

8. **Get all receipts for an order item**
   - Use: OrderItemIdIndex GSI
   - Query: `orderItemId = ?`

---

## Global Secondary Indexes (GSI) Summary

| Table             | GSI Name            | Partition Key  | Sort Key | Purpose                        |
| ----------------- | ------------------- | -------------- | -------- | ------------------------------ |
| Categories        | ProjectIdIndex      | projectId      | -        | Query categories by project    |
| LineItems         | CategoryIdIndex     | categoryId     | -        | Query items by category        |
| LineItems         | ProjectIdIndex      | projectId      | -        | Query items by project         |
| Products          | ManufacturerIdIndex | manufacturerId | -        | Query products by manufacturer |
| ProductVariations | ProductIdIndex      | productId      | -        | Query variations for product   |
| ProductVendors    | ProductIdIndex      | productId      | -        | Query vendors for a product    |
| ProductVendors    | VendorIdIndex       | vendorId       | -        | Query products from a vendor   |
| Orders            | VendorIdIndex       | vendorId       | -        | Query orders by vendor         |
| OrderItems        | OrderIdIndex        | orderId        | -        | Query items in an order        |
| OrderItems        | LineItemIdIndex     | lineItemId     | -        | Query orders for a line item   |
| Receipts          | OrderItemIdIndex    | orderItemId    | -        | Query receipts by order item   |

---

## Cleanup Recommendations

### Safe to Delete (Obsolete Tables)

Run these commands to clean up unused tables:

```bash
# Delete underscore tables (old iteration)
aws dynamodb delete-table --table-name MaterialsSelection_Projects --region us-east-1
aws dynamodb delete-table --table-name MaterialsSelection_Categories --region us-east-1
aws dynamodb delete-table --table-name MaterialsSelection_LineItems --region us-east-1
aws dynamodb delete-table --table-name MaterialsSelection_Vendors --region us-east-1
aws dynamodb delete-table --table-name MaterialsSelection_Manufacturers --region us-east-1
aws dynamodb delete-table --table-name MaterialsSelection_Products --region us-east-1
```

**Cost Savings:** Deleting these unused tables will save on AWS DynamoDB storage costs.

---

## Current Schema Version

**Version:** 1.1
**Last Updated:** June 23, 2026
**Active Tables:** 11 (hyphen format)
**Obsolete Tables:** 6 (underscore format)

---

## Future Enhancements

Potential schema additions for future features:

1. **MaterialsSelection-Users** - User authentication and permissions
2. **MaterialsSelection-Documents** - File attachments (invoices, drawings)
3. **MaterialsSelection-ProjectComments** - Comments and collaboration
4. **MaterialsSelection-InventoryLocations** - Track where materials are stored
5. **MaterialsSelection-PriceHistory** - Historical pricing data for trend analysis
