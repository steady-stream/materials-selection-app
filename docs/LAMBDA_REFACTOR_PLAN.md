# Lambda Refactoring Plan — Break Up Monolith

**Status:** ✅ COMPLETE — deployed to TEST (March 9, 2026)  
**Production:** Not yet deployed — pending extended testing  
**Created:** March 9, 2026

---

## Problem

`lambda/index.js` is a single ~2,250-line monolithic handler containing 66 functions
covering every domain: Projects, SharePoint, AI/Bedrock, Categories, Line Items,
Catalog (Vendors/Manufacturers/Products), Orders, and more.

**Consequences:**

- Every deploy — even a one-line DynamoDB fix — requires zipping all dependencies
  together: DynamoDB SDK + Bedrock SDK + MS Graph SDK + isomorphic-fetch = ~10MB zip
- A bug in any one domain can take down the entire API
- Cold starts load all SDKs regardless of the route being invoked
- `node_modules` contains 1,695+ files; zip creation is slow and error-prone on Windows

---

## Solution: Split into 5 Domain Lambdas, Same API Gateway

All routes remain at the same URL. API Gateway route integrations are updated to point
to the appropriate Lambda per route group. **The frontend (`VITE_API_BASE_URL`) does
not change.**

```
API Gateway (unchanged URL)
│
├── /projects/*   ──→  MaterialsSelection-Projects-API   (DynamoDB + MS Graph SDK)
├── /sharepoint/* ──→  MaterialsSelection-Projects-API
│
├── /categories/*        ─┐
├── /lineitems/*          ├─→  MaterialsSelection-Core-API   (DynamoDB only)
├── /lineitem-options/*   ┘
│
├── /vendors/*            ─┐
├── /manufacturers/*       ├─→  MaterialsSelection-Catalog-API   (DynamoDB only)
├── /products/*            │
├── /product-vendors/*     ┘
│
├── /orders/*             ─┐
├── /orderitems/*          ├─→  MaterialsSelection-Orders-API   (DynamoDB only)
├── /receipts/*            ┘
│
└── /ai/*        ──→  MaterialsSelection-AI-API   (DynamoDB + Bedrock SDKs)
```

The existing `MaterialsSelection-Salesforce-API` is already a separate Lambda —
no changes needed there.

---

## Proposed File Structure

```
lambda/
  projects/
    index.js             ← handler + router for /projects/* and /sharepoint/*
    sharepointService.js ← moved from lambda root
    package.json         ← @microsoft/microsoft-graph-client, @aws-sdk/client-dynamodb
  core/
    index.js             ← handler + router for /categories/*, /lineitems/*, /lineitem-options/*
    package.json         ← @aws-sdk/client-dynamodb only
  catalog/
    index.js             ← handler + router for /vendors/*, /manufacturers/*, /products/*, /product-vendors/*
    package.json         ← @aws-sdk/client-dynamodb only
  orders/
    index.js             ← handler + router for /orders/*, /orderitems/*, /receipts/*
    package.json         ← @aws-sdk/client-dynamodb only
  ai/
    index.js             ← handler + router for /ai/*
    package.json         ← @aws-sdk/client-bedrock-runtime, @aws-sdk/client-bedrock-agent-runtime, @aws-sdk/client-dynamodb
```

> **No shared module.** Table name constants and the CORS headers object are trivially
> copy-pasted into each Lambda. Lambda doesn't support cross-function imports natively
> and a Lambda Layer for constants would add operational complexity for no real benefit.

---

## Estimated Deployment Size Impact

| Lambda         | Dependencies                | Approx. zip size |
| -------------- | --------------------------- | ---------------- |
| `Projects-API` | DynamoDB SDK + MS Graph SDK | ~4 MB            |
| `Core-API`     | DynamoDB SDK only           | ~0.5 MB          |
| `Catalog-API`  | DynamoDB SDK only           | ~0.5 MB          |
| `Orders-API`   | DynamoDB SDK only           | ~0.5 MB          |
| `AI-API`       | DynamoDB SDK + Bedrock SDKs | ~3 MB            |

Current monolith zip: ~10 MB. Most common deployments (any non-AI, non-SharePoint
bug fix) drop from ~10 MB to ~0.5 MB.

---

## Known Issues to Fix During Refactor

`getOrderItemsByOrder` and `getOrderItemsByProject` are each defined **twice** in the
current `index.js` (lines 1472/1484 and again at 1552/1564). JavaScript hoists the
second declaration. The duplicates should be removed as part of the Orders Lambda.

---

## API Gateway Changes Required

For each new Lambda:

1. Create the Lambda function (copy IAM role from existing `MaterialsSelection-API`)
2. Update API Gateway route integrations to point to the new Lambda ARN
3. Add Lambda resource-based policy (`lambda:InvokeFunction`) for API Gateway
4. Set environment variables on each Lambda:
   - **All Lambdas:** AWS region, table names (can use existing env vars or hardcode)
   - **Projects-API only:** `SHAREPOINT_SITE_URL`, `SHAREPOINT_LIBRARY`,
     `SHAREPOINT_BASE_FOLDER`, `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`,
     `SHAREPOINT_CLIENT_SECRET`
   - **AI-API only:** `KNOWLEDGE_BASE_ID` (`WWMDUQTZJZ`)

Both test (`xrld1hq3e2`) and production (`6extgb87v1`) API Gateways need updating.

---

## Suggested Implementation Order

1. **`Projects-API`** — Extract Projects + SharePoint. Biggest win: removes MS Graph SDK
   from every other deploy. Also the most frequently modified Lambda right now.
2. **`AI-API`** — Extract Bedrock routes. Removes large Bedrock SDKs from the remaining
   domains. AI changes are infrequent so this Lambda will rarely need redeployment.
3. **`Catalog-API`** — Pure DynamoDB CRUD, lowest risk, simplest refactor.
4. **`Orders-API`** — Orders/OrderItems/Receipts with cascading delete logic.
5. **`Core-API`** — Categories + Line Items. Most complex due to the inline
   `GetCommand` in the router for `POST /categories/:id/lineitems`.

Each Lambda should be deployed to test first and smoke-tested before proceeding to prod.

---

## What Does NOT Change

- Frontend code (`src/`) — zero changes
- `VITE_API_BASE_URL` — single base URL, unchanged
- DynamoDB tables — untouched
- API Gateway URL — same endpoint
- Salesforce Lambda — already separate
- Route paths — all identical

---

## Implementation Record — March 9, 2026

### AWS Resources Created (TEST — account `634752426026`)

| Lambda Name                       | ARN (partial)                  | Created      |
| --------------------------------- | ------------------------------ | ------------ |
| `MaterialsSelection-Projects-API` | `...634752426026:function:...` | 21:35:33 UTC |
| `MaterialsSelection-Core-API`     | `...634752426026:function:...` | 21:36:06 UTC |
| `MaterialsSelection-Catalog-API`  | `...634752426026:function:...` | 21:37:02 UTC |
| `MaterialsSelection-Orders-API`   | `...634752426026:function:...` | 21:37:35 UTC |
| `MaterialsSelection-AI-API`       | `...634752426026:function:...` | 21:38:32 UTC |

- **IAM Role:** `arn:aws:iam::634752426026:role/MaterialsSelection-Lambda-Role` (reused from monolith)
- **Runtime:** `nodejs22.x` / handler `index.handler` / timeout 30s / memory 256MB
- **All Lambdas use CJS** (`require`/`exports.handler`) — not ESM

### API Gateway Changes (TEST — `xrld1hq3e2`, stage `prod`)

- All existing route integrations re-pointed from `MaterialsSelection-API` to the appropriate domain Lambda
- 10 new resources created for orders/orderitems/receipts routes (previously missing from API GW entirely)
- 4 missing GET methods added: `/lineitem-options`, `/lineitem-options/{optionId}`, `/categories/{categoryId}/lineitems`, `/product-vendors`
- Stage redeployed (Deployment ID: `9ncwjb`)

### Deploy Scripts

| Script                         | Purpose                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `build-and-deploy-lambdas.ps1` | Zips each of the 5 lambda dirs and creates/updates the functions in AWS. Logs to `deploy-split-lambda.log`. |
| `update-apigw-routes.ps1`      | Re-points API GW integrations and creates the orders/receipts resources.                                    |

### Known Bugs Fixed During Refactor

- Duplicate `getOrderItemsByOrder` / `getOrderItemsByProject` functions in the monolith (JavaScript silently used the second declaration). Only one copy exists in `lambda/orders/index.js`.
- `GET /product-vendors` (bare list-all) was missing from the router — added during smoke testing.
- `GET /lineitem-options` (bare list-all) and `GET /lineitem-options/{id}` were missing from the core router — added during smoke testing.
- `ScanCommand` was not imported in `lambda/core/index.js` — added.

### Smoke Test Results (TEST)

| Route                    | Lambda   | Status |
| ------------------------ | -------- | ------ |
| `GET /projects`          | Projects | ✅ 200 |
| `GET /vendors`           | Catalog  | ✅ 200 |
| `GET /manufacturers`     | Catalog  | ✅ 200 |
| `GET /products`          | Catalog  | ✅ 200 |
| `GET /product-vendors`   | Catalog  | ✅ 200 |
| `GET /lineitem-options`  | Core     | ✅ 200 |
| `GET /sharepoint/config` | Projects | ✅ 200 |

**Not yet tested:** orders write operations (`POST /orders`, etc.), AI routes (`POST /ai/test`, `/ai/chat`, `/ai/docs`).

### Monolith Status

`MaterialsSelection-API` (monolith) **still exists** in AWS TEST — not decommissioned. It can be used as a fallback if needed by temporarily re-pointing API GW integrations.

### Git Commit

`2653b5f` — `feat: split monolith Lambda into 5 domain Lambdas (TEST deployed)`

---

## Production Deployment Checklist

When ready to repeat for production (`6extgb87v1`, account `860601623272`):

- [ ] Run `build-and-deploy-lambdas.ps1` with `--profile megapros-prod`
- [ ] Run `update-apigw-routes.ps1` targeting prod API GW
- [ ] Set env vars on each Lambda (especially SharePoint vars on Projects-API)
- [ ] Smoke test prod routes
- [ ] Decommission old monolith (or leave as cold standby)
