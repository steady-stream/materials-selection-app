# Materials Selection App - Current Status (Canonical)

Last updated: 2026-06-24
Owner: APIA Consulting
Scope: WebPrototype repository status, production/test parity, and latest deployment verification

---

## Source of Truth

This document supersedes prior CURRENT-STATUS snapshots.

Primary supporting evidence in repo and session history:

- docs/CURRENT-STATUS-2026-06-03.md
- migrate-prod-lambdas.ps1
- lambda/core/index.js
- lambda/orders/index.js
- src/components/ProjectDetail.tsx
- src/services/orderService.ts
- src/services/lineItemOptionService.ts
- src/services/productVendorService.ts

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

## Architecture Snapshot

### Frontend

- React + TypeScript + Vite + Tailwind
- Project detail page data loading now optimized for high record counts:
  - Bulk-oriented fetch path with graceful fallback when environment routes lag
  - Memoized lookup maps for options, category totals, order linkage, and receipts
  - Runtime TDZ regression fixed by moving sort helper before memo usage

### Backend

- Split Lambda architecture remains active:
  - MaterialsSelection-Projects-API
  - MaterialsSelection-Core-API
  - MaterialsSelection-Catalog-API
  - MaterialsSelection-Orders-API
  - MaterialsSelection-AI-API
- New/updated API capabilities:
  - Core API: GET /projects/{projectId}/lineitem-options
  - Orders API: GET /projects/{projectId}/receipts
  - Orders API project-level item query optimized with parallel per-order queries

### Service Layer

- orderService migrated to shared API client (relative paths, env-consistent base URL)
- orderService supports project-level receipts endpoint
- lineItemOptionService supports project-level options endpoint
- productVendorService now includes getAll for bulk catalog relation loading

---

## Release Updates (2026-06-24)

### Performance and Reliability Work

- Project detail loading flow redesigned to reduce serial API latency and repeated render-time scans.
- Orders and order-items fetches are defensive and non-fatal in partial-route environments.
- Receipts and line-item options use project-level endpoints first, then fallback to per-entity requests.

### Production Incident Resolution

- Repeated "Project not Found" incidents traced to production API route parity gaps after shared-client normalization.
- Missing production route mappings were added and validated for Catalog and Orders domains.
- CORS preflight behavior validated with browser-like requests (Origin + Access-Control-Request-* headers).

### Route Parity Closure and Script Canonicalization

- migrate-prod-lambdas.ps1 updated to include full Orders route table for production rewiring:
  - /projects/{projectId}/orders (GET)
  - /projects/{projectId}/orderitems (GET)
  - /orders (POST)
  - /orders/{id} (GET/PUT/DELETE)
  - /orders/{id}/items (GET)
  - /orders/{id}/receipts (GET)
  - /orderitems (POST)
  - /orderitems/{id} (DELETE)
  - /receipts (POST)
  - /receipts/{id} (DELETE)
- Script output text updated to reflect current production state (orders routes are now present and managed).

### Deployment Verification

- Production migration script re-run completed successfully after updates.
- Step 2 integration rewiring summary: Updated 59, Skipped 0, Failed 0.
- Production API deployment completed: deployment ID mrig3d.
- Key project-level Orders endpoints return success in production.

---

## Current Risk Profile

### Closed

- Production/test route parity gap for core Orders routes in migration script.
- Frontend hard-failure behavior when optional project-level routes are unavailable.

### Remaining Monitoring Items

- Keep API Gateway CORS method/integration parity checks in release checklist for newly added routes.
- Consolidate one-off route/CORS helper scripts after parity is fully institutionalized in canonical migration scripts.

---

## Operational Scripts

Primary scripts:

- deploy-test.ps1
- deploy-prod.ps1
- deploy-new-lambdas.ps1
- build-and-deploy-lambdas.ps1
- migrate-prod-lambdas.ps1

One-off helper scripts generated during parity incident work:

- add-prod-orders-routes.ps1
- add-prod-orders-options.ps1
- add-prod-orders-cors-responses.ps1
- add-prod-orders-cors-ir.ps1

---

## Documentation Policy

- Treat this file as canonical status until replaced by a newer dated CURRENT-STATUS document.
- Keep docs/CURRENT-STATUS.md as a pointer to the newest dated file.
- For release decisions, prioritize script evidence and live environment verification over historical narrative docs.
