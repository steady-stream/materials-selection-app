# Materials Selection App - Development Status

**Last Updated:** March 4, 2026  
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

✅ **Working — Production environment (AWS account 860601623272):**

- All of the above, independently deployed

⚠️ **Known Issues:**

- None currently

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

| Hash | Description |
| ---- | ----------- |
| TBD  | Upgrade Lambda runtime from nodejs20.x to nodejs22.x |

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
