# Materials Selection App - Development Status

**Last Updated:** April 18, 2026  
**Environments:** Test (mpmaterials.apiaconsulting.com) | Production (d377ynyh0ngsji.cloudfront.net)

## Current Status Summary

✅ **Working — Test environment (AWS account 634752426026):**

- Full dual-environment deployment pipeline (test + prod are fully independent)
- All project CRUD operations
- All product/manufacturer/vendor CRUD operations
- Product-vendor relationship management
- Cognito authentication (login, session persistence, logout)
- Salesforce opportunity → project creation workflow
- PowerPoint export from project detail
- Line item options (Good/Better/Best alternatives)
- All allowance fields increment by 1 (not 0.01)
- **SharePoint manual folder link** — "Link SharePoint" button on Project Detail
- **Color field** on products (catalog lambda + frontend)
- **Product image upload** — S3 presigned URL via Catalog lambda, frontend upload + URL modes
- **Client feedback items P1–P8, L1–L5** — all implemented and deployed (including P4 Finish field)
- **Finish field** on products — full stack: Catalog Lambda, ProductList, ProjectDetail, ChooseOptionsModal, ReviewPage, PowerPoint export
- **Custom branding** — Expertise Delivered logo (favicon + header), transparent circular crop, "MegaPros Materials Selection" tab title

✅ **Working — Production environment (AWS account 860601623272):**

- All of the above — **test and prod are now in full sync**
- Split lambda architecture deployed to prod (April 13, 2026) via `migrate-prod-lambdas.ps1`
- Frontend deployed to prod (April 15, 2026)

⚠️ **Known Issues / Pending:**

- Orders/files/SharePoint API routes (`/orders`, `/receipts`, `/projects/{id}/files`, `/projects/{id}/sharepoint/*`) not yet added to prod API Gateway (routes don't exist, not just unwired)

### Bug Fixes (March 10, 2026)

- **Projects list crash on load** — `MaterialsSelection-Projects-API` `getAllProjects()` was returning a raw
  array (`[]`) but the frontend `projectService.getAll()` expected `{ projects: [...] }`. Fixed: Lambda now
  returns the correct envelope; service also has a defensive fallback for either shape.

---

## Environments & Deployment

### Test

| Resource          | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| AWS Account       | 634752426026                                                         |
| API Gateway ID    | xrld1hq3e2 (stage: `/prod`)                                          |
| Cognito User Pool | us-east-1_K72aPw18O                                                  |
| Cognito Client ID | 6h7ebr5r1gqvngrdv5lacfmh3b                                           |
| S3 Bucket         | materials-selection-app-7525                                         |
| CloudFront        | E2CO2DGE8F4YUE                                                       |
| URL               | https://mpmaterials.apiaconsulting.com                               |
| AWS Profile       | megapros-test                                                        |
| Lambda Runtime    | nodejs22.x                                                           |
| Deploy script     | `.\deploy-test.ps1`                                                  |
| Build script      | `npm run build:test` (uses `--mode development` → `.env.local` only) |

### Production

| Resource          | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| AWS Account       | 860601623272                                                            |
| API Gateway ID    | 6extgb87v1 (stage: `/prod`)                                             |
| Cognito User Pool | us-east-1_r52mUYVd5                                                     |
| Cognito Client ID | 2re1l5aultf5jfr38de3tppbrp                                              |
| S3 Bucket         | materials-selection-prod-3039                                           |
| CloudFront        | E2PTMMBR8VRR3W                                                          |
| URL               | https://d377ynyh0ngsji.cloudfront.net                                   |
| AWS Profile       | megapros-prod                                                           |
| Lambda Runtime    | nodejs22.x                                                              |
| Deploy script     | `.\deploy-prod.ps1`                                                     |
| Build script      | `npm run build` (uses `.env.production`; `.env.local` auto-moved aside) |

### Vite Environment File Priority (CRITICAL)

Vite loads env files highest-priority first:

1. `.env.local` — **overrides everything**, baked into every build on this machine
2. `.env.production` — used by `npm run build` (prod mode)
3. `.env.development` — used by `npm run build --mode development`

**`deploy-prod.ps1` automatically renames `.env.local` → `.env.local.bak` before
building, then restores it after — ensuring prod builds always use `.env.production`
exclusively. No human action required.**

---

## Session Summary — April 18, 2026

### P4 — Finish Field (Full Stack)

Client provided finish list (36 finishes). Implemented across the entire stack:

- **Types:** Added `finish?: string` to `Product`, `CreateProductRequest`, `UpdateProductRequest`
- **Lambda:** `catalog/index.js` — `createProduct()` now persists `finish` attribute
- **ProductList.tsx:** Finish form input with 36-item datalist, finish filter dropdown, finish in search, finish in hover tooltip
- **ProjectDetail.tsx:** Finish filter in Insert Product modal, finish in quick-add form (5-col grid), finish in Insert Product tooltip, finish in line item hover tooltip
- **ChooseOptionsModal.tsx:** Finish filter dropdown, finish in product tooltip
- **ReviewPage.tsx:** Finish in table row subtitle (Color · Finish · Collection), Finish DetailRow in slide-out panel
- **pptxService.ts:** Added Color, Finish, and Collection to PowerPoint slide detail lines (none were exported before)
- **Color cleanup:** Removed 9 finish-type entries from color datalist, added 14 basic colors (30 total)

### Filter Layout Improvements

- ProjectDetail Insert Product modal and ChooseOptionsModal: Changed filter grid from 6 to 4 columns so Collection, Color, and Finish appear together on the second row

### Deployments

- Catalog Lambda deployed to test and prod
- Frontend deployed to test and prod (3 rounds as issues were caught and fixed)

### Git Commits (April 18, 2026)

| Hash      | Description                                                |
| --------- | ---------------------------------------------------------- |
| _(below)_ | feat: P4 finish field — full stack + PowerPoint + Review   |

---

## Session Summary — April 15, 2026

### Branding & UX

- **Browser tab**: Changed title from "webprototype" to "MegaPros Materials Selection"
- **Favicon**: Replaced Vite default (`vite.svg`) with `expertise_icon.svg` — Expertise Delivered logo with transparent background
- **Header logo**: Replaced generic building SVG with `expertise_header.png` — Expertise Delivered logo with transparent circular crop
- **Image processing**: Used Pillow to remove black square background outside the circle, added thin black border outline, preserved circle contents
- Deployed to both test and production

### Documentation

- **P6 status corrected** in `DEVELOPMENT_STATUS.md` and `CLIENT_FEEDBACK_PLAN.md` — product image upload was already live but docs still showed it as deferred

### Git Commits (April 15, 2026)

| Hash      | Description                                                |
| --------- | ---------------------------------------------------------- |
| `fb55923` | Branding: custom logo/favicon, transparent bg, doc updates |

---

## Session Summary — April 13, 2026

### Client Feedback — All Items Implemented & Deployed

All items from the April 2026 client meeting are now live in both test and production. See [CLIENT_FEEDBACK_PLAN.md](./CLIENT_FEEDBACK_PLAN.md) for full detail.

| ID  | Description                                                     | Status                                         |
| --- | --------------------------------------------------------------- | ---------------------------------------------- |
| P1  | "PC" unit added to unit dropdown                                | ✅ Done                                        |
| P2  | Category field → dropdown with standard construction categories | ✅ Done                                        |
| P3  | Color field added to products (frontend + catalog Lambda)       | ✅ Done                                        |
| P4  | Finish field                                                    | ⏳ Hold — awaiting client finish list by brand |
| P5  | Vendor shortcut in Edit Product modal                           | ✅ Done                                        |
| P6  | Product image upload                                            | ✅ Done                                        |
| P7  | Clone product                                                   | ✅ Done                                        |
| P8  | Add manufacturer on the fly                                     | ✅ Done                                        |
| L1  | Qty column wider / easier to read                               | ✅ Done                                        |
| L2  | Status change directly in line item table                       | ✅ Done                                        |
| L3  | Vendor override when inserting product into project             | ✅ Done                                        |
| L4  | Quick-add product from Insert Product panel                     | ✅ Done                                        |
| L5  | "Select as Final" shortcut in Choose Options modal              | ✅ Done                                        |

### Infrastructure / DevOps

- **Full prod split-lambda migration** (`migrate-prod-lambdas.ps1`):
  - Created 4 new lambdas in prod: Core-API, Projects-API, Orders-API, AI-API
  - Updated Catalog-API in prod (color field fix)
  - Re-wired all 46 non-OPTIONS API Gateway integrations across 22 resources to split lambdas
  - Prod API stage redeployed (deployment `xc47zu`)
  - Test and production are now architecturally identical

- **Frontend deployed to prod** via `.\deploy-prod.ps1`

### Git Commits (April 13, 2026)

| Hash      | Description                                                                |
| --------- | -------------------------------------------------------------------------- |
| `67b8005` | Client feedback: P1–P5, P7–P8, L1–L5, color field + split lambda migration |

---

## Session Summary — March 9, 2026

### Features Delivered

- **SharePoint manual folder link** — removed automatic folder creation on project save;
  added "Link SharePoint" button on Project Detail that opens a modal allowing the user
  to browse existing folders in the SharePoint base directory or create a new named folder.
  See [SHAREPOINT_MANUAL_LINK_2026-03-09.md](./SHAREPOINT_MANUAL_LINK_2026-03-09.md) for full details.

### Infrastructure / DevOps

- **3 new API Gateway routes added** to test REST API `xrld1hq3e2` (stage `prod`):
  - `GET /sharepoint/config` (resource `2zxkl1`)
  - `GET /projects/{projectId}/sharepoint/folders` (resource `nod7n9`)
  - `POST /projects/{projectId}/sharepoint/link` (resource `r2t74e`)
- **Lambda deployed to test** via manual zip upload (console) — includes both
  `index.js` and `sharepointService.js` changes.
- **Frontend deployed to test** via `.\deploy-test.ps1` — CloudFront invalidation `IDNZME2W1UQI0U2DMXYL03VMV4`.

### Planning

- **Lambda refactor plan documented:** [LAMBDA_REFACTOR_PLAN.md](./LAMBDA_REFACTOR_PLAN.md) —
  split monolithic `MaterialsSelection-API` into 5 domain Lambdas to reduce deploy size
  and improve maintainability. **Implemented and deployed to TEST in session 2 (below).**

### Git Commits (Mar 9, session 1)

| Hash            | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| _(this commit)_ | SharePoint manual folder link feature + Lambda refactor plan |

---

## Session Summary — March 9, 2026 (session 2 — Lambda Refactor)

### Infrastructure / DevOps

- **Lambda monolith split into 5 domain Lambdas** — all created and deployed to TEST.
  See [LAMBDA_REFACTOR_PLAN.md](./LAMBDA_REFACTOR_PLAN.md) for full details.

  | Lambda                            | Routes                                                                |
  | --------------------------------- | --------------------------------------------------------------------- |
  | `MaterialsSelection-Projects-API` | `/projects/*`, `/sharepoint/*`                                        |
  | `MaterialsSelection-Core-API`     | `/categories/*`, `/lineitems/*`, `/lineitem-options/*`                |
  | `MaterialsSelection-Catalog-API`  | `/vendors/*`, `/manufacturers/*`, `/products/*`, `/product-vendors/*` |
  | `MaterialsSelection-Orders-API`   | `/orders/*`, `/orderitems/*`, `/receipts/*`                           |
  | `MaterialsSelection-AI-API`       | `/ai/test`, `/ai/chat`, `/ai/docs`                                    |

- **API Gateway TEST (`xrld1hq3e2`) updated:** all existing integrations re-pointed to domain Lambdas; 10 new orders/receipts resources created; stage redeployed (`9ncwjb`).
- **Smoke test:** 7/7 GET routes returning 200. Orders write and AI routes not yet tested.
- **Old monolith (`MaterialsSelection-API`) preserved** as cold standby — not decommissioned.

### Bugs Fixed

- Missing `GET /product-vendors` and `GET /lineitem-options` (bare list-all) route handlers added.
- `ScanCommand` import missing from `lambda/core/index.js` — fixed.
- Duplicate order-item functions in the monolith removed in the new Orders Lambda.

### Git Commits (Mar 9, session 2)

| Hash      | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `2653b5f` | feat: split monolith Lambda into 5 domain Lambdas (TEST deployed) |

---

## Session Summary — March 4, 2026

### Infrastructure / DevOps

- **Lambda runtime upgraded: nodejs20.x → nodejs22.x** across both environments.
  - AWS is deprecating Node.js 20.x Lambda support after April 14, 2026.
  - Both functions upgraded in test, smoke-tested, then upgraded in prod.
  - No code changes required — Node.js 22 is fully backward-compatible.
  - `aws/setup-prod-infrastructure.ps1` updated to provision with `nodejs22.x` going forward.
  - `upgrade-lambda-runtime.ps1` added — idempotent script to upgrade either environment via `-Environment test|prod` parameter.
- **Production URL confirmed:** https://d377ynyh0ngsji.cloudfront.net (no custom domain configured yet on prod CloudFront distribution `E2PTMMBR8VRR3W`).

### Git Commits (Mar 4)

| Hash      | Description                                          |
| --------- | ---------------------------------------------------- |
| `e7aaf4e` | Upgrade Lambda runtime from nodejs20.x to nodejs22.x |

---

## Session Summary — February 24, 2026

### Features Delivered

- **Allowance field step increment** changed from `0.01` → `1` across all inputs:
  - `CategoryForm.tsx` (standalone category form)
  - `ProjectDetail.tsx` — Add Section modal
  - `ProjectDetail.tsx` — Edit Section modal
  - `ProjectDetail.tsx` — Inline add line item row
  - `ProjectDetail.tsx` — Inline edit line item row

### Infrastructure / DevOps

- **Dual-environment deploy pipeline validated end-to-end:**
  - Change deployed to test → verified working → deployed to prod → both confirmed working
- **`deploy-prod.ps1` hardened:** Now automatically moves `.env.local` aside during build (try/finally ensures it is always restored even on build failure). No more "type YES" prompt — risk is eliminated mechanically.
- **`build:test` script added** to `package.json`: `tsc -b && vite build --mode development` — ensures test builds never load `.env.production`.

### Incident Resolved (see [INCIDENT-2026-02-24-TEST-ENV-BROKEN.md](./INCIDENT-2026-02-24-TEST-ENV-BROKEN.md))

- Test site showed "Application Error" after login
- Root cause: `.env.local` contained a non-existent API Gateway ID (`fiad7hd58j`)
- Fix: corrected to `xrld1hq3e2/prod` (the original test API, still live)
- Safeguards added to `.env.local` comments and `deploy-prod.ps1`

### Git Commits (Feb 24)

| Hash      | Description                                                    |
| --------- | -------------------------------------------------------------- |
| `2679e4e` | Change allowance field increment from 0.01 to 1 (CategoryForm) |
| `f62639c` | Fix test deploy using wrong env: use --mode development        |
| `e612077` | Revert Promise.allSettled change (issue was config, not code)  |
| `c84d99c` | Change allowance step to 1 in ProjectDetail section modals     |
| `0e89e6f` | deploy-prod: auto-move .env.local aside during build           |
| `5ecb75a` | Change allowance step to 1 in inline add/edit item rows        |

---

## Recent Features Added (February 9–24, 2026)

### Cognito Authentication ✅

- Login page with session persistence (survives page reload)
- `AuthProvider` / `useAuth` context
- `ProtectedRoute` guard — redirects to `/login`, preserves intended destination
- First-login new-password challenge flow

### PowerPoint Export ✅

- Generates `.pptx` from project detail page
- Client-side generation using `pptxgenjs`
- Dynamic sizing, collision detection, error handling

### Line Item Options (Good/Better/Best) ✅

- Attach product alternatives to line items
- `ChooseOptionsModal` for selection
- `lineItemOptionService` backend integration

---

## Frontend Deployment

### Test

**S3:** materials-selection-app-7525 | **CF:** E2CO2DGE8F4YUE  
**Latest bundle:** index-C-RuEMj-.js

```
.\deploy-test.ps1
```

### Production

**S3:** materials-selection-prod-3039 | **CF:** E2PTMMBR8VRR3W  
**Latest bundle:** index-e6cLxuy5.js

```
.\deploy-prod.ps1
```

Script auto-handles `.env.local` isolation — no manual steps needed.

---

### Issue #1: AWS Account Mismatch in Lambda Integrations

**Problem:**
When creating new API Gateway integrations for products, manufacturers, and vendors endpoints, the Lambda ARN was incorrectly hardcoded to use AWS account `590183816485` instead of the correct account `634752426026`.

**Symptoms:**

- HTTP 500 Internal Server Error on all POST/PUT/DELETE requests
- No CORS headers in error responses (because Lambda never executed)
- Error: "Access-Control-Allow-Origin header is present on the requested resource"

**Root Cause:**
In `fix-api-endpoints.ps1`, the Lambda URI was constructed with the wrong account ID:

```powershell
# WRONG:
$lambdaArn = "arn:aws:lambda:us-east-1:590183816485:function:MaterialsSelection-API"

# CORRECT:
$lambdaArn = "arn:aws:lambda:us-east-1:634752426026:function:MaterialsSelection-API"
```

**Resolution:**

- Created `fix-lambda-account.ps1` to update all 10 affected integrations
- Updated integrations for:
  - POST /products
  - GET/PUT/DELETE /products/{productId}
  - POST /manufacturers
  - GET/PUT/DELETE /manufacturers/{manufacturerId}
  - POST /vendors
  - GET/PUT/DELETE /vendors/{vendorId}
- Deployed to production (deployment: fjcg3t)

**Lesson Learned:**
Always verify Lambda ARN account ID matches the account where API Gateway resides. Use `aws apigateway get-integration` on working endpoints to get the correct template.

---

### Issue #2: Missing CORS Headers on OPTIONS Responses

**Problem:**
API Gateway OPTIONS methods were configured with MOCK integrations, but the integration responses weren't properly configured with CORS headers.

**Symptoms:**

- Browser preflight OPTIONS requests succeeded (200 OK)
- But response contained no `Access-Control-Allow-Origin` header
- Actual POST/PUT/DELETE requests blocked by browser CORS policy
- Console error: "Response to preflight request doesn't pass access control check"

**Root Cause:**
While OPTIONS methods were created with method responses defining header parameters, the integration responses weren't configured to actually populate those headers with values.

**Resolution Process:**

1. **Created OPTIONS method response:**

```powershell
$methodParams = '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}'
aws apigateway put-method-response --rest-api-id $apiId --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-parameters $methodParams
```

2. **Created OPTIONS integration response with actual values:**

```powershell
$integParams = @'
{"method.response.header.Access-Control-Allow-Headers":"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'","method.response.header.Access-Control-Allow-Methods":"'GET,POST,OPTIONS'","method.response.header.Access-Control-Allow-Origin":"'*'"}
'@
aws apigateway put-integration-response --rest-api-id $apiId --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-parameters $integParams
```

**Note:** PowerShell quoting issues required using here-strings (`@'...'@`) to properly escape the JSON with embedded single quotes.

**Endpoints Fixed:**

- /projects (deployment: 7o89jc)
- /projects/{projectId} (deployment: xcacks)
- /products (deployments: 3vp4l1, oonjha)
- /products/{productId} (deployment: oonjha)
- /manufacturers (deployment: oonjha)
- /manufacturers/{manufacturerId} (deployment: oonjha)
- /vendors (deployment: oonjha)
- /vendors/{vendorId} (deployment: oonjha)
- /product-vendors (deployment: zlwaez)
- /product-vendors/{id} (deployment: ffo704)

---

### Issue #3: Missing CRUD Methods on Existing Endpoints

**Problem:**
When the API was initially set up, only GET methods were configured for most endpoints. The MaterialsSelection-API Lambda was built to handle all HTTP methods, but API Gateway wasn't wired to forward POST/PUT/DELETE requests.

**Symptoms:**

- Products list page loaded fine (GET worked)
- Add Product button failed (no POST method)
- Edit Product failed (no PUT method)
- Delete Product failed (no DELETE method)

**Resolution:**
Systematically added missing methods to all endpoints:

**Products:**

- Added POST to /products
- Created /products/{productId} resource (didn't exist at all)
- Added GET, PUT, DELETE to /products/{productId}

**Manufacturers:**

- Added POST to /manufacturers
- Created /manufacturers/{manufacturerId} resource (didn't exist)
- Added GET, PUT, DELETE to /manufacturers/{manufacturerId}

**Vendors:**

- Added POST to /vendors
- Created /vendors/{vendorId} resource (didn't exist)
- Added GET, PUT, DELETE to /vendors/{vendorId}

**Product-Vendors:**

- Created /product-vendors resource (new)
- Added POST to /product-vendors
- Created /product-vendors/{id} resource
- Added GET, PUT, DELETE to /product-vendors/{id}

All integrations point to same Lambda (AWS_PROXY, integration-http-method POST):

```
arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:634752426026:function:MaterialsSelection-API/invocations
```

---

## API Gateway Configuration Details

**API Gateway ID:** xrld1hq3e2  
**API Name:** MaterialsSelectionAPI  
**Stage:** prod  
**Region:** us-east-1  
**Lambda:** MaterialsSelection-API (account: 634752426026)

### Complete Endpoint Map

| Endpoint                        | Methods                   | Resource ID    | Purpose                            |
| ------------------------------- | ------------------------- | -------------- | ---------------------------------- |
| /projects                       | GET, POST, OPTIONS        | 5hsdxi         | List/create projects               |
| /projects/{projectId}           | GET, PUT, DELETE, OPTIONS | (varies)       | Get/update/delete project          |
| /products                       | GET, POST, OPTIONS        | 1z63lw         | List/create products               |
| /products/{productId}           | GET, PUT, DELETE, OPTIONS | m83lje         | Get/update/delete product          |
| /products/{productId}/vendors   | GET                       | ax2msi         | List vendors for product           |
| /manufacturers                  | GET, POST, OPTIONS        | 6t75zr         | List/create manufacturers          |
| /manufacturers/{manufacturerId} | GET, PUT, DELETE, OPTIONS | sfq8od         | Get/update/delete manufacturer     |
| /vendors                        | GET, POST, OPTIONS        | 3f6bow         | List/create vendors                |
| /vendors/{vendorId}             | GET, PUT, DELETE, OPTIONS | yla3k3         | Get/update/delete vendor           |
| /product-vendors                | POST, OPTIONS             | 2cqzh6         | Create product-vendor relationship |
| /product-vendors/{id}           | GET, PUT, DELETE, OPTIONS | oahf6q         | Get/update/delete product-vendor   |
| /salesforce/opportunities       | GET, OPTIONS              | (separate API) | Get Salesforce opportunities       |

### CORS Configuration (All Endpoints)

**Allowed Origins:** `*`  
**Allowed Methods:** Varies by endpoint (GET, POST, PUT, DELETE, OPTIONS)  
**Allowed Headers:** Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token  
**Implementation:** MOCK integration on OPTIONS methods with proper integration responses

---

## Deployment History (February 7, 2026)

| Deployment ID | Description                                            | Endpoints Affected                      |
| ------------- | ------------------------------------------------------ | --------------------------------------- |
| 7o89jc        | Added POST and OPTIONS to /projects                    | /projects                               |
| xcacks        | Added PUT, DELETE, OPTIONS to /projects/{projectId}    | /projects/{projectId}                   |
| oonjha        | Added CRUD methods to products, manufacturers, vendors | Multiple                                |
| 3vp4l1        | Fixed /products OPTIONS CORS                           | /products                               |
| fjcg3t        | Fixed Lambda account ID for all new endpoints          | products, manufacturers, vendors        |
| ffo704        | Created product-vendors endpoints                      | /product-vendors, /product-vendors/{id} |
| zlwaez        | Fixed product-vendors CORS                             | /product-vendors                        |

---

## Historical Infrastructure Notes

**Function Name:** MaterialsSelection-API  
**Runtime:** Node.js 20.x  
**Memory:** 256 MB  
**Region:** us-east-1  
**Account:** 634752426026  
**Code Location:** `C:\AppStaging\extracted\`

**CORS Headers (in code):**

```javascript
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};
```

Lambda correctly returns CORS headers in all responses. The OPTIONS methods are handled by API Gateway MOCK integrations, not Lambda.

---

## Scripts Created for Infrastructure Management

### fix-api-endpoints.ps1

Creates all missing CRUD methods and OPTIONS/CORS for products, manufacturers, vendors. Initially had wrong account ID bug.

### fix-lambda-account.ps1

Fixed the account ID mismatch by updating all 10 Lambda integrations to use correct account 634752426026.

### fix-products-options.ps1

Specifically fixed the OPTIONS integration response for /products endpoint.

### create-product-vendors.ps1

Created entirely new /product-vendors and /product-vendors/{id} resources with full CRUD and CORS.

**Note:** All scripts use PowerShell and rely on AWS CLI being configured with credentials.

---

## Testing Checklist

✅ Projects: Create, Read, Update, Delete  
✅ Products: Create, Read, Update, Delete  
✅ Manufacturers: Create, Read, Update, Delete  
✅ Vendors: Create, Read, Update, Delete  
✅ Product-Vendor Relationships: Add, Update, Delete  
✅ Salesforce Integration: Create projects from opportunities (WORKING as of Feb 8, 2026)

---

## Next Session Priorities

1. **AI / Chat Assistant** — scoped in [AI_INTEGRATION_PLAN.md](./AI_INTEGRATION_PLAN.md)
2. **Code Cleanup**
   - Remove unused PowerShell scripts or move to `/scripts`
   - Clean up Lambda permissions (remove orphaned wrong-account statements)
3. **Lambda permission tightening** — replace broad `apigateway-all-methods` with least-privilege ARNs

---

## Historical Issues & Resolutions
