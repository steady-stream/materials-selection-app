# Quick Reference Card - Materials Selection App

## Access URLs

### Frontend (Choose one based on deployment stage)

```
Production (Custom Domain): https://mpmaterials.apiaconsulting.com
  └─ Status: ⏳ Pending DNS CNAME (waiting for CloudFront)

CloudFront Direct: https://d3ni1zqx1cmc4k.cloudfront.net
  └─ Status: ⏳ Deploying (10-15 minutes from 16:20 UTC)

S3 Direct (Development): http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com
  └─ Status: ✅ Active
```

### Backend API

```
Base URL: https://fiad7hd58j.execute-api.us-east-1.amazonaws.com
Status: ✅ Active (Updated 16:13 UTC)
```

## Common Commands

### Check CloudFront Status

```powershell
aws cloudfront get-distribution --id E2CO2DGE8F4YUE --query 'Distribution.Status'
# Wait for "Deployed" (takes 10-15 minutes)
```

### Test API Endpoints

```powershell
# List vendors
curl https://fiad7hd58j.execute-api.us-east-1.amazonaws.com/vendors

# List manufacturers
curl https://fiad7hd58j.execute-api.us-east-1.amazonaws.com/manufacturers

# List projects
curl https://fiad7hd58j.execute-api.us-east-1.amazonaws.com/projects
```

### Deploy Frontend Changes

```powershell
npm run build
aws s3 sync dist/ s3://materials-selection-app-7525/ --delete
aws cloudfront create-invalidation --distribution-id E2CO2DGE8F4YUE --paths "/*"
```

### Deploy Backend Changes

```powershell
cd lambda
Compress-Archive -Path index.js,package.json,node_modules -DestinationPath lambda-function.zip -Force
aws lambda update-function-code --function-name MaterialsSelection-API --zip-file fileb://lambda-function.zip
```

## AWS Resource IDs

```
S3 Bucket:             materials-selection-app-7525
Lambda Function:       MaterialsSelection-API
API Gateway:           fiad7hd58j
CloudFront Dist:       E2CO2DGE8F4YUE
SSL Certificate:       03a50780-2980-4583-acba-f5d2bbc954b3
Region:                us-east-1
Account:               634752426026
```

## DynamoDB Tables

```
MaterialsSelection-Projects         (0 items)
MaterialsSelection-Categories       (0 items)
MaterialsSelection-LineItems        (0 items)
MaterialsSelection-Vendors          (10 items) ✅
MaterialsSelection-Manufacturers    (8 items) ✅
MaterialsSelection-Products         (0 items)
```

## Feature Status

```
✅ Project Management        (CRUD working)
✅ Category Management       (CRUD working)
✅ Line Item Tracking        (Enhanced with 21 fields)
✅ Vendor Management         (CRUD working, 10 seeded)
✅ Manufacturer Management   (CRUD working, 8 seeded)
🔄 Product Catalog           (Database ready, UI pending)
🔄 Spreadsheet Grid View     (Planned)
⏳ Custom Domain             (CloudFront deploying)
```

## Next Steps

1. **Wait for CloudFront** (~5 more minutes)
   - Check: `aws cloudfront get-distribution --id E2CO2DGE8F4YUE --query 'Distribution.Status'`
   - When "Deployed", proceed to step 2

2. **Add DNS CNAME Record**

   ```
   Type:  CNAME
   Name:  mpmaterials
   Value: d3ni1zqx1cmc4k.cloudfront.net
   TTL:   300
   ```

3. **Test Custom Domain**
   - Wait 5-10 minutes for DNS propagation
   - Visit: https://mpmaterials.apiaconsulting.com
   - Should load app with valid SSL

4. **Populate Product Catalog** (Optional)
   - Create products via UI or API
   - Import from existing data sources

## Troubleshooting

### CloudFront 403 Error

- Check origin: Should be S3 website endpoint, not bucket
- Origin: materials-selection-app-7525.s3-website-us-east-1.amazonaws.com ✅

### API CORS Errors

- Lambda already configured with proper headers ✅
- If issues, check browser console

### Build Errors

- Run `npm install` if dependencies missing
- Ensure TypeScript types use `import type` for interfaces

### DNS Not Resolving

- Check propagation: `nslookup mpmaterials.apiaconsulting.com`
- Wait for TTL to expire (5 minutes)
- Verify CNAME points to CloudFront domain

## File Locations

```
Code:           G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype
Lambda:         lambda/index.js
Config:         .aws-* files (bucket, API ID, cert ARN, CloudFront ID)
Docs:           *.md files (README, DEPLOYMENT, ENHANCED-FEATURES, etc.)
```

## Monitoring

```
Lambda Logs:     CloudWatch /aws/lambda/MaterialsSelection-API
Lambda Console:  https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/MaterialsSelection-API
DynamoDB:        https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#tables
CloudFront:      https://console.aws.amazon.com/cloudfront/v3/home?region=us-east-1#/distributions/E2CO2DGE8F4YUE
```

---

**Last Updated**: February 2, 2026 16:25 UTC  
**Overall Status**: 🟢 Backend Active | 🟡 Frontend Deploying | ⏳ DNS Pending
