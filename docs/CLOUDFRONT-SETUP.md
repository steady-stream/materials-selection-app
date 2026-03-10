# CloudFront Distribution Setup Complete

## Distribution Information

- **Distribution ID**: E2CO2DGE8F4YUE
- **CloudFront Domain**: d3ni1zqx1cmc4k.cloudfront.net
- **Status**: InProgress (will be deployed in 10-15 minutes)
- **Custom Domain**: mpmaterials.apiaconsulting.com
- **SSL Certificate**: arn:aws:acm:us-east-1:634752426026:certificate/03a50780-2980-4583-acba-f5d2bbc954b3 (ISSUED)

## Next Steps

### 1. Wait for CloudFront Deployment

Monitor status with:

```powershell
aws cloudfront get-distribution --id E2CO2DGE8F4YUE --query 'Distribution.Status'
```

Once it shows "Deployed", the CloudFront distribution is ready.

### 2. Add DNS CNAME Record

Add the following CNAME record to your DNS (apiaconsulting.com hosted zone):

**Record Type**: CNAME  
**Name**: mpmaterials  
**Value**: d3ni1zqx1cmc4k.cloudfront.net  
**TTL**: 300 (5 minutes)

Using AWS CLI:

```powershell
aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch '{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "mpmaterials.apiaconsulting.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "d3ni1zqx1cmc4k.cloudfront.net"}]
    }
  }]
}'
```

### 3. Test Access

After DNS propagation (5-10 minutes), test:

- https://mpmaterials.apiaconsulting.com (should load the app via CloudFront)
- https://d3ni1zqx1cmc4k.cloudfront.net (CloudFront direct access)

### 4. Update API Configuration

If needed, update CORS settings in Lambda to allow the custom domain:

```javascript
'Access-Control-Allow-Origin': 'https://mpmaterials.apiaconsulting.com'
```

## Deployment URLs

### Production (Custom Domain)

- **URL**: https://mpmaterials.apiaconsulting.com
- **CDN**: CloudFront (E2CO2DGE8F4YUE)
- **SSL**: Valid certificate from AWS Certificate Manager

### Development/Testing

- **S3 Direct**: http://materials-selection-app-7525.s3-website-us-east-1.amazonaws.com
- **CloudFront Direct**: https://d3ni1zqx1cmc4k.cloudfront.net

### Backend API

- **Endpoint**: https://fiad7hd58j.execute-api.us-east-1.amazonaws.com

## CloudFront Configuration Summary

- **Origin**: materials-selection-app-7525.s3-website-us-east-1.amazonaws.com (S3 website endpoint)
- **Protocol**: Redirect HTTP to HTTPS
- **Default Root**: index.html
- **Caching**: Standard CloudFront caching
- **SSL/TLS**: SNI (Server Name Indication) with TLSv1.2+
- **Aliases**: mpmaterials.apiaconsulting.com

## Troubleshooting

### CloudFront Not Loading

1. Check distribution status: `aws cloudfront get-distribution --id E2CO2DGE8F4YUE`
2. Wait for status to be "Deployed" (can take 10-15 minutes)

### DNS Not Resolving

1. Check DNS propagation: `nslookup mpmaterials.apiaconsulting.com`
2. Wait for TTL to expire (5 minutes for CNAME)
3. Verify CNAME points to d3ni1zqx1cmc4k.cloudfront.net

### SSL Certificate Error

1. Verify certificate is ISSUED: `aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:634752426026:certificate/03a50780-2980-4583-acba-f5d2bbc954b3`
2. Ensure CloudFront is using the correct certificate ARN
3. Check that domain name matches certificate (mpmaterials.apiaconsulting.com)

## Cost Estimate

- **CloudFront**: ~$0.085/GB for data transfer + $0.01/10,000 HTTPS requests
- **S3**: Minimal (static hosting only)
- **ACM Certificate**: FREE
- **Estimated monthly cost**: $1-5 depending on traffic

For typical usage (1000 visitors/month, 2MB avg page size):

- Data transfer: 2GB × $0.085 = $0.17
- Requests: 1000 × $0.01/10,000 = $0.001
- **Total**: ~$0.20/month
