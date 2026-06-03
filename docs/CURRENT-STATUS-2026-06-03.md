# Materials Selection App - Current Status (Canonical)

Last updated: 2026-06-03 (evening)
Owner: APIA Consulting
Scope: WebPrototype repository state + latest handoff/deploy evidence

---

## Source of Truth

This document supersedes older deployment snapshots.

Primary evidence used:

- docs/EOD-HANDOFF-2026-05-25.md
- docs/SESSION-HANDOFF-2026-05-25.md
- docs/RECOVERY-SESSION-HANDOFF-2026-05-25.md
- docs/RECOVERY-QUICK-RESTART-2026-05-25.md
- docs/DEVELOPMENT_STATUS.md
- deploy-lambda-log.txt
- Active deploy scripts in repo root

---

## Environment Summary

### Test Environment

- URL: https://mpmaterials.apiaconsulting.com
- AWS account: 634752426026
- API Gateway REST API: xrld1hq3e2 (stage: prod)
- CloudFront: E2CO2DGE8F4YUE
- S3 bucket: materials-selection-app-7525
- AWS profile: megapros-test

### Production Environment

- URL: https://d377ynyh0ngsji.cloudfront.net
- AWS account: 860601623272
- API Gateway REST API: 6extgb87v1 (stage: prod)
- CloudFront: E2PTMMBR8VRR3W
- S3 bucket: materials-selection-prod-3039
- AWS profile: megapros-prod

---

## Architecture Snapshot

### Frontend

- React 19 + TypeScript + Vite 7 + Tailwind CSS v4
- React Router 7
- Cognito-based login/session flow enabled in UI

### Backend

- Split Lambda architecture in place:
  - MaterialsSelection-Projects-API
  - MaterialsSelection-Core-API
  - MaterialsSelection-Catalog-API
  - MaterialsSelection-Orders-API
  - MaterialsSelection-AI-API
- Legacy monolith lambda code still exists in repo for parity/fallback workflows.

### Data/Integrations

- DynamoDB domain tables active for projects, catalog, line items, orders, options, shares
- Salesforce opportunity integration active
- SharePoint integration active in test workflow (MegaPros360 site)
- Bedrock AI chat + document search integrated

---

## Delivery Status

### Release update (2026-06-03 evening)

- Production incident fixed: add-product failures traced to missing DynamoDB table `MaterialsSelection-ProductVariations` in prod account.
- Created missing production table and GSI:
  - Table: `MaterialsSelection-ProductVariations`
  - GSI: `ProductIdIndex`
- Post-fix validation completed in production:
  - Product create endpoint returned `201`
  - Temporary debug record cleanup returned `204`
- Salesforce Opportunity filtering UX refinement promoted:
  - Stage filter switched to single-select in selection modals
  - Opportunity name search repositioned below filter/apply row
- Product catalog UX refinement promoted:
  - Main list now exposes multiple variation image links (not only first variation image)
  - Hover detail no longer shows misleading first-variation color/finish for multi-variation products
  - Hover detail links removed (non-interactive hover behavior)
- Deployment evidence:
  - Test deploy invalidations: `I3TLVAPT1XUMA8789WM7OE3MW0`, `IBRW2CDG7GIJG7N4NQ4URKF88J`
  - Production deploy invalidations: `I3FHAEH7YZ60M5TRA3FFPSB2EU`, `I62M8GSHPXAH693Z29PKDYDPUO`
  - Production URL verified after release: https://d377ynyh0ngsji.cloudfront.net

### Completed and deployed (latest confirmed)

- Product catalog variations implementation across backend + frontend contracts
- Product maintenance UX updates for variation editing/validation
- Project insert-product variation visibility behavior
- Salesforce opportunity selection now supports server-side Selection Coordinator flag filtering, server-side stage filtering, and client-side opportunity name search in the selection modal
- Frontend test deploy completed
- Lambda deployment completed after network reconnect (see deploy-lambda-log.txt)

### Previously completed (from April baseline)

- Client feedback set P1-P8 and L1-L5 implemented
- Product finish field full-stack support
- Product image upload (presigned URL flow)
- Branding updates
- Split-lambda migration to production completed

---

## Known Gaps / Risks

- Production API Gateway route parity still has a documented gap for some orders/files/sharepoint routes.
- Frontend API auth header injection is currently disabled in src/services/api.ts (token interceptor commented).
- Historical docs contain obsolete endpoints, domains, runtime notes, and deployment instructions.

---

## Operational Deployment Scripts

Primary scripts currently used:

- deploy-test.ps1
- deploy-prod.ps1
- deploy-new-lambdas.ps1
- build-and-deploy-lambdas.ps1
- migrate-prod-lambdas.ps1

Legacy/one-off script still present:

- deploy-lambda-test.ps1 (monolith update path)

---

## Documentation Policy

- Treat this file as the canonical status entry until replaced by a newer CURRENT-STATUS file.
- Historical docs marked "STALE/HISTORICAL" are retained for audit trail only.
- Before release decisions, validate against scripts and live AWS resources, not historical markdown snapshots.
