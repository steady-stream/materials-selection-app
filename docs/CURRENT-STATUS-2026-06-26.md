# Materials Selection App - Current Status (Canonical)

Last updated: 2026-06-26
Owner: APIA Consulting
Scope: Post-regression stabilization, test/prod parity reconciliation, and functional smoke verification

---

## Source of Truth

This document supersedes prior CURRENT-STATUS snapshots.

Primary evidence:

- docs/CURRENT-STATUS-2026-06-24.md
- Live API Gateway route/method inventory checks (test + prod)
- Live Lambda code hash parity checks (test + prod)
- Read-only smoke test runs executed on 2026-06-26

---

## Environment Summary

### Test Environment

- URL: https://mpmaterials.apiaconsulting.com
- AWS account: 634752426026
- API Gateway REST API: xrld1hq3e2 (stage: prod)
- AWS profile: megapros-test

### Production Environment

- URL: https://d377ynyh0ngsji.cloudfront.net
- AWS account: 860601623272
- API Gateway REST API: 6extgb87v1 (stage: prod)
- AWS profile: megapros-prod

---

## Stabilization Outcome (2026-06-26)

System is at a stable checkpoint.

### 1. API Gateway Parity Restored

Production and test now match for non-SharePoint/non-files routes and methods.

Remaining intentional test-only routes:

- /projects/{projectId}/files
- /projects/{projectId}/files/{fileId}
- /projects/{projectId}/files/upload
- /projects/{projectId}/sharepoint/folders
- /projects/{projectId}/sharepoint/link
- /sharepoint/config

No other route/method mismatches remain.

### 2. Batch Endpoint Stability Restored

Batch endpoint set is present in both environments:

- /batch/products
- /batch/vendors
- /batch/manufacturers
- /batch/lineitem-options
- /batch/lineitem-options/by-lineitem-ids

A production preflight issue on /batch/lineitem-options/by-lineitem-ids was resolved during stabilization and reverified.

### 3. Lambda Code Parity Restored

Code hash parity is aligned across split domain lambdas in test and production:

- MaterialsSelection-Projects-API
- MaterialsSelection-Core-API
- MaterialsSelection-Catalog-API
- MaterialsSelection-Orders-API
- MaterialsSelection-AI-API

---

## Read-Only Smoke Verification (2026-06-26)

No fixes were applied during smoke validation. This was verification-only.

### Transport/Availability Smoke

Both test and production passed:

- Frontend root availability
- GET /projects
- GET /salesforce/opportunities
- OPTIONS preflight on critical batch endpoints
- Validation behavior on POST batch endpoints with empty payload (expected 400)

### Functional Workflow Smoke

Both test and production passed:

- GET /projects (project list)
- GET /projects/{id}/lineitems
- GET /projects/{id}/lineitem-options
- GET /projects/{id}/orders
- GET /projects/{id}/receipts
- POST /batch/lineitem-options/by-lineitem-ids with valid payload
- POST /batch/products with valid payload
- GET /salesforce/opportunities
- GET /salesforce/opportunities/{id}

Salesforce list/detail flow confirmed healthy in both environments, including availability of opportunity Id, Name, and StageName in sampled responses.

---

## Operational Notes

- This checkpoint intentionally avoids introducing new application behavior.
- A docs-only git commit was created to mark the stabilization state.
- There are still unrelated local working-tree changes in this repository outside this status checkpoint.

---

## Documentation Policy

- Treat this file as canonical status until replaced by a newer dated CURRENT-STATUS document.
- Keep docs/CURRENT-STATUS.md as a pointer to the newest dated file.
- For release decisions, prefer live verification evidence over historical narrative docs.
