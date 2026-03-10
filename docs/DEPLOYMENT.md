# AWS Deployment Quick Guide

## Fastest: AWS Amplify Console (No CLI Required)

1. Build your app locally to verify it works:

   ```bash
   npm run build
   ```

2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)

3. Click **"New app"** → **"Host web app"**

4. Choose **"Deploy without Git provider"**

5. Drag and drop your `dist` folder (created by the build)

6. Set environment variable:
   - Name: `VITE_API_BASE_URL`
   - Value: Your AWS API Gateway URL

7. Your app will be live at a URL like: `https://main.xxxxxx.amplifyapp.com`

## Quick: S3 Static Hosting

1. Edit [aws/deploy-s3.ps1](aws/deploy-s3.ps1):
   - Change `$BUCKET_NAME = "materials-selection-app-YOUR_NAME"`
2. Edit [aws/s3-bucket-policy.json](aws/s3-bucket-policy.json):
   - Replace `YOUR_BUCKET_NAME` with the same name

3. Run:

   ```bash
   npm run deploy:s3
   ```

4. Your app will be at: `http://your-bucket-name.s3-website-us-east-1.amazonaws.com`

## Don't Forget!

Update your API Gateway CORS settings to allow your new domain:

```javascript
Access-Control-Allow-Origin: https://your-amplify-url.amplifyapp.com
// OR
Access-Control-Allow-Origin: *  // For testing only
```
