#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and deploy ONLY the Projects Lambda to TEST.

.DESCRIPTION
    Kept separate so the share/review feature can be deployed independently
    without touching other Lambdas or API Gateway config.

    Adds SHARES_TABLE_NAME and REVIEW_BASE_URL alongside the existing
    SharePoint env vars.

.NOTES
    AWS Profile : megapros-test
    Account     : 634752426026
    Lambda      : MaterialsSelection-Projects-API
#>

$ErrorActionPreference = "Stop"

$PROFILE = "megapros-test"
$REGION = "us-east-1"
$FUNC_NAME = "MaterialsSelection-Projects-API"

$ROOT = $PSScriptRoot
$LAMBDA_DIR = Join-Path $ROOT "lambda\projects"
$DEPLOY_DIR = Join-Path $ROOT "lambda\deploy"
$ZIP_PATH = Join-Path $DEPLOY_DIR "projects.zip"

# SharePoint secrets must exist (same file used by deploy-new-lambdas.ps1)
$secretsFile = Join-Path $ROOT "aws\secrets.ps1"
if (-not (Test-Path $secretsFile)) {
    Write-Error "Missing $secretsFile — copy aws/secrets.ps1.example and fill in real values"
    exit 1
}
. $secretsFile

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploy Projects Lambda → TEST" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne "634752426026") {
    Write-Error "Profile '$PROFILE' resolved account '$account', expected 634752426026"
    exit 1
}
Write-Host "Verified: account $account (test)" -ForegroundColor Green

# ---------------------------------------------------------------------------
Write-Host "`n[1/3] npm install..."
Push-Location $LAMBDA_DIR
try {
    npm install --silent
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}
finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
Write-Host "[2/3] Compressing..."
New-Item -ItemType Directory -Force -Path $DEPLOY_DIR | Out-Null
Remove-Item $ZIP_PATH -ErrorAction SilentlyContinue
Compress-Archive -Path "$LAMBDA_DIR\*" -DestinationPath $ZIP_PATH
$sizeMB = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 1)
Write-Host "      $ZIP_PATH ($sizeMB MB)"

# ---------------------------------------------------------------------------
Write-Host "[3/3] Deploying..."

aws lambda update-function-code `
    --function-name $FUNC_NAME `
    --zip-file "fileb://$ZIP_PATH" `
    --profile $PROFILE --region $REGION | Out-Null

if ($LASTEXITCODE -ne 0) { Write-Error "update-function-code failed"; exit 1 }

# Wait for the code update to propagate before updating config (avoids ResourceConflictException)
Write-Host "      Waiting for code update to propagate..."
aws lambda wait function-updated --function-name $FUNC_NAME --profile $PROFILE --region $REGION

# Build env vars JSON — include SharePoint vars + new share/review vars
$envVars = @{
    SHAREPOINT_LIBRARY     = "Projects"
    SHAREPOINT_SITE_URL    = $SHAREPOINT_SITE_URL
    SHAREPOINT_BASE_FOLDER = "ProjectFolders"
    AZURE_TENANT_ID        = $AZURE_TENANT_ID
    AZURE_CLIENT_ID        = $AZURE_CLIENT_ID
    AZURE_CLIENT_SECRET    = $AZURE_CLIENT_SECRET
    SHARES_TABLE_NAME      = "ProjectShares-test"
    REVIEW_BASE_URL        = "https://mpmaterials.apiaconsulting.com"
}

$inner = ($envVars.GetEnumerator() | ForEach-Object {
        "`"$($_.Key)`":`"$($_.Value)`""
    }) -join ","
$envJson = "{`"Variables`":{$inner}}"

aws lambda update-function-configuration `
    --function-name $FUNC_NAME `
    --environment $envJson `
    --profile $PROFILE --region $REGION | Out-Null

if ($LASTEXITCODE -ne 0) { Write-Error "update-function-configuration failed"; exit 1 }

Write-Host ""
Write-Host "Done. $FUNC_NAME updated successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Next step: run .\setup-review-apigw-test.ps1 if you haven't added the /review route yet."
