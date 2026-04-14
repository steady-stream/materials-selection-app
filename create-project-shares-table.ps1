#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates the ProjectShares DynamoDB table for one environment.

.DESCRIPTION
    Creates ProjectShares-{env} with:
      - PK: shareToken (String)
      - GSI: ProjectIdIndex on projectId (for looking up a project's active share)

.PARAMETER Env
    "test" (default) or "prod"

.EXAMPLE
    .\create-project-shares-table.ps1
    .\create-project-shares-table.ps1 -Env prod

.NOTES
    Run once per environment. Safe to re-run — will skip if table already exists.
#>
param(
    [ValidateSet("test", "prod")]
    [string]$Env = "test"
)

$ErrorActionPreference = "Stop"

$config = @{
    test = @{ Profile = "megapros-test"; Account = "634752426026" }
    prod = @{ Profile = "megapros-prod"; Account = "860601623272" }
}

$PROFILE  = $config[$Env].Profile
$ACCOUNT  = $config[$Env].Account
$REGION   = "us-east-1"
$TABLE    = "ProjectShares-$Env"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Creating ProjectShares Table ($Env)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Verify AWS profile points to the right account
$acct = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($acct -ne $ACCOUNT) {
    Write-Error "Profile '$PROFILE' returned account '$acct', expected $ACCOUNT."
    exit 1
}
Write-Host "Verified: AWS account $acct ($Env)" -ForegroundColor Green

# Check if table already exists
$exists = aws dynamodb describe-table `
    --table-name $TABLE `
    --profile $PROFILE `
    --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Table '$TABLE' already exists — nothing to do." -ForegroundColor Yellow
    exit 0
}

# Create table
Write-Host "Creating table: $TABLE ..."

$gsi = '[{"IndexName":"ProjectIdIndex","KeySchema":[{"AttributeName":"projectId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]'

aws dynamodb create-table `
    --table-name $TABLE `
    --attribute-definitions `
        AttributeName=shareToken,AttributeType=S `
        AttributeName=projectId,AttributeType=S `
    --key-schema `
        AttributeName=shareToken,KeyType=HASH `
    --global-secondary-indexes $gsi `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 `
    --profile $PROFILE `
    --region $REGION | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create table."
    exit 1
}

# Wait for table to become ACTIVE
Write-Host "Waiting for table to become ACTIVE ..." -ForegroundColor Yellow
aws dynamodb wait table-exists `
    --table-name $TABLE `
    --profile $PROFILE `
    --region $REGION

Write-Host ""
Write-Host "Table '$TABLE' created and ACTIVE." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run .\deploy-projects-lambda-test.ps1 to deploy updated Lambda"
Write-Host "  2. Run .\setup-review-apigw-test.ps1 to wire the API Gateway routes"
