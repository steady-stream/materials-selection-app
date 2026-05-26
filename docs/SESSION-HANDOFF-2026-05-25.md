# Session Handoff - 2026-05-25

## Scope Completed In This Session

This session focused on **product catalog variation architecture** and **product maintenance UI**.

### 1) Backend variation foundation completed

Implemented and deployed variation-capable backend behavior:

- `lambda/catalog/index.js`
  - Added `MaterialsSelection-ProductVariations` table integration.
  - Added `GET /products/{id}/variations` route.
  - Added variation validation/persistence/hydration helpers.
  - Added duplicate warning flow (`DUPLICATE_PRODUCT_WARNING`, HTTP 409) using:
    - manufacturer + normalized model stem
    - override with `overrideDuplicate: true`
- `lambda/core/index.js`
  - Line item and line item options now variation-aware (`productVariationId`, model metadata).
  - Option selection identity now uses product + variation (not just product).
- `lambda/index.js` (monolith parity)
  - Mirrored catalog/core variation logic to prevent split/monolith drift.

### 2) Frontend contracts completed

- `src/types/index.ts`
  - Added variation types and payload fields:
    - `ProductVariation`, `ProductVariationInput`
    - `variations`, `productVariationId`, `overrideDuplicate`, `modelStem`
- `src/services/productService.ts`
  - Added `getVariations(productId)` API helper.

### 3) Product maintenance UI completed

- `src/components/ProductList.tsx`
  - Added variation row editor support in Add/Edit Product modal.
  - Added duplicate warning override handling from API 409 response.
  - Added client-side variation validations:
    - at least one variation
    - if multiple variations: each must have color and/or finish
    - no duplicate effective model number per product
    - no duplicate color/finish combo per product

## UI Adjustments Requested After Initial Deploy (Completed)

The following were specifically requested and have now been implemented and deployed to test:

1. Removed base color/finish controls from the main product section.
   - Color/finish now live only in the variation section (including single-variation products).
2. Variation color/finish now support predefined datalist + free entry.
3. Added subtle section shading:
   - variation section uses subtle slate tint
   - vendor pricing section uses subtle amber tint
4. Moved image handling fully into variation rows.
   - removed base product image URL/upload section
   - each variation has URL/upload toggle and per-row upload status/error

## Test Deployments Performed

### Split lambdas deployed

Via `build-and-deploy-lambdas.ps1`:

- `MaterialsSelection-Projects-API`
- `MaterialsSelection-Core-API`
- `MaterialsSelection-Catalog-API`
- `MaterialsSelection-Orders-API`
- `MaterialsSelection-AI-API`

### Frontend deployed to test

Via `deploy-test.ps1`:

- Test URL: `https://mpmaterials.apiaconsulting.com`
- Most recent invalidation ID: `I2D7LVBURHMT3RMWM75RJSD6TM`

## Critical Infrastructure Fix Applied In Test

Root cause of "FAILED TO ADD PRODUCT" after first test deploy:

- Missing DynamoDB table in test account: `MaterialsSelection-ProductVariations`.

Fix performed:

- Created table `MaterialsSelection-ProductVariations` in `us-east-1`.
- Created GSI `ProductIdIndex`.
- Verified table + GSI both `ACTIVE`.

## Current Status

- Product catalog maintenance variation work is deployed to test and should be testable.
- Add/edit product error caused by missing table is resolved.

## Remaining Work (Not Started Yet In This Session)

### A) Model number semantics (explicitly deferred)

User noted base model/model override behavior may still be incorrect.

- This is intentionally the **next catalog task** after validating UI changes.
- Needs explicit implementation review for:
  - base model number source of truth
  - variation effective model derivation
  - default variation behavior
  - duplicate detection coupling to base vs effective models

### B) Project-side variation selection (next phase)

Still pending:

- In project add/select product workflows (`ProjectDetail` and option flows):
  - require variation selection when product has 2+ variations
  - auto-select when exactly 1 variation exists
  - persist and use `productVariationId` through line item + options flows

## Suggested Next Step When Returning

1. Validate current test UX for ProductList Add/Edit variation behavior.
2. Implement/fix model number/base override semantics (Item #5).
3. Then proceed to project-side variation selection changes.

## Key Files Touched This Session

- `src/components/ProductList.tsx`
- `src/types/index.ts`
- `src/services/productService.ts`
- `lambda/catalog/index.js`
- `lambda/core/index.js`
- `lambda/index.js`

## Notes

- Build currently succeeds (`npm run build`).
- Existing chunk-size warning remains non-blocking and unchanged from prior state.
