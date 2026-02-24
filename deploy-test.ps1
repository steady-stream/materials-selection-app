#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy frontend to the TEST environment (AWS account 634752426026)

.DESCRIPTION
    Builds the Vite app using .env.local (test variables) and syncs
    to the test S3 bucket, then invalidates the CloudFront cache.

.NOTES
    AWS Profile : megapros-test
    S3 Bucket   : materials-selection-app-7525
    CloudFront  : E2CO2DGE8F4YUE
    URL         : https://mpmaterials.apiaconsulting.com
#>

$ErrorActionPreference = "Stop"

# --- Test environment resource identifiers ---
$PROFILE = "megapros-test"
$S3_BUCKET = "materials-selection-app-7525"
$CF_DIST_ID = "E2CO2DGE8F4YUE"
$REGION = "us-east-1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying to TEST environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify the profile resolves to the expected account
$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne "634752426026") {
    Write-Error "Profile '$PROFILE' returned account '$account', expected 634752426026. Check ~/.aws/credentials."
    exit 1
}
Write-Host "Verified: AWS account $account (test)" -ForegroundColor Green

# Build — Vite picks up .env.local for dev/test overrides
Write-Host ""
Write-Host "Building..." -ForegroundColor Cyan
# Use --mode development so .env.production is NOT loaded (prevents prod API URLs
# from overriding the test values in .env.local)
npm run build:test
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# Sync to S3
Write-Host ""
Write-Host "Syncing dist/ to s3://$S3_BUCKET/ ..." -ForegroundColor Cyan
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $PROFILE --region $REGION

# Invalidate CloudFront cache
Write-Host ""
Write-Host "Invalidating CloudFront distribution $CF_DIST_ID ..." -ForegroundColor Cyan
$invalidationId = aws cloudfront create-invalidation `
    --distribution-id $CF_DIST_ID `
    --paths "/*" `
    --profile $PROFILE `
    --query "Invalidation.Id" `
    --output text

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TEST deployment complete!" -ForegroundColor Green
Write-Host "  Invalidation: $invalidationId" -ForegroundColor Green
Write-Host "  URL: https://mpmaterials.apiaconsulting.com" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
