# Project Jumpstart Guide - Materials Selection App

This document is intended to be placed alone in a new empty folder and opened in VS Code. Use it as the single source for initiating a new Materials Selection App project with Copilot. It assumes the developer already completed the environment setup guide.

## 1. How to Use This Document

1. Create a new empty folder.
2. Copy this file into the folder.
3. Open the folder in VS Code.
4. Tell Copilot to read this file and help you start the project.

## 2. Recommended Copilot Prompts (Start Here)

### Prompt A - Project bootstrap

"Read PROJECT_JUMPSTART_GUIDE.md and propose a complete project plan with milestones, then outline the repository structure and initial tasks for week 1. Keep it small but production-ready."

### Prompt B - Architecture and stack

"Based on PROJECT_JUMPSTART_GUIDE.md, propose a scalable architecture and the initial minimal architecture that we can ship quickly. Include frontend, backend, and infrastructure."

### Prompt C - Build the first slice

"Using PROJECT_JUMPSTART_GUIDE.md, generate the initial code scaffolding for a React + TypeScript frontend and AWS serverless backend with basic CRUD for Projects."

### Prompt D - Guardrails

"Using PROJECT_JUMPSTART_GUIDE.md, list the top 10 risks and how to avoid them while building this app."

## 3. Target App Summary (High Level)

We are building a Materials Selection App for construction projects. It replaces spreadsheet workflows with a web UI. Core entities:

- Projects
- Categories (sections within projects)
- Line Items (materials/products in categories)
- Products
- Vendors
- Manufacturers
- Product-Vendor relationships (pricing and primary vendor)

Key requirements:

- Fast, simple CRUD flows
- Excel-like tracking fields (budget vs cost, status, dates, notes)
- Scalable data model for future features (orders, receipts, AI, document management)

## 4. Architecture (Robust and Scalable, but Iterative)

### Long-Term Target

- Frontend: React + TypeScript + Vite
- Backend: AWS Lambda (Node.js 20.x) + API Gateway
- Database: DynamoDB
- Hosting: S3 + CloudFront
- Optional: Bedrock for AI, SharePoint for documents, Salesforce integration

### Minimal First Release

- Frontend: React + TypeScript + Vite
- Backend: One Lambda with all CRUD routes
- Database: DynamoDB tables for Projects, Categories, LineItems, Vendors, Manufacturers, Products

### Why this works

- Serverless is low-cost and scales automatically
- One Lambda keeps deployment simple early on
- DynamoDB handles growth without schema migrations

## 5. Development Approach

### Phase 1: Core CRUD

1. Projects CRUD
2. Categories CRUD
3. Line Items CRUD
4. Vendors + Manufacturers CRUD
5. Products CRUD
6. Product-Vendor relationships

### Phase 2: UX and Workflow Enhancements

- Status workflow and tracking fields
- Vendor and product filtering
- Bulk import (CSV)
- PowerPoint export (client-side)

### Phase 3: Integrations and Intelligence

- SharePoint document folders
- Salesforce opportunity import
- AI chat and recommendations

## 6. Repository Setup and Git Workflow

### Initial setup

- Create repo in GitHub
- Initialize with README.md, .gitignore, MIT or internal license

### Commit strategy (important)

- Commit small logical units
- Example:
  - "feat: add projects CRUD"
  - "feat: add categories CRUD"
  - "fix: update line item update logic"

### Push frequency

- Push after each working milestone
- Never keep large unpushed changes for multiple days

### Branching (simple)

- main = stable
- feature/\* branches for larger changes

## 7. UI Design and Styling Guidance

### Goals

- Spreadsheet-inspired but modern
- Dense tables with clear data hierarchy
- Fast data entry

### Recommendations

- Use Tailwind CSS
- Keep tables compact (text-xs, minimal padding)
- Use badges for status and tier
- Use read-only fields for auto-populated values
- Always show cost with currency formatting

## 8. Lessons Learned (Avoid These Issues)

### 8.1 CORS and API Gateway

- CORS requires both method response and integration response
- Always test OPTIONS

### 8.2 DynamoDB Table Naming

- Use hyphen naming consistently: MaterialsSelection-TableName
- Avoid old underscore tables

### 8.3 Lambda Deployment

- Include node_modules in the zip
- Use a deployment checklist

### 8.4 Line Item Updates

- Use UpdateCommand for partial updates
- Treat null as REMOVE and undefined as "no change"

### 8.5 Product-Vendor Relationship

- Many-to-many requires junction table
- Primary vendor logic should be enforced in backend

## 9. Suggested Documentation to Create Early

- DEVELOPMENT_STATUS.md
- DEPLOYMENT-CHECKLIST.md
- FIELD-ADDITION-CHECKLIST.md
- SESSION_SUMMARY_YYYY-MM-DD.md

## 10. First Implementation Checklist

- [ ] Initialize repo
- [ ] Scaffold React + TypeScript + Vite
- [ ] Create DynamoDB tables
- [ ] Build Lambda with Projects CRUD
- [ ] Connect frontend to API
- [ ] Deploy frontend to S3
- [ ] Add Categories CRUD
- [ ] Add Line Items CRUD
- [ ] Add Vendors and Manufacturers
- [ ] Add Products
- [ ] Add Product-Vendor relationships

## 11. Quick Reference: Feature Priorities

1. Projects, Categories, Line Items
2. Vendor and Manufacturer management
3. Products and Product-Vendor relationships
4. UX polish, exports, bulk import
5. Integrations (SharePoint, Salesforce)
6. AI features

## 12. Junior Step-by-Step Plan (With Time Estimates)

This is a guided plan for a newer developer. It prioritizes small, testable steps and frequent commits.

### Day 0 - Project Kickoff (1-2 hours)

1. Create a GitHub repo and clone it locally.
2. Initialize the project with Vite + React + TypeScript.
3. Run `npm run dev` and confirm the app loads.
4. Commit: "chore: initial project scaffold".

### Day 1 - Projects CRUD (4-6 hours)

1. Define Project types and API service layer.
2. Build Project list page and Create/Edit modal.
3. Implement backend Lambda routes for Projects.
4. Test Create, Edit, Delete locally.
5. Commit: "feat: projects CRUD".

### Day 2 - Categories CRUD (4-6 hours)

1. Add Category types and services.
2. Add Category list per project.
3. Implement backend Category routes.
4. Test end-to-end with a sample project.
5. Commit: "feat: categories CRUD".

### Day 3 - Line Items CRUD (6-8 hours)

1. Add LineItem types and services.
2. Implement line item list per category.
3. Implement backend LineItem routes.
4. Add basic fields: name, material, quantity, unit, unitCost.
5. Commit: "feat: line items CRUD".

### Day 4 - Vendors + Manufacturers (4-6 hours)

1. Add Vendor and Manufacturer entities.
2. Build list + form pages.
3. Implement backend routes for both.
4. Seed small sample data.
5. Commit: "feat: vendors and manufacturers".

### Day 5 - Products + Product-Vendors (6-8 hours)

1. Add Product entity.
2. Build product list + form.
3. Implement ProductVendor junction table and routes.
4. Add vendor association UI (primary vendor logic).
5. Commit: "feat: products and product-vendors".

### Day 6 - Polish and First Deployment (3-5 hours)

1. Add compact table styling and validation.
2. Add error banners and loading states.
3. Deploy to S3 + CloudFront.
4. Test in production.
5. Commit: "chore: deploy and polish".

## 13. Junior Guidance Notes

### Keep Changes Small

- Do not add multiple major features in one commit.
- If something breaks, revert quickly and isolate the issue.

### Always Test the Flow You Changed

- After any CRUD change, test Create, Edit, Delete.
- If you touched API routes, test in Postman or curl.

### Ask for Review Early

- If you are unsure, open a PR early.
- Ask for feedback before large refactors.

## 14. Junior Step-by-Step (Detailed, With Commands and Files)

This section is a prescriptive checklist with exact commands and file targets. Follow it line by line.

### 14.1 Repo and Frontend Scaffold

1. Create the repo in GitHub.
2. Clone and scaffold:

```bash
git clone <repo-url>
cd <repo-folder>
npm create vite@latest web-frontend -- --template react-ts
cd web-frontend
npm install
npm run dev
```

3. Verify local app opens at http://localhost:5173
4. Commit:

```bash
git add .
git commit -m "chore: initial react app"
git push origin main
```

### 14.2 Frontend Structure (Create These Folders)

Inside web-frontend/src:

- components/
- services/
- types/

### 14.3 Backend Skeleton (One Lambda)

Create a new folder at repo root:

- lambda/

Add these files:

- lambda/index.js
- lambda/package.json

Start with a simple handler that returns OK and CORS headers.

Commit:

```bash
git add lambda
git commit -m "chore: add lambda skeleton"
```

### 14.4 DynamoDB Tables (Manual Setup)

Create tables in AWS (names must be hyphenated):

- MaterialsSelection-Projects
- MaterialsSelection-Categories
- MaterialsSelection-LineItems
- MaterialsSelection-Vendors
- MaterialsSelection-Manufacturers
- MaterialsSelection-Products

Add GSIs:

- Categories: ProjectIdIndex (partition key: projectId)
- LineItems: CategoryIdIndex (partition key: categoryId)
- LineItems: ProjectIdIndex (partition key: projectId)
- Products: ManufacturerIdIndex (partition key: manufacturerId)

Document table names in a local docs/DEVELOPMENT_STATUS.md.

### 14.5 Projects CRUD (First Feature Slice)

1. Add types:
   - src/types/index.ts
   - Project interface
   - CreateProjectRequest and UpdateProjectRequest
2. Add service:
   - src/services/projectService.ts
3. Add UI:
   - src/components/ProjectList.tsx
   - src/components/ProjectForm.tsx
4. Wire routes in src/App.tsx
5. Add Lambda routes in lambda/index.js:
   - GET /projects
   - GET /projects/{id}
   - POST /projects
   - PUT /projects/{id}
   - DELETE /projects/{id}

Test:

```bash
npm run dev
```

Commit:

```bash
git add src lambda
git commit -m "feat: projects CRUD"
```

### 14.6 Categories CRUD

Files to touch:

- src/types/index.ts
- src/services/categoryService.ts
- src/components/CategoryList.tsx
- src/components/CategoryForm.tsx
- lambda/index.js (categories routes)

Add endpoints:

- GET /projects/{projectId}/categories
- GET /categories/{id}
- POST /categories
- PUT /categories/{id}
- DELETE /categories/{id}

Commit: "feat: categories CRUD".

### 14.7 Line Items CRUD

Files to touch:

- src/types/index.ts
- src/services/lineItemService.ts
- src/components/CategoryDetail.tsx
- src/components/LineItemForm.tsx
- lambda/index.js

Endpoints:

- GET /categories/{categoryId}/lineitems
- GET /projects/{projectId}/lineitems
- GET /lineitems/{id}
- POST /lineitems
- PUT /lineitems/{id}
- DELETE /lineitems/{id}

Commit: "feat: line items CRUD".

### 14.8 Vendors and Manufacturers

Add in this order:

1. Types: Vendor, Manufacturer
2. Services: vendorService.ts, manufacturerService.ts
3. UI: VendorList.tsx, VendorForm.tsx, ManufacturerList.tsx, ManufacturerForm.tsx
4. Lambda routes: /vendors and /manufacturers

Commit: "feat: vendors and manufacturers".

### 14.9 Products and Product-Vendors

Products:

- Types: Product
- Service: productService.ts
- UI: ProductList.tsx, ProductForm.tsx
- Lambda: /products and /manufacturers/{manufacturerId}/products

Product-Vendors:

- Types: ProductVendor
- Service: productVendorService.ts
- Lambda: /product-vendors and /products/{productId}/vendors
- UI: vendor association modal inside ProductList

Commit: "feat: products and product-vendors".

### 14.10 Frontend Deploy (First Time)

```bash
npm run build
aws s3 sync dist/ s3://<your-bucket> --delete
aws cloudfront create-invalidation --distribution-id <your-distribution> --paths "/*"
```

Commit: "chore: first production deploy".

### 14.11 Suggested File Layout (Reference)

```
src/
  components/
    ProjectList.tsx
    ProjectForm.tsx
    CategoryList.tsx
    CategoryForm.tsx
    CategoryDetail.tsx
    LineItemForm.tsx
    VendorList.tsx
    VendorForm.tsx
    ManufacturerList.tsx
    ManufacturerForm.tsx
    ProductList.tsx
    ProductForm.tsx
  services/
    api.ts
    projectService.ts
    categoryService.ts
    lineItemService.ts
    vendorService.ts
    manufacturerService.ts
    productService.ts
    productVendorService.ts
  types/
    index.ts
lambda/
  index.js
  package.json
docs/
  DEVELOPMENT_STATUS.md
  DEPLOYMENT-CHECKLIST.md
  FIELD-ADDITION-CHECKLIST.md
```

---
