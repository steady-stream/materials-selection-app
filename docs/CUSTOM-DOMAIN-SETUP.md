# Materials Selection App - Custom Domain Setup

## Current Status: Awaiting DNS Validation

Your app is deployed and accessible at:
**http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com**

To make it accessible at **https://MPmaterials.apiaconsulting.com**, you need to complete DNS validation.

## Step 1: Add DNS Validation Record

Add this CNAME record to your domain registrar (where you manage apiaconsulting.com DNS):

```
Type: CNAME
Name: _9557ee8b4ba3e47e3c6c6b1c3e2a5db9.mpmaterials.apiaconsulting.com
Value: _70d7bc5a2b3860eb1f49be37a94c4693.jkddzztszm.acm-validations.aws.
```

**How to find this:**

- If you use Route 53 for another domain, add it there
- If you use GoDaddy, Namecheap, etc., log in to your registrar
- Go to DNS management for apiaconsulting.com
- Add the CNAME record above

## Step 2: Wait for Validation (5-30 minutes)

After adding the DNS record, check certificate status:

```powershell
aws acm describe-certificate --certificate-arn "arn:aws:acm:us-east-1:634752426026:certificate/03a50780-2980-4583-acba-f5d2bbc954b3" --region us-east-1 --query "Certificate.Status" --output text
```

When it shows `ISSUED`, proceed to Step 3.

## Step 3: Create CloudFront Distribution

Once the certificate is validated, run:

```powershell
aws cloudfront create-distribution --distribution-config file://cloudfront-dist-config.json
```

This will return a distribution ID and domain name like `d123456abcdef.cloudfront.net`

## Step 4: Add DNS Record for Your Custom Domain

Add another CNAME record to your domain registrar:

```
Type: CNAME
Name: MPmaterials.apiaconsulting.com
Value: [CloudFront domain from Step 3, e.g., d123456abcdef.cloudfront.net]
```

## Step 5: Wait for CloudFront Deployment (10-15 minutes)

Check deployment status:

```powershell
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Materials Selection App'].{Status:Status,Domain:DomainName}" --output table
```

When Status shows "Deployed", your site will be live at:
**https://MPmaterials.apiaconsulting.com**

---

## Quick Commands Reference

**Check certificate status:**

```powershell
aws acm describe-certificate --certificate-arn "arn:aws:acm:us-east-1:634752426026:certificate/03a50780-2980-4583-acba-f5d2bbc954b3" --region us-east-1 --query "Certificate.Status" --output text
```

**Create CloudFront distribution (after cert is ISSUED):**

```powershell
aws cloudfront create-distribution --distribution-config file://cloudfront-dist-config.json
```

**Check CloudFront deployment status:**

```powershell
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Materials Selection App']" --output table
```

---

## Configuration Details

- **S3 Bucket**: materials-selection-app-7525
- **Certificate ARN**: arn:aws:acm:us-east-1:634752426026:certificate/03a50780-2980-4583-acba-f5d2bbc954b3
- **Target Domain**: https://MPmaterials.apiaconsulting.com
- **CloudFront Config**: cloudfront-dist-config.json (ready to deploy)

## Matching Cruise2026 Setup

This configuration matches your Cruise2026 app:

- ✅ CloudFront CDN for global delivery
- ✅ SSL certificate for HTTPS
- ✅ Custom domain with subdomain
- ✅ S3 static website as origin
- ✅ Custom error responses for React Router (403/404 → index.html)
- ✅ Compression enabled
- ✅ HTTP to HTTPS redirect
