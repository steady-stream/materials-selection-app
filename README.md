# Materials Selection App

> STALE DOCUMENT NOTICE (2026-06-03)
>
> This README contains historical deployment and architecture details that are no longer authoritative.
> Use docs/CURRENT-STATUS-2026-06-03.md for current environment and deployment status.

A full-stack React + AWS serverless application for construction materials selection, tracking, and ordering. Built to replicate and enhance traditional Excel spreadsheet workflows with a modern web interface.

## 🚀 Quick Access

- **Production**: https://mpmaterials.apiaconsulting.com _(pending DNS)_
- **Development**: http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com
- **API**: https://fiad7hd58j.execute-api.us-east-1.amazonaws.com

## ✨ Features

### Core Functionality

- **Projects Management** - Create, view, edit, and delete construction projects
- **Categories** - Organize materials by categories (plumbing, electrical, flooring, etc.)
- **Line Items** - Track individual materials with comprehensive details

### Enhanced Tracking (v1.1)

- **Vendor Management** - Maintain vendor database with contact info
- **Manufacturer Tracking** - Track product manufacturers
- **Order Status Workflow** - Pending → Ordered → Received → Installed → Returned
- **Budget Tracking** - Allowance vs actual cost with over-budget warnings
- **Logistics** - Staging locations, delivery dates, return notes
- **Model Numbers** - Product model/SKU tracking

### Data Management

- 10 pre-loaded vendors (Ferguson, Home Depot, Menards, Lowes, Amazon, etc.)
- 8 pre-loaded manufacturers (Kohler, Moen, Delta, American Standard, etc.)
- Product catalog database (ready for population)

## 🏗️ Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite 7.2.5** (rolldown experimental)
- **Tailwind CSS v4** with @tailwindcss/postcss
- **React Router 7.13.0**
- **Axios 1.13.4**

### Backend (AWS Serverless)

- **AWS Lambda** (Node.js 20.x)
- **DynamoDB** (6 tables, pay-per-request)
- **API Gateway** (HTTP API)
- **CloudFront** (CDN + SSL)
- **ACM** (SSL certificate)

## 📁 Project Structure

```
src/
├── components/              # React components
│   ├── Layout.tsx          # App layout with navigation
│   ├── ProjectList.tsx     # List all projects
│   ├── ProjectForm.tsx     # Create/edit projects
│   ├── ProjectDetail.tsx   # View project with categories
│   ├── CategoryForm.tsx    # Create/edit categories
│   ├── CategoryDetail.tsx  # View category with line items
│   ├── LineItemForm.tsx    # ✨ Enhanced with tracking fields
│   ├── VendorList.tsx      # ✨ Vendor management
│   ├── VendorForm.tsx      # ✨ Create/edit vendors
│   ├── ManufacturerList.tsx # ✨ Manufacturer management
│   └── ManufacturerForm.tsx # ✨ Create/edit manufacturers
├── services/               # API service layer
│   ├── api.ts             # Axios configuration
│   ├── projectService.ts
│   ├── categoryService.ts
│   ├── lineItemService.ts
│   ├── vendorService.ts        # ✨ New
│   ├── manufacturerService.ts  # ✨ New
│   ├── productService.ts       # ✨ New
│   └── index.ts
├── types/                  # TypeScript type definitions
│   └── index.ts           # ✨ Enhanced with new entities
├── App.tsx                # Main app with routing
└── main.tsx              # Entry point

lambda/
├── index.js              # ✨ Enhanced Lambda with all CRUD routes
├── package.json
└── node_modules/

docs/
├── README.md                   # This file
├── DEPLOYMENT.md               # Initial deployment guide
├── ENHANCED-FEATURES.md        # ✨ Detailed feature documentation
├── CLOUDFRONT-SETUP.md         # ✨ CloudFront configuration
├── DEPLOYMENT-SUMMARY.md       # ✨ Complete deployment overview
└── QUICK-REFERENCE.md          # ✨ Quick command reference
```

## 🎯 Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure API endpoint**:
   - Copy `.env.example` to `.env.local`
   - Update `VITE_API_BASE_URL` with your AWS API Gateway URL:
     ```
     VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com
     ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## API Configuration

The app expects the following API endpoints:

### Projects

- `GET /projects` - List all projects
- `GET /projects/:id` - Get project by ID
- `POST /projects` - Create project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Categories

- `GET /projects/:projectId/categories` - List categories for project
- `GET /categories/:id` - Get category by ID
- `POST /categories` - Create category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

### Line Items

- `GET /categories/:categoryId/lineitems` - List line items for category
- `GET /projects/:projectId/lineitems` - List line items for project
- `GET /lineitems/:id` - Get line item by ID
- `POST /lineitems` - Create line item
- `PUT /lineitems/:id` - Update line item
- `DELETE /lineitems/:id` - Delete line item

## Development

The app uses Vite's hot module replacement (HMR) for fast development. Changes to source files will automatically reload in the browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Environment Variables

- `VITE_API_BASE_URL` - AWS API Gateway base URL (required)

## AWS Deployment

### Option 1: AWS Amplify (Recommended - Easiest)

AWS Amplify provides automatic builds, deployments, and HTTPS with minimal configuration.

1. **Install AWS Amplify CLI**:

   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Initialize Amplify in your project**:

   ```bash
   amplify init
   ```

3. **Add hosting**:

   ```bash
   amplify add hosting
   ```

   - Select "Hosting with Amplify Console"
   - Choose "Manual deployment"

4. **Configure environment variables** in Amplify Console:
   - Go to AWS Amplify Console
   - Select your app → Environment variables
   - Add `VITE_API_BASE_URL` with your API Gateway URL

5. **Deploy**:
   ```bash
   amplify publish
   ```

**Alternative: Deploy via Amplify Console (No CLI)**

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click "New app" → "Host web app"
3. Connect your Git repository (GitHub, GitLab, etc.) OR choose "Deploy without Git provider"
4. If using Git: Amplify will auto-detect the [amplify.yml](amplify.yml) configuration
5. Add environment variable `VITE_API_BASE_URL` in App settings → Environment variables
6. Deploy - Amplify will build and host your app with a custom URL
7. Optional: Add a custom domain in Domain management

### Option 2: S3 + CloudFront (More Control)

Deploy to S3 for static hosting with CloudFront CDN for HTTPS and global distribution.

**Prerequisites:**

- AWS CLI installed and configured: `aws configure`
- S3 bucket name chosen (must be globally unique)

**Quick Deploy (PowerShell):**

1. **Edit the deployment script**:
   - Open [aws/deploy-s3.ps1](aws/deploy-s3.ps1)
   - Update `$BUCKET_NAME` with your desired bucket name
   - Update `$REGION` if needed (default: us-east-1)

2. **Update the bucket policy**:
   - Open [aws/s3-bucket-policy.json](aws/s3-bucket-policy.json)
   - Replace `YOUR_BUCKET_NAME` with your bucket name

3. **Run the deployment**:

   ```powershell
   npm run deploy:s3
   ```

   Or manually:

   ```powershell
   pwsh -File aws/deploy-s3.ps1
   ```

**Manual S3 Deployment:**

```bash
# Build the app
npm run build

# Create S3 bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Enable static website hosting
aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html

# Upload files
aws s3 sync ./dist s3://your-bucket-name --delete

# Make bucket public (update bucket name in aws/s3-bucket-policy.json first)
aws s3api put-bucket-policy --bucket your-bucket-name --policy file://aws/s3-bucket-policy.json
```

Your site will be available at: `http://your-bucket-name.s3-website-us-east-1.amazonaws.com`

**Add CloudFront for HTTPS (Optional but Recommended):**

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront)
2. Create distribution:
   - Origin domain: Select your S3 bucket
   - Origin path: leave empty
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS
   - Cache policy: CachingOptimized
   - Custom error responses: 403 and 404 → /index.html (for React Router)
3. Wait for deployment (~15 minutes)
4. Access via CloudFront URL (HTTPS enabled)

**Using the CloudFront config file:**

```bash
# Update aws/cloudfront-config.json with your bucket name, then:
aws cloudfront create-distribution --distribution-config file://aws/cloudfront-config.json
```

### Option 3: Docker + ECS/Fargate (For Dynamic Hosting)

If you need server-side rendering or want containerized deployment, you can use ECS:

1. Create a Dockerfile (nginx-based)
2. Build and push to ECR
3. Deploy to ECS Fargate

(Contact if you need this option - it's more complex and typically not needed for static React apps)

## Deployment Checklist

Before deploying:

- [ ] Update `.env.local` with production API Gateway URL
- [ ] Test production build locally: `npm run build && npm run preview`
- [ ] Configure CORS on your API Gateway to allow your deployed domain
- [ ] Update API Gateway endpoint in deployment environment variables
- [ ] Test all API endpoints are accessible from browser
- [ ] Consider enabling CloudFront for CDN and HTTPS (S3 option)
- [ ] Set up custom domain (optional)

## Cost Considerations

- **Amplify**: ~$1/month for hobby projects, includes CDN and HTTPS
- **S3 + CloudFront**: ~$0.50-2/month depending on traffic
- **S3 alone**: ~$0.10-0.50/month (no HTTPS without CloudFront)

## Notes

- The app calculates line item totals automatically (quantity × unit cost)
- All API calls include error handling with user-friendly messages
- Authentication can be added to the Axios interceptor in `services/api.ts`
- The app is fully responsive using Tailwind CSS
- React Router requires all routes to serve index.html (configured in deployment scripts)
