# Development Environment Setup - Materials Selection App

This guide helps a new developer replicate the current local and cloud setup used for the Materials Selection App. It includes required tools, accounts, configuration steps, and common commands.

## 1. Hardware and OS

- Windows 11 or macOS 13+ recommended
- 16 GB RAM minimum (32 GB preferred)
- Node projects with local builds and AWS tooling

## 2. Required Accounts and Access

### 2.1 GitHub (Required)

- Access to the repository (owner must grant access)
- SSH key or personal access token (PAT)
- Used for source control and GitHub Copilot for VS Code

### 2.2 AWS (Required)

- AWS account with IAM user or role access
- Required services:
  - Lambda
  - API Gateway
  - DynamoDB
  - S3
  - CloudFront
  - ACM
  - IAM
  - CloudWatch Logs
  - Bedrock (if AI features are used)
  - OpenSearch Serverless (Knowledge Base RAG)
- Prefer IAM user with least-privilege policy scoped to this project
- Root account should not be used for daily development

### 2.3 Microsoft 365 / Azure AD (Optional, for SharePoint integration)

- Microsoft 365 admin access
- Azure AD app registration permissions
- Required only if SharePoint integration is enabled

### 2.4 Salesforce (Optional)

- Salesforce user with API access
- OAuth app credentials for the Salesforce Lambda

## 3. Required Local Tools

### 3.1 Core Tools

- VS Code (latest stable)
- Git (latest)
- Node.js 20.x (matches Lambda runtime)
- npm 10+ (bundled with Node.js)
- Python 3.11+ (for data scripts)
- AWS CLI v2

### 3.2 Recommended VS Code Extensions

- GitHub Copilot (GitHub subscription required)
- GitHub Copilot Chat (GitHub subscription required)
- ESLint
- Prettier - Code formatter (optional; only if you want local formatting)
- Tailwind CSS IntelliSense
- AWS Toolkit (optional but useful)
- PowerShell (Windows) or Bash extension (optional)

## 4. GitHub Copilot Clarification

There are two different Copilot products:

1. GitHub Copilot for VS Code
   - This is what is used for this project.
   - It requires a GitHub Copilot subscription (individual, business, or enterprise).
   - It is tied to a GitHub account, not a Microsoft 365 account.

2. Microsoft 365 Copilot
   - This is not the same product.
   - It does not provide coding assistance inside VS Code.
   - It cannot replace GitHub Copilot for this development workflow.

If the developer only has Microsoft 365 Copilot, they will NOT get the same VS Code experience. They will need GitHub Copilot (individual or business) linked to their GitHub account.

## 5. Repository Setup

### 5.1 Clone the repo

```bash
git clone <repo-url>
cd WebPrototype
```

### 5.2 Install dependencies

```bash
npm install
```

### 5.3 Run locally

```bash
npm run dev
```

Default local URL: http://localhost:5173

## 6. Environment Variables

Create a `.env.local` file (frontend):

```
VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
VITE_SF_API_URL=https://<salesforce-api-id>.execute-api.us-east-1.amazonaws.com/prod
```

Only `VITE_API_BASE_URL` is required for normal app usage. `VITE_SF_API_URL` is required if Salesforce integration is enabled.

## 7. AWS Configuration

### 7.1 Configure AWS CLI

```bash
aws configure
```

Required values:

- Access key ID
- Secret access key
- Default region: `us-east-1`

### 7.2 Key AWS Resource IDs (current)

- S3 bucket: `materials-selection-app-7525`
- CloudFront distribution: `E2CO2DGE8F4YUE`
- API Gateway: `xrld1hq3e2`
- Lambda: `MaterialsSelection-API`

### 7.3 Common AWS Commands

Deploy frontend:

```bash
npm run build
aws s3 sync dist/ s3://materials-selection-app-7525 --delete
aws cloudfront create-invalidation --distribution-id E2CO2DGE8F4YUE --paths "/*"
```

Deploy Lambda (manual zip, see lambda/DEPLOYMENT-CHECKLIST.md):

```powershell
cd lambda\deploy
Compress-Archive -Path index.js,package.json,package-lock.json,sharepointService.js,node_modules -DestinationPath ..\lambda-deploy.zip -Force
```

Then upload in AWS Lambda Console.

## 8. Optional Integrations

### 8.1 SharePoint Integration

Requires Azure AD app registration and environment variables:

- AZURE_TENANT_ID
- AZURE_CLIENT_ID
- AZURE_CLIENT_SECRET
- SHAREPOINT_SITE_URL
- SHAREPOINT_LIBRARY
- SHAREPOINT_BASE_FOLDER

See: docs/AZURE_AD_SETUP_GUIDE.md and docs/SHAREPOINT_INTEGRATION_PLAN.md

### 8.2 Salesforce Integration Lambda

Separate Lambda in `lambda-salesforce/` with its own deployment and env vars:

- SF_CLIENT_ID
- SF_CLIENT_SECRET
- SF_USERNAME
- SF_PASSWORD
- SF_AUTH_URL
- SF_INSTANCE_URL

See: lambda-salesforce/README.md

### 8.3 AI Features (Bedrock)

If AI features are enabled:

- Bedrock access (us-east-1)
- Knowledge Base ID and S3 bucket for documents
- Lambda dependencies for Bedrock SDK

See: AI_STATUS.md and docs/AI_INTEGRATION_PLAN.md

## 9. Suggested Local Settings

- Node version: 20.x (align with Lambda)
- npm: latest
- Git config: user.name and user.email configured

## 10. Quick Troubleshooting

- If local build fails: run `npm install` again
- If CORS errors occur: check API Gateway OPTIONS and Lambda headers
- If CloudFront changes do not show: hard refresh and ensure invalidation completed

## 11. Key Docs to Read

- README.md
- QUICK-REFERENCE.md
- docs/DEVELOPMENT_STATUS.md
- docs/DEPLOYMENT-CHECKLIST.md
- docs/FIELD-ADDITION-CHECKLIST.md
- AI_STATUS.md (if AI features are relevant)

---

If you want this customized for a specific developer role (frontend-only, backend-only, or full-stack), say which role and I will tailor it.
