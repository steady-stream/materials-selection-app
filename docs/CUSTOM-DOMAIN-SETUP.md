# Materials Selection App - Custom Domain Setup

---

## projects.megapros.com — Production Setup (April 2026)

> ### ⏳ STATUS: WAITING FOR DNS ADMIN — April 14, 2026
>
> SSL certificate has been requested. DNS validation CNAME has been sent to the client's DNS admin.
> Once they add both CNAMEs, continue at **[Developer Steps After DNS Admin Responds →](#developer-steps-after-dns-admin-responds)**

### What Was Done

- ACM certificate requested for `projects.megapros.com`
- Certificate ARN: `arn:aws:acm:us-east-1:860601623272:certificate/c070c84e-24aa-40b2-91b4-4ec58369dbf9`
- Current prod CloudFront: `d377ynyh0ngsji.cloudfront.net` (distribution `E2PTMMBR8VRR3W`)

### Instructions Sent to DNS Admin

See the email/message template in the section below.

---

### DNS Admin Instructions — `projects.megapros.com`

**Subject: DNS Setup Required — projects.megapros.com → MegaPros Materials App**

---

We need two DNS CNAME records added to `megapros.com`. Neither of these changes anything visible to end users until the app is fully configured — they are safe to add at any time.

**Estimated time: 5 minutes**

---

#### Record 1 — SSL Certificate Validation (temporary, but must stay forever)

This record proves to Amazon that we control the domain and is required for the HTTPS certificate to remain valid. **It must never be removed.**

| Field                 | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| **Type**              | CNAME                                                               |
| **Name / Host**       | `_a57d6fc6ba50f6356973b875cff50982.projects`                        |
| **Value / Points to** | `_2b26c0660ff04b0b0e6f1988346d95f3.jkddzztszm.acm-validations.aws.` |
| **TTL**               | 300 (or whatever your default is)                                   |

> If your DNS admin panel shows the full domain, enter:
>
> - Name: `_a57d6fc6ba50f6356973b875cff50982.projects.megapros.com`
> - Value: `_2b26c0660ff04b0b0e6f1988346d95f3.jkddzztszm.acm-validations.aws.`

---

#### Record 2 — Subdomain Points to the App

This is the actual routing record — `projects.megapros.com` → our app.

| Field                 | Value                           |
| --------------------- | ------------------------------- |
| **Type**              | CNAME                           |
| **Name / Host**       | `projects`                      |
| **Value / Points to** | `d377ynyh0ngsji.cloudfront.net` |
| **TTL**               | 300                             |

> If your DNS admin panel shows the full domain, enter:
>
> - Name: `projects.megapros.com`
> - Value: `d377ynyh0ngsji.cloudfront.net`

---

#### What to Send Back

Just let me know when both records have been added — no values need to be sent back. I'll monitor the certificate validation from my side and complete the setup.

---

### Developer Steps After DNS Admin Responds

Complete these steps **after** the admin confirms both CNAMEs are in DNS.

#### Step 1 — Wait for certificate to become ISSUED

```powershell
# Poll until Status = ISSUED (usually 5-30 min after CNAME is added)
aws acm describe-certificate `
  --certificate-arn "arn:aws:acm:us-east-1:860601623272:certificate/c070c84e-24aa-40b2-91b4-4ec58369dbf9" `
  --profile megapros-prod `
  --region us-east-1 `
  --query "Certificate.Status" `
  --output text
```

#### Step 2 — Add the alternate domain to CloudFront

Get the current CloudFront config, add the alias, then update:

```powershell
# Get current distribution config
aws cloudfront get-distribution-config `
  --id E2PTMMBR8VRR3W `
  --profile megapros-prod `
  --region us-east-1 `
  --output json > /tmp/cf-config.json

# Edit /tmp/cf-config.json:
# 1. In DistributionConfig.Aliases, add "projects.megapros.com" to the Items array
#    and increment Quantity by 1
# 2. In DistributionConfig.ViewerCertificate, set:
#    "ACMCertificateArn": "arn:aws:acm:us-east-1:860601623272:certificate/c070c84e-24aa-40b2-91b4-4ec58369dbf9",
#    "SSLSupportMethod": "sni-only",
#    "MinimumProtocolVersion": "TLSv1.2_2021",
#    "CertificateSource": "acm"
#    (remove "CloudFrontDefaultCertificate": true if present)
# 3. Save just the DistributionConfig block (not the ETag) to cf-dist-config-update.json
# 4. Apply:

$ETAG = (Get-Content /tmp/cf-config.json | ConvertFrom-Json).ETag
aws cloudfront update-distribution `
  --id E2PTMMBR8VRR3W `
  --distribution-config file:///tmp/cf-dist-config-update.json `
  --if-match $ETAG `
  --profile megapros-prod `
  --region us-east-1
```

> **Alternative**: Do this step through the AWS Console — CloudFront → E2PTMMBR8VRR3W → Edit → Alternate domain names → add `projects.megapros.com`, then select the ACM certificate.

#### Step 3 — Wait for CloudFront to redeploy (~10 min)

```powershell
aws cloudfront get-distribution `
  --id E2PTMMBR8VRR3W `
  --profile megapros-prod `
  --region us-east-1 `
  --query "Distribution.Status" `
  --output text
# Wait for: Deployed
```

#### Step 4 — Update Cognito callback URLs

The Cognito app client must allow `https://projects.megapros.com` as a callback/logout URL, otherwise login will break on the custom domain.

```powershell
# First: describe the current client to get all existing settings
# (update-user-pool-client is a FULL REPLACE — must re-include everything)
$POOL_ID = "<prod-cognito-user-pool-id>"   # check aws/secrets.ps1 or Lambda env vars
$CLIENT_ID = "<prod-app-client-id>"

aws cognito-idp describe-user-pool-client `
  --user-pool-id $POOL_ID `
  --client-id $CLIENT_ID `
  --profile megapros-prod `
  --region us-east-1

# Then run update-user-pool-client with all existing values PLUS the two new URLs:
# CallbackURLs: add  https://projects.megapros.com/callback
# LogoutURLs:   add  https://projects.megapros.com
```

#### Step 5 — Update CORS in any Lambda that hardcodes the CloudFront origin

```powershell
# Check if any lambda has the CloudFront URL hardcoded in CORS
grep -r "d377ynyh0ngsji.cloudfront.net" lambda/
# If found, add 'https://projects.megapros.com' alongside it
```

#### Step 6 — Smoke test

```
https://projects.megapros.com
```

- Should load the app over HTTPS
- Login should complete without redirect errors
- Check the browser URL bar stays on `projects.megapros.com` throughout

#### Step 7 — Update .env.production and redeploy frontend

If `VITE_APP_URL` or any frontend env var references the CloudFront domain directly, update it and redeploy:

```powershell
# In .env.production, if VITE_APP_URL is set update to:
# VITE_APP_URL=https://projects.megapros.com

.\deploy-prod.ps1
```

---

## Archive — Previous apiaconsulting.com Setup

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
