#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy frontend to the PRODUCTION environment (new AWS account)

.DESCRIPTION
    Builds the Vite app using .env.production variables and syncs
    to the prod S3 bucket, then invalidates the CloudFront cache.

.NOTES
    AWS Profile : megapros-prod
    Requires    : Run aws/setup-prod-infrastructure.ps1 first, then update
                  the resource variables below and .env.production with prod values.
#>

$ErrorActionPreference = "Stop"

# --- PRODUCTION resource identifiers ---
# Update these after running aws/setup-prod-infrastructure.ps1
$PROFILE = "megapros-prod"
$S3_BUCKET = "materials-selection-prod-3039"
$CF_DIST_ID = "E2PTMMBR8VRR3W"
$REGION = "us-east-1"

# Guard: refuse to run until placeholders are replaced
if ($S3_BUCKET -like "REPLACE_*" -or $CF_DIST_ID -like "REPLACE_*") {
    Write-Host ""
    Write-Host "ERROR: Update the resource variables in this script first." -ForegroundColor Red
    Write-Host "  1. Run: aws/setup-prod-infrastructure.ps1" -ForegroundColor Yellow
    Write-Host "  2. Copy the S3 bucket name and CloudFront distribution ID from the output" -ForegroundColor Yellow
    Write-Host "  3. Update '\$S3_BUCKET' and '\$CF_DIST_ID' in this file" -ForegroundColor Yellow
    Write-Host "  4. Update .env.production with prod API URLs and Cognito IDs" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Deploying to PRODUCTION environment" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Verify the profile resolves to the expected prod account (not test)
$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -eq "634752426026") {
    Write-Error "Profile '$PROFILE' resolved to the TEST account (634752426026). Check ~/.aws/credentials."
    exit 1
}
if ($account -match "^An error") {
    Write-Error "Could not authenticate with profile '$PROFILE'. Run: aws configure --profile megapros-prod"
    exit 1
}
Write-Host "Verified: AWS account $account (production)" -ForegroundColor Green

# Guard: .env.local has HIGHER priority than .env.production in Vite's env
# loading order. Automatically move it aside for the duration of the build so
# .env.production values are guaranteed to be used — no human judgment needed.
$envLocalMoved = $false
if (Test-Path ".env.local") {
    Write-Host ""
    Write-Host "Found .env.local — temporarily renaming to .env.local.bak so" -ForegroundColor Yellow
    Write-Host "  .env.production is used exclusively for this prod build." -ForegroundColor Yellow
    Rename-Item ".env.local" ".env.local.bak"
    $envLocalMoved = $true
}

# Build — wrapped in try/finally so .env.local is ALWAYS restored even if the
# build fails, keeping the dev/test environment intact afterward.
try {
    Write-Host ""
    Write-Host "Building..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
} finally {
    if ($envLocalMoved) {
        Rename-Item ".env.local.bak" ".env.local"
        Write-Host ".env.local restored." -ForegroundColor Yellow
    }
}


# Sync to S3
Write-Host ""
Write-Host "Syncing dist/ to s3://$S3_BUCKET/ ..." -ForegroundColor Yellow
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $PROFILE --region $REGION

# Invalidate CloudFront cache
Write-Host ""
Write-Host "Invalidating CloudFront distribution $CF_DIST_ID ..." -ForegroundColor Yellow
$invalidationId = aws cloudfront create-invalidation `
    --distribution-id $CF_DIST_ID `
    --paths "/*" `
    --profile $PROFILE `
    --query "Invalidation.Id" `
    --output text

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  PRODUCTION deployment complete!" -ForegroundColor Green
Write-Host "  Invalidation: $invalidationId" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
