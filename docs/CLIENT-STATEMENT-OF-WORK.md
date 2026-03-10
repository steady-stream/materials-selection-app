# MegaPros Materials Selection App

## Statement of Work — Delivered Features

**Prepared for:** MegaPros  
**Prepared by:** APIA Consulting  
**Date:** March 10, 2026  
**Application URL (Test):** https://mpmaterials.apiaconsulting.com

---

## Overview

The MegaPros Materials Selection App is a cloud-hosted web application purpose-built to replace the Excel-based workflow currently used to track materials, products, vendors, and project budgets for residential renovation projects. The application provides a fully integrated system covering product catalog management, project tracking, vendor coordination, purchase order management, customer-facing materials presentations, document storage, and AI-assisted project support.

---

## Phase 1 — Work Completed Prior to Client Review Meeting (February 6, 2026)

### 1.1 Project Management

- **Create and manage projects** with all relevant details: project name, customer name and contact information (phone, email, mobile, preferred contact method), project type (bath, kitchen, shower, roof, deck, siding, windows, doors, flooring, basement, deck, other), project status tracking (planning, in-progress, on-hold, completed), project number, and address.
- **Project list view** with sortable columns (name, type, status, customer) and a compact, information-dense table layout.
- **Project detail view** showing all project information in a header with all management functions accessible from a single screen.

### 1.2 Project Budget & Line Item Tracking

This is the core feature replacing the Excel spreadsheets. For each project, the system supports:

- **Sections (Categories)** — Group line items by area of the project (Kitchen, Master Bath, Flooring, etc.) with a per-section allowance/budget.
- **Line items** within each section — each line item tracks:
  - Item name/description
  - Material type
  - Quantity and unit of measure
  - Unit cost and calculated total cost
  - Allowance (budget target) with automatic over-budget visual warning
  - Vendor
  - Manufacturer
  - Model number
  - Ordered date and received date
  - Staging location (e.g., Garage, Basement)
  - Return notes
  - **Status tracking:** Pending → Selected → Final → Ordered → Received → Installed
- **Section budget summaries** — visual rollup of actual vs. allowance per section.
- **Inline editing** — edit most line item fields directly in the table row without opening a separate form.

### 1.3 Product Catalog

- **Centralized product catalog** with full CRUD management (create, read, update, delete).
- Each product record includes: name, description, model number, manufacturer, category, unit of measure, and product image URL.
- **Filter products** by manufacturer, vendor, or category.
- **Search** across product names, descriptions, and model numbers.

### 1.4 Vendor Management

- **Vendor master list** — maintain all vendor records with name, contact information, and website.
- **Product–Vendor Relationships** — associate multiple vendors with each product, each with their own cost per unit.
- Designate a **primary vendor** per product; primary vendor and price auto-populate when a product is selected on a line item.
- Vendor management modal on the product catalog — add/remove vendors per product, set costs, toggle primary designation.

### 1.5 Manufacturer Management

- **Manufacturer master list** with name and website.
- Manufacturer information flows through to product records and line items.

### 1.6 Line Item Options (Good / Better / Best)

- Attach **product alternatives** to any line item — allowing the selection team to present the client with multiple options (e.g., Good / Better / Best choices).
- Options modal shows side-by-side product comparison with images, pricing, and specifications.
- Visual indicator on line items that have pending (unreviewed) options.

### 1.7 AI Chat Assistant

Two modes of AI support are embedded directly in every project:

- **Project Assistant** — answers natural language questions about the current project: "What's the total budget for the kitchen?", "Which items are still pending?", "What vendor did we use for tile?" Powered by Amazon Bedrock (Nova Micro model) with full project context loaded from the database.
- **Document Search** — semantic search across project specification documents uploaded to the knowledge base. Returns answers with citations to the source document. Powered by Amazon Bedrock Knowledge Bases with OpenSearch vector search.

### 1.8 PowerPoint Export

- Generate a professional **materials selection presentation** directly from any project with one click.
- Each exported deck includes:
  - **Cover slide** — project name, customer info, MegaPros logo, selector contact details.
  - **Section divider slides** — one per project section with budget allocation.
  - **Product detail slides** — one per line item showing product name, description, model number, manufacturer, vendor, quantity, pricing, product image, and a clickable URL.
  - **Options slides** — when a line item has Good/Better/Best alternatives, each option gets its own slide labeled "Option 1", "Option 2", etc.
  - **Final status logic** — line items marked "Final" show only the selected product.
- Styling matches MegaPros branded sample presentations (Calibri fonts, blue color scheme).
- File downloads automatically named `{ProjectName}_Materials_Selection.pptx`.

### 1.9 Purchase Order Management

- **Create purchase orders** assigned to a vendor within a project.
- **Order items** link specific line items to the order with quantities and pricing.
- **Receive orders** — record received dates per order and per item.
- **Receipt tracking** — track what was received, when, and in what quantity.

### 1.10 Infrastructure & Security

- **Hosted on AWS** — scalable, pay-per-use serverless infrastructure (Lambda, DynamoDB, API Gateway, S3, CloudFront).
- **Custom domain** — https://mpmaterials.apiaconsulting.com with SSL certificate.
- **Cognito authentication** — secure login with session persistence. Passwords managed through AWS Cognito with first-login new-password challenge support.
- **Protected routes** — all pages require authentication; unauthenticated users are redirected to login.

---

## Phase 2 — Work Completed After Client Review Meeting (February 6, 2026)

### 2.1 Salesforce Integration

- **Create projects directly from Salesforce Opportunities** — a "Use Salesforce" toggle on the New Project form pulls a live list of open opportunities from Salesforce CRM.
- Selecting an opportunity auto-populates the project name, customer name, and links the project to the Salesforce opportunity ID.
- Enables bi-directional traceability between the materials selection workflow and the CRM sales record.

### 2.2 SharePoint Document Integration

The application integrates with the MegaPros SharePoint environment (apiaconsulting.sharepoint.com / MegaPros360 site) for project document storage.

#### Link a SharePoint Folder to a Project

- Any project can be linked to a specific SharePoint folder using the **Link SharePoint** button on the Project Detail page.
- The modal displays the target SharePoint site, document library, and base folder for reference.
- **Browse existing folders** — lists all folders in the configured base directory; click **Link** to associate any existing folder with the project.
- **Folder navigation** — navigate into subfolders (with breadcrumb trail) to find the right folder deeper in the hierarchy.
- **Search/filter** — filter the folder list by name.
- **Create a new folder** — enter a name and create a new folder in the current location without automatically linking; then choose to Link it or continue browsing.

#### Project Documents Modal

- Once linked, the **Documents** button opens a document viewer showing all files in the linked SharePoint folder.
- Displays the full SharePoint folder path below the modal title for clear context.
- **Upload files** from your local computer directly into the SharePoint folder (up to 4 MB per file).
- **Delete files** from the SharePoint folder.
- Files are stored and versioned in SharePoint; the app provides a direct interface to the folder without requiring users to navigate to SharePoint separately.

### 2.3 Production Environment

- **Fully independent production environment** deployed to a separate AWS account (860601623272) for data isolation and security.
- **Dual-environment deployment pipeline** — changes are deployed to the test environment first for verification, then promoted to production. Scripts handle all environment variable switching automatically — no manual error-prone steps.
- **Lambda Node.js runtime upgraded** from Node.js 20 to Node.js 22 across both environments ahead of the AWS deprecation date (April 2026).

### 2.4 Backend Reliability Improvements

- **Lambda architecture refactored** from a single monolithic function into five domain-specific Lambda functions, reducing deployment size and eliminating risk of one domain's changes affecting another:
  - Projects API
  - Core API (categories, line items, options)
  - Catalog API (vendors, manufacturers, products)
  - Orders API
  - AI API
- **Error response CORS fix** — AWS API Gateway error responses (4xx/5xx) now correctly include CORS headers, preventing misleading "CORS error" messages in the browser when the real issue is a server error.
- **4 MB file upload guard** — clear user-facing error message when a file exceeds the upload limit, rather than a cryptic network error.

### 2.5 UX Improvements (Post-Review)

- **Allowance field** increment changed from $0.01 to $1.00 for practical usability when entering budget amounts.
- **SharePoint modal styling** updated to match the visual design of all other modals in the application (consistent font sizes, borders, spacing).
- **Project Documents modal** displays the full linked SharePoint folder URL below the title for transparency.

---

## Technical Summary

| Component      | Technology                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS                                    |
| Backend        | AWS Lambda (Node.js 22), API Gateway                                        |
| Database       | AWS DynamoDB (10 tables)                                                    |
| Hosting        | AWS S3 + CloudFront                                                         |
| Authentication | AWS Cognito                                                                 |
| AI             | Amazon Bedrock (Nova Micro), Bedrock Knowledge Bases, OpenSearch Serverless |
| Documents      | Microsoft SharePoint / Microsoft Graph API                                  |
| CRM            | Salesforce (REST API)                                                       |
| Presentations  | pptxgenjs (client-side PowerPoint generation)                               |
| Source Control | GitHub                                                                      |

### Test Environment

- URL: https://mpmaterials.apiaconsulting.com
- AWS Account: 634752426026

### Production Environment

- URL: https://d377ynyh0ngsji.cloudfront.net
- AWS Account: 860601623272

---

_This document describes functionality delivered and available in the test environment as of March 10, 2026. Production deployment of SharePoint features is pending production API Gateway configuration._
