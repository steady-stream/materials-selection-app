# Deployed App Information

## Live URL

http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com

## AWS Details

- **Bucket Name**: materials-selection-app-7525
- **Region**: us-east-1
- **Type**: S3 Static Website Hosting

## Next Steps

1. **Configure your API endpoint**:
   - Create a `.env.production` file with:
     ```
     VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com
     ```
   - Rebuild and redeploy: `npm run build` then sync to S3

2. **Update API Gateway CORS**:
   - Add this origin to your API Gateway CORS settings:
     ```
     http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com
     ```

3. **Optional: Add HTTPS with CloudFront**:
   - Go to CloudFront console
   - Create distribution pointing to this S3 bucket
   - You'll get an HTTPS URL like: `https://d111111abcdef8.cloudfront.net`

## Redeploy Updates

To update your deployed app:

```bash
npm run build
aws s3 sync ./dist s3://materials-selection-app-7525 --delete
```

## Deployment Date

February 2, 2026
