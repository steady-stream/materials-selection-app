#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Upgrade Lambda functions from nodejs20.x → nodejs22.x.

.DESCRIPTION
    Updates the runtime configuration for both Lambda functions in the target
    environment. No code changes are required — Node.js 22 is fully backward
    compatible with the existing code.

    Run against TEST first (default), then PROD after smoke-testing.

.PARAMETER Environment
    "test" (default) or "prod"

.EXAMPLE
    # Upgrade test environment
    .\upgrade-lambda-runtime.ps1

    # Upgrade production environment (after validating test)
    .\upgrade-lambda-runtime.ps1 -Environment prod
#>

param(
    [ValidateSet("test", "prod")]
    [string]$Environment = "test"
)

$ErrorActionPreference = "Stop"

# --- Environment configuration ---
$config = @{
    test = @{
        Profile   = "megapros-test"
        Account   = "634752426026"
        Region    = "us-east-1"
        Functions = @("MaterialsSelection-API", "MaterialsSelection-Salesforce-API")
    }
    prod = @{
        Profile   = "megapros-prod"
        Account   = "860601623272"
        Region    = "us-east-1"
        Functions = @("MaterialsSelection-API", "MaterialsSelection-Salesforce-API")
    }
}

$env = $config[$Environment]
$PROFILE = $env.Profile
$REGION = $env.Region
$NEW_RUNTIME = "nodejs22.x"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lambda Runtime Upgrade: nodejs20.x → nodejs22.x" -ForegroundColor Cyan
Write-Host "  Environment : $($Environment.ToUpper())" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify we're hitting the right AWS account
$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne $env.Account) {
    Write-Error "Profile '$PROFILE' resolved to account '$account', expected $($env.Account). Aborting."
    exit 1
}
Write-Host "Verified: AWS account $account ($Environment)" -ForegroundColor Green
Write-Host ""

foreach ($fnName in $env.Functions) {
    Write-Host "-- $fnName --" -ForegroundColor Cyan

    # Check current runtime
    $current = aws lambda get-function-configuration `
        --function-name $fnName `
        --profile $PROFILE `
        --region $REGION `
        --query "Runtime" `
        --output text 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Function '$fnName' not found in $Environment — skipping."
        continue
    }

    Write-Host "  Current runtime : $current"

    if ($current -eq $NEW_RUNTIME) {
        Write-Host "  Already on $NEW_RUNTIME — nothing to do." -ForegroundColor Green
        continue
    }

    Write-Host "  Updating to $NEW_RUNTIME ..." -ForegroundColor Yellow
    aws lambda update-function-configuration `
        --function-name $fnName `
        --runtime $NEW_RUNTIME `
        --profile $PROFILE `
        --region $REGION | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to update $fnName"
        exit 1
    }

    # Wait for the update to propagate
    Write-Host "  Waiting for update to complete..."
    aws lambda wait function-updated `
        --function-name $fnName `
        --profile $PROFILE `
        --region $REGION

    # Confirm
    $updated = aws lambda get-function-configuration `
        --function-name $fnName `
        --profile $PROFILE `
        --region $REGION `
        --query "Runtime" `
        --output text

    Write-Host "  Updated runtime  : $updated" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Runtime upgrade complete for $($Environment.ToUpper())" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
if ($Environment -eq "test") {
    Write-Host "  1. Test login at https://mpmaterials.apiaconsulting.com" -ForegroundColor Yellow
    Write-Host "  2. Create/edit a project, line item, and category" -ForegroundColor Yellow
    Write-Host "  3. Test Salesforce import if possible" -ForegroundColor Yellow
    Write-Host "  4. If all good: .\upgrade-lambda-runtime.ps1 -Environment prod" -ForegroundColor Yellow
}
else {
    Write-Host "  1. Verify production is working normally" -ForegroundColor Yellow
    Write-Host "  2. Update DEVELOPMENT_STATUS.md with Node 22 runtime notes" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
