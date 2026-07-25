# PowerPoint Export — Item Omission Investigation

**Date:** 2026-06-24  
**Issue:** Client reported that not all line items are being included in the exported PowerPoint presentation.  
**Status:** Review-only (no code changes yet; diagnostic investigation complete)

---

## Resolution Addendum (2026-07-25) — Image Rendering Reliability

### Incident Summary

After omission analysis, a separate production issue was confirmed in PowerPoint export image handling:

- Some product images rendered in the in-app Review page but failed in exported PPT slides.
- Error behavior progressed from "image cannot be displayed" to fallback placeholder behavior while hardening was in progress.
- At one stage, all images failed due to a regression in proxy response decoding.

### Root Cause Sequence

1. Browser rendering success did not guarantee PPT embedding compatibility.
2. Third-party CDN image responses and encoding behaviors were inconsistent for direct browser-based conversion.
3. Proxy-first loading introduced a binary payload assumption that was not always true.
4. API Gateway/image-proxy responses could arrive as base64 text payloads rather than raw image bytes, causing decode failures and placeholder fallback.

### Implemented Fixes in `src/services/pptxService.ts`

1. Remote image URLs are loaded proxy-first via `/image-proxy`.
2. Proxy payloads are inspected for known image signatures (JPEG/PNG/GIF/WEBP).
3. Non-signature payloads are decoded as base64 text into binary image blobs.
4. All decoded blobs are normalized to PNG via canvas re-rasterization before PPT embed.
5. Image dimensions are capped for stability (`MAX_IMAGE_DIMENSION = 2048`).

### Verification Outcome

- Production retest confirmed all images are appearing, including previously problematic products.
- The originally failing examples now render consistently in exported PPT output.

### Final Status

**Resolved in production on 2026-07-25.**

---

## Current Behavior Summary

The PowerPoint export feature generates a professional materials selection presentation from a project. The current implementation includes:

- **Cover slide** with project name, customer info, logo, and totals
- **Section divider slides** for each project category
- **Product detail slides** for each line item with product information, images, and pricing
- **Option slides** (Good/Better/Best alternatives) when available
- **Final status logic** — items marked "Final" display only the selected product

---

## Four Potential Omission Paths Identified

### 1. **Intentional Filtering: Items Without Products or Options** (Highest Risk)

**Current Logic:**  
The export process filters the line items list to include only items that have _either_ a selected product _or_ one or more options.

```
Filter: item.product !== null || item.options.length > 0
```

**Impact:**

- Line items with status "Pending" or "Selected" but no productId are excluded from the PPT.
- Line items that have neither a selected product nor any options do not generate slides.

**Most Likely Explanation:**  
If the client expected the PPT to include all line items from the project (regardless of product selection status), this filter is the primary reason items are missing.

**Location:** [src/services/pptxService.ts](src/services/pptxService.ts#L175-L177)

---

### 2. **Selected Options Are Skipped** (High Risk)

**Current Logic:**  
When fetching options for a line item, the code explicitly filters out options marked as `isSelected: true`.

```
options.filter((opt) => !opt.isSelected)
```

**Impact:**

- If a line item has a selected product _and_ that selection is stored as a selected option record, the option is filtered out during data fetch.
- If the line-item-level `productId` field is missing or stale while a selected option exists, the item may be caught by filter #1 above and omitted entirely.

**Scenario:**  
An option was selected and synced to the line item, but the line item's `productId` subsequently cleared or was not updated. Result: selected option is filtered out, line item has no product, line item is omitted from PPT.

**Location:** [src/services/pptxService.ts](src/services/pptxService.ts#L108-L114)

---

### 3. **Large Projects May Truncate Results** (Medium Risk)

**Current Logic:**  
Line items and line item options are fetched via DynamoDB Query operations without pagination/LastEvaluatedKey handling.

**Impact:**

- DynamoDB queries return a maximum of 1 MB of data per request.
- If a project has many line items or options, the first API call may return only a partial result set.
- The export would include only the items returned in the first batch.

**Affected Endpoints:**

- Line items fetch: [src/services/lineItemService.ts](src/services/lineItemService.ts#L18)
- Backend route: [lambda/core/index.js](lambda/core/index.js#L293)
- Options fetch per line item: [lambda/core/index.js](lambda/core/index.js#L550)

**Likelihood:**  
Low for typical projects; more likely if a project has hundreds of line items or options.

---

### 4. **Missing Related Products Are Silently Skipped** (Medium Risk)

**Current Logic:**  
If a line item references a product that no longer exists (deleted, ID corrupted, or API failure), the fetch fails with a warning log, and the item is marked `null` in the result set.

**Impact:**

- Missing product records cause the line item to fail the relevance filter (filter #1).
- The line item is silently omitted from the PPT with only a console warning message.

**Example Scenario:**  
A line item was created with `productId: "123"`. The product record was later deleted or moved. When the PPT export runs, product fetch fails, the item shows as having no product, and is omitted.

**Location:** [src/services/pptxService.ts](src/services/pptxService.ts#L74), [error handling](src/services/pptxService.ts#L100)

---

## Fast Triage: Questions to Ask the Client

To pinpoint which path is causing the omission, request the following information about one missing item:

1. **Project ID** and **environment** (test or production).

2. **Item count comparison:**
   - How many line items are visible in the Project Detail page?
   - How many product slides appear in the exported PPT?

3. **Missing item details:**
   - What is the **status** of the missing line item (Pending / Selected / Final / Ordered / etc.)?
   - Does it have a **selected product** (visible in the Project Detail line)?
   - Does it have **options** (Good/Better/Best alternatives)?

4. **Recent changes:**
   - Was the product associated with this item **deleted, modified, or changed recently**?
   - Was the line item moved between categories or statuses?

---

## Recommended Next Steps

### Before Making Code Changes

1. **Reproduce the issue** with the client's example project to confirm which filter path is causing the omission.
2. **Review SOW expectations** — Confirm with client whether the PPT should include:
   - All line items regardless of product selection status? (Requires changing filter #1)
   - Only items with selected products or options? (Current behavior)
   - Only items with "Final" status? (Alternative interpretation)

### After Confirming Root Cause

Depending on the findings, we can:

- **If filter #1 is the issue:** Modify the relevance filter to include all line items, or add a UI option to the export dialog to let the user choose.
- **If filter #2 is the issue:** Audit the option-to-lineitem sync logic to ensure selected options correctly update the line item's productId.
- **If filter #3 is the issue:** Add pagination handling to the line-item and options API calls.
- **If filter #4 is the issue:** Add defensive handling for missing products (placeholder text, error notes) instead of silent omission.

---

## Key Code References

| Finding                      | File                                                                   | Line    |
| ---------------------------- | ---------------------------------------------------------------------- | ------- |
| Relevance filter             | [src/services/pptxService.ts](src/services/pptxService.ts#L175-L177)   | 175–177 |
| Selected option filter       | [src/services/pptxService.ts](src/services/pptxService.ts#L114)        | 114     |
| Product fetch error handling | [src/services/pptxService.ts](src/services/pptxService.ts#L100)        | 100     |
| Line items API call          | [src/services/lineItemService.ts](src/services/lineItemService.ts#L18) | 18      |
| Backend line items query     | [lambda/core/index.js](lambda/core/index.js#L293)                      | 293     |

---

## Summary

The PowerPoint export feature is working as currently designed, but it includes filters that exclude items without selected products or options. The client's report of missing items is likely due to one of the four paths above. We recommend gathering the triage information to confirm the root cause before making any code modifications.
