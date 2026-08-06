#!/usr/bin/env pwsh
param(
    [string]$Profile = "megapros-prod",
    [string]$ExpectedAccountId = "860601623272",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$PROFILE = $Profile
$S3_BUCKET = "materials-selection-prod-3039"
$CF_DIST_ID = "E2PTMMBR8VRR3W"
$REGION = $Region
$PROD_ACCOUNT_ID = $ExpectedAccountId

if ($S3_BUCKET -like "REPLACE_*" -or $CF_DIST_ID -like "REPLACE_*") {
    Write-Host "ERROR: Update the production resource values in this script first."
    exit 1
}

Write-Host "Deploying to PRODUCTION environment"

try {
    $account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
}
catch {
    Write-Error "Could not authenticate with profile '$PROFILE'."
    exit 1
}

if ($account -ne $PROD_ACCOUNT_ID) {
    Write-Error "Profile '$PROFILE' resolved to account '$account', expected '$PROD_ACCOUNT_ID'."
    exit 1
}

if ($account -match "^An error") {
    Write-Error "Could not authenticate with profile '$PROFILE'."
    exit 1
}

Write-Host "Verified: AWS account $account (production)"

$envLocalMoved = $false
if (Test-Path ".env.local") {
    Rename-Item ".env.local" ".env.local.bak"
    $envLocalMoved = $true
}

try {
    Write-Host "Building..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
}
finally {
    if ($envLocalMoved) {
        Rename-Item ".env.local.bak" ".env.local"
    }
}

Write-Host "Syncing dist/ to s3://$S3_BUCKET/ ..."
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $PROFILE --region $REGION

Write-Host "Invalidating CloudFront distribution $CF_DIST_ID ..."
$invalidationId = aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*" --profile $PROFILE --query "Invalidation.Id" --output text

Write-Host "PRODUCTION deployment complete!"
Write-Host "Invalidation: $invalidationId"
