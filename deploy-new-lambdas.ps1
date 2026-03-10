#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and deploy the 5 split Lambda functions to TEST environment.

.DESCRIPTION
    For each domain Lambda (projects/core/catalog/orders/ai):
      1. npm install
      2. Compress to a zip
      3. Create the Lambda function if new, or update-function-code if it exists
      4. Set environment variables

.NOTES
    AWS Profile : megapros-test
    Account     : 634752426026
    Region      : us-east-1
#>

$ErrorActionPreference = "Stop"

# ---- Constants ----------------------------------------------------------------
$PROFILE = "megapros-test"
$REGION = "us-east-1"
$ROLE = "arn:aws:iam::634752426026:role/MaterialsSelection-Lambda-Role"
$RUNTIME = "nodejs22.x"
$HANDLER = "index.handler"
$TIMEOUT = 30
$MEMORY_MB = 256

$ROOT = $PSScriptRoot
$LAMBDA_BASE = Join-Path $ROOT "lambda"
$DEPLOY_DIR = Join-Path $LAMBDA_BASE "deploy"

# SharePoint / Azure AD variables — only Projects Lambda needs these.
# Loaded from aws/secrets.ps1 (never committed — see aws/secrets.ps1.example).
$secretsFile = Join-Path $ROOT "aws\secrets.ps1"
if (-not (Test-Path $secretsFile)) {
    Write-Error "Missing $secretsFile — copy aws/secrets.ps1.example and fill in real values"
    exit 1
}
. $secretsFile

$spVars = @{
    SHAREPOINT_LIBRARY     = "Projects"
    SHAREPOINT_SITE_URL    = $SHAREPOINT_SITE_URL
    SHAREPOINT_BASE_FOLDER = "ProjectFolders"
    AZURE_TENANT_ID        = $AZURE_TENANT_ID
    AZURE_CLIENT_ID        = $AZURE_CLIENT_ID
    AZURE_CLIENT_SECRET    = $AZURE_CLIENT_SECRET
}

# Lambda definitions: Name, subdirectory under lambda/, env vars hashtable (or empty)
$lambdas = @(
    [PSCustomObject]@{
        Name    = "MaterialsSelection-Projects-API"
        Dir     = "projects"
        EnvVars = $spVars
    }
    [PSCustomObject]@{
        Name    = "MaterialsSelection-Core-API"
        Dir     = "core"
        EnvVars = @{}
    }
    [PSCustomObject]@{
        Name    = "MaterialsSelection-Catalog-API"
        Dir     = "catalog"
        EnvVars = @{}
    }
    [PSCustomObject]@{
        Name    = "MaterialsSelection-Orders-API"
        Dir     = "orders"
        EnvVars = @{}
    }
    [PSCustomObject]@{
        Name    = "MaterialsSelection-AI-API"
        Dir     = "ai"
        EnvVars = @{}
    }
)

# ---- Pre-flight ---------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploying Split Lambdas → TEST" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne "634752426026") {
    Write-Error "Profile '$PROFILE' returned account '$account', expected 634752426026."
    exit 1
}
Write-Host "Verified: AWS account $account (test)" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $DEPLOY_DIR | Out-Null

# ---- Helper: build env-vars JSON for AWS CLI ----------------------------------
function ConvertTo-EnvVarsJson([hashtable]$vars) {
    if ($vars.Count -eq 0) { return $null }
    $inner = ($vars.GetEnumerator() | ForEach-Object {
            "`"$($_.Key)`":`"$($_.Value)`""
        }) -join ","
    return "{`"Variables`":{$inner}}"
}

# ---- Per-Lambda build + deploy ------------------------------------------------
foreach ($lambda in $lambdas) {
    $lambdaDir = Join-Path $LAMBDA_BASE $lambda.Dir
    $zipPath = Join-Path $DEPLOY_DIR "$($lambda.Dir).zip"

    Write-Host ""
    Write-Host "--- $($lambda.Name) ---" -ForegroundColor Cyan

    # Step 1: npm install
    Write-Host "  [1/3] npm install..."
    Push-Location $lambdaDir
    try {
        npm install --silent
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    finally {
        Pop-Location
    }

    # Step 2: zip (include everything in the directory — node_modules included)
    Write-Host "  [2/3] Compressing..."
    Remove-Item $zipPath -ErrorAction SilentlyContinue
    Compress-Archive -Path "$lambdaDir\*" -DestinationPath $zipPath
    $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "        $zipPath ($sizeMB MB)"

    # Step 3: create or update Lambda
    Write-Host "  [3/3] Deploying to AWS..."
    $exists = aws lambda get-function `
        --function-name $lambda.Name `
        --profile $PROFILE --region $REGION 2>&1

    if ($LASTEXITCODE -eq 0) {
        # Function exists — update code
        aws lambda update-function-code `
            --function-name $lambda.Name `
            --zip-file "fileb://$zipPath" `
            --profile $PROFILE --region $REGION | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Error "update-function-code failed for $($lambda.Name)"; exit 1 }

        # Update env vars if any
        $envJson = ConvertTo-EnvVarsJson $lambda.EnvVars
        if ($null -ne $envJson) {
            aws lambda update-function-configuration `
                --function-name $lambda.Name `
                --environment $envJson `
                --profile $PROFILE --region $REGION | Out-Null
        }
        Write-Host "        Updated existing function." -ForegroundColor Yellow
    }
    else {
        # Function does not exist — create it
        $createArgs = @(
            "lambda", "create-function",
            "--function-name", $lambda.Name,
            "--runtime", $RUNTIME,
            "--handler", $HANDLER,
            "--role", $ROLE,
            "--timeout", $TIMEOUT,
            "--memory-size", $MEMORY_MB,
            "--zip-file", "fileb://$zipPath",
            "--profile", $PROFILE,
            "--region", $REGION
        )
        # Append env vars if present
        $envJson = ConvertTo-EnvVarsJson $lambda.EnvVars
        if ($null -ne $envJson) {
            $createArgs += "--environment"
            $createArgs += $envJson
        }
        & aws @createArgs | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Error "create-function failed for $($lambda.Name)"; exit 1 }
        Write-Host "        Created new function." -ForegroundColor Green
    }

    Write-Host "  Done: $($lambda.Name)" -ForegroundColor Green
}

# ---- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  All Lambda functions deployed!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: update API Gateway route integrations." -ForegroundColor Yellow
Write-Host "Run: .\update-apigw-routes.ps1" -ForegroundColor Yellow
Write-Host ""
