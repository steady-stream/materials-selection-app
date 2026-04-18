# Client Feedback — Analysis & Implementation Plan

_Captured: April 2026. Status as of session start: planning complete, no code changed._

---

## Background

Client meeting produced two categories of feedback: product catalog setup issues and project-level usability issues. Each item was validated against the codebase before planning.

---

## Product-Level Feedback (P1–P8)

| ID  | Description                                   | Real bug or UX gap?                                               | Session    |
| --- | --------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| P1  | "PC" unit missing from unit select            | Bug — option just not in list                                     | Session 1  |
| P2  | No category dropdown — free-text only         | UX gap — field exists, no autocomplete                            | Session 1  |
| P3  | Need "Color" field on product                 | Missing field — requires Lambda deploy                            | Session 2  |
| P4  | Need "Finish" field on product                | ✅ Done — full stack (Lambda + all components + PPTX + Review)    | Session 2  |
| P5  | Can't see/edit vendor from Edit Product modal | UX gap — Vendors button exists in table but not linked from modal | Session 1  |
| P6  | Image file upload (vs URL field)              | ✅ Done — presigned URL upload + URL mode                         | Session 2  |
| P7  | Clone product                                 | Feature gap — no clone button                                     | Session 1  |
| P8  | Add manufacturer on the fly                   | Feature gap — no inline create in dropdown                        | Session 3  |

---

## Project-Level Feedback (L1–L5)

| ID  | Description                                                        | Real bug or UX gap?                                            | Session   |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------- | --------- |
| L1  | "Can't find Qty" — column too narrow                               | UX gap — Qty is there but w-12 header is 48px                  | Session 1 |
| L2  | "Can't mark an item Final without clicking pencil"                 | UX gap — status is static badge; requires inline edit mode     | Session 1 |
| L3  | "Can't set vendor on a line item from the Insert Product modal"    | UX gap — modal uses primary vendor automatically, no override  | Session 1 |
| L4  | "Need to add a product that isn't in the catalog yet"              | Feature gap — requires quick-add product flow inline           | Session 3 |
| L5  | "Want to mark Final right from the options modal (Choose Options)" | UX gap — Select button sets status=selected, no Final shortcut | Session 1 |

---

## Code Findings (Pre-Implementation)

### ProductList.tsx

- Unit select at ~line 921: options are `ea, case, box, bag, set, doz, pair, roll, tube, gal, lbs, sqft, lnft` — **PC missing**
- Category field: plain `<input type="text">` — no datalist/dropdown
- Product type (types/index.ts): no `color` or `finish` fields
- Edit modal: `handleOpenModal(product)` calls `setPrimaryVendorId("")` — vendor cleared; vendor management is via separate "Vendors" button in table row, not linked from modal
- No clone functionality exists

### ProjectDetail.tsx

- Table column headers at ~line 1987: Qty is `w-12` (48px), Unit is `w-12`
- Read-only status: static `<span>` with color class — not interactive
- Insert Product modal: has `insertQuantity` and `insertUnitCost` state (line 139-140), **no vendor override state**
- `handleInsertProduct` at ~line 957: uses `productVendorService.getPrimaryVendor()` only, no override path
- `productVendors: ProductVendor[]` state exists at line 126 — already loaded, usable for vendor cost lookup

### ChooseOptionsModal.tsx

- `handleSelectOption` at line 107: sets `status: "selected"` (hardcoded)
- Action buttons: Deselect (if selected), Select + Remove (if not selected)
- No "Select as Final" path

---

## Session 1 — Frontend Only (no Lambda deploy)

### Changes

**ProductList.tsx**

- [x] P1: Add `<option value="pc">pc</option>` to unit select
- [x] P2: Change category `<input>` → `<input list="product-categories">` + `<datalist>` with standard construction categories
- [x] P7: Add `handleClone(product)` function + Clone button in table row actions
- [x] P5: Add "Manage Vendors →" shortcut in Edit Product modal (button that closes modal and opens vendor modal for same product)

**ProjectDetail.tsx**

- [x] L1: Change Qty column header from `w-12` to `w-20` (three table locations)
- [x] L2: Add `handleQuickStatusChange(item, newStatus)` → replace static `<span>` with styled `<select>` that auto-saves
- [x] L3: Add `insertVendorId` state → vendor dropdown in Insert modal → update `handleInsertProduct` and `handleSelectProduct` to use override if set
- (Reset `insertVendorId` in all close-modal paths)

**ChooseOptionsModal.tsx**

- [x] L5: Add `handleSelectOptionAsFinal(option)` → add "Select as Final" button next to "Select" button

---

## Session 2 — New Product Fields (Lambda catalog deploy required)

1. **P3 — Color field**
   - `types/index.ts`: add `color?: string` to `Product` interface
   - `lambda/catalog/index.js`: add `color` to create/update attribute maps
   - `ProductList.tsx`: add color dropdown (standard construction colors)
   - Deploy `lambda/catalog` to test, validate, then prod

2. **P4 — Finish field** ✅ Done (April 18, 2026)
   - `types/index.ts`: added `finish?: string` to `Product`, `CreateProductRequest`, `UpdateProductRequest`
   - `lambda/catalog/index.js`: added `finish` to `createProduct()`
   - `ProductList.tsx`: finish form input with 36-item datalist, filter, search, tooltip
   - `ProjectDetail.tsx`: finish filter + quick-add + tooltips (line item + insert product)
   - `ChooseOptionsModal.tsx`: finish filter + tooltip
   - `ReviewPage.tsx`: finish in table row subtitle + detail panel
   - `pptxService.ts`: finish + color + collection added to PowerPoint slide details
   - Color datalist cleaned (removed 9 finishes, added 14 basic colors)
   - Deployed to test and prod

---

## Session 3 — Inline Creation Features

1. **P8 — Add manufacturer on the fly**
   - Mini modal within product form triggered by "+" button beside manufacturer dropdown
   - Creates manufacturer, refreshes list, auto-selects new one

2. **L4 — Quick-add product from project**
   - "Create New Product" option in Insert Product modal
   - Simplified product form inline (name, mfr, unit, category, vendor/cost)
   - Saves to catalog and immediately inserts as line item

---

## Completed (Previously Deferred)

- **P6 — Image file upload**: ✅ Implemented — S3 presigned URL via `GET /products/upload-url` in Catalog lambda, frontend supports both file upload and URL modes, 5 MB limit, MIME type validation (jpeg/png/webp/gif). S3 bucket: `materials-product-images-{accountId}` (separate per environment).
