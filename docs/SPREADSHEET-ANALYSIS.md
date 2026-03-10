# Excel Spreadsheet Analysis - Materials Selection App

## Current Spreadsheet Structure

### Key Features Identified:

1. **Project-Specific Sheets** (e.g., "Vance, Stacey & Terry 39505-LNC", "Roloff 38562-LNC Basement")
   - Columns:
     - Item Description
     - Model Number
     - Allowance (Budget)
     - Actual Cost
     - Vendor
     - Ordered Date
     - Received & Inspected Date
     - Staging Location
     - Return or Damaged Notes

2. **Reference/Master Data Sheets**:
   - **Vendor** - List of suppliers (Ferguson, Home Depot, Menards, Lowes, Amazon, etc.)
   - **Manufacturer** - Brand list (Kohler, Moen, Delta, etc.)
   - **Products** - Product catalog with (Manufacturer, Model #, Description, Image URL, Finish/Color)
   - **APIA ITEMS** - Standard items list (Faucet, Shower Trim, Toilet, etc.)
   - **Frequent Material Model Price** - Commonly used items with pricing

3. **Categories/Phases**:
   - "Selection Phase (Choosing materials and finishes)"
   - Organized by room (Powder Room, Bath, Kitchen, Basement, etc.)
   - Sub-categories (Electrical, Plumbing, Finishes, etc.)

4. **Tracking Features**:
   - Budget vs Actual cost tracking
   - Order status (checkboxes for Ordered/Received)
   - Dates for appointments, ordering, and receiving
   - Vendor selection from dropdown
   - Model numbers and specifications

## Proposed Enhancements for Web App

### Phase 1: Enhanced Data Model

1. **Add New Tables**:

   ```
   - Vendors (id, name, contact, website, notes)
   - Manufacturers (id, name, website)
   - Products (id, manufacturerId, modelNumber, description, imageUrl, finish, price)
   - StandardItems (id, name, category, description)
   ```

2. **Enhanced LineItems**:
   ```
   Add fields:
   - vendorId
   - manufacturerId
   - productId (optional - link to product catalog)
   - modelNumber
   - allowance (budget)
   - actualCost
   - orderedDate
   - receivedDate
   - stagingLocation
   - returnNotes
   - status (pending, ordered, received, installed)
   ```

### Phase 2: UI Enhancements

1. **Spreadsheet-like Grid View**:
   - Inline editing
   - Quick add row
   - Column sorting/filtering
   - Bulk operations
   - Copy/paste support

2. **Product Catalog Browser**:
   - Search products by manufacturer, model, description
   - Quick add to project from catalog
   - Image preview
   - Price history

3. **Vendor/Manufacturer Management**:
   - Dropdown selection from master lists
   - Quick add new vendor/manufacturer
   - Contact information display

4. **Budget Tracking**:
   - Allowance vs Actual cost comparison
   - Category subtotals
   - Project totals
   - Variance alerts

5. **Order Tracking**:
   - Status indicators (Pending, Ordered, Received)
   - Date tracking
   - Overdue indicators
   - Staging location management

### Phase 3: Advanced Features

1. **Templates**:
   - Standard bathroom packages
   - Standard kitchen packages
   - Basement packages
   - Copy from previous project

2. **Reporting**:
   - Budget variance report
   - Outstanding orders
   - Received items log
   - Vendor spending summary

3. **Import/Export**:
   - Import from Excel
   - Export to Excel/PDF
   - Print-friendly views
