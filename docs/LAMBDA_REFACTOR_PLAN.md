# Lambda Refactoring Plan — Break Up Monolith

**Status:** Planned — not yet implemented  
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

| Lambda | Dependencies | Approx. zip size |
|---|---|---|
| `Projects-API` | DynamoDB SDK + MS Graph SDK | ~4 MB |
| `Core-API` | DynamoDB SDK only | ~0.5 MB |
| `Catalog-API` | DynamoDB SDK only | ~0.5 MB |
| `Orders-API` | DynamoDB SDK only | ~0.5 MB |
| `AI-API` | DynamoDB SDK + Bedrock SDKs | ~3 MB |

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
