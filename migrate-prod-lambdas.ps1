#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Migrates prod to the same split-lambda architecture as test.

.DESCRIPTION
    1. Creates/updates all 5 split lambdas in prod (using pre-built zips)
    2. Adds Lambda invoke permissions for API Gateway
    3. Re-wires every non-OPTIONS route in the prod REST API to the correct split lambda
    4. Redeploys the prod stage

.NOTES
    Run from project root: .\migrate-prod-lambdas.ps1
    Requires: pre-built zips in lambda\deploy\ (run build-and-deploy-lambdas.ps1 first to refresh)
#>

$ErrorActionPreference = "Stop"

$PROFILE = "megapros-prod"
$REGION = "us-east-1"
$ACCOUNT = "860601623272"
$API_ID = "6extgb87v1"
$STAGE = "prod"
$ROLE = "arn:aws:iam::${ACCOUNT}:role/MaterialsSelection-Lambda-Role"
$ZIPDIR = "$PSScriptRoot\lambda\deploy"

# SharePoint env vars — same Azure app registration used by test.
# Retrieve the actual client secret from AWS Secrets Manager before running:
#   aws secretsmanager get-secret-value --secret-id MaterialsSelection/SharePoint --profile megapros-prod
$AZURE_CLIENT_SECRET = $env:AZURE_CLIENT_SECRET  # set in shell before running, or paste value here (never commit)
if (-not $AZURE_CLIENT_SECRET) {
    Write-Error "Set `$env:AZURE_CLIENT_SECRET before running (retrieve from AWS Secrets Manager)."
    exit 1
}
$spEnvJson = "{`"Variables`":{`"SHAREPOINT_LIBRARY`":`"Projects`",`"AZURE_TENANT_ID`":`"2ea2b9df-669a-48d1-b2c2-15411ba08071`",`"AZURE_CLIENT_SECRET`":`"$AZURE_CLIENT_SECRET`",`"AZURE_CLIENT_ID`":`"24b3320a-35c0-4f2b-a6d2-99a146e62468`",`"SHAREPOINT_SITE_URL`":`"https://apiaconsulting.sharepoint.com/sites/MegaPros360`",`"SHAREPOINT_BASE_FOLDER`":`"ProjectFolders`"}}"

function LambdaUri($fnName) {
    "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT}:function:${fnName}/invocations"
}

function Write-Step($msg) {
    Write-Host "`n--- $msg ---" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Prod -> Split Lambda Migration" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Guard: confirm prod account
$acct = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($acct -ne $ACCOUNT) {
    Write-Error "Wrong account: got '$acct', expected '$ACCOUNT'. Check ~/.aws/credentials."
    exit 1
}
Write-Host "Verified: AWS account $acct (production)" -ForegroundColor Green

# ============================================================
# STEP 1 — Deploy split lambdas
# ============================================================
Write-Step "Step 1: Deploy split lambdas"

# Lambda configs: name, zip file, optional env JSON
$lambdas = @(
    @{ name = "MaterialsSelection-Catalog-API"; zip = "catalog.zip"; env = $null }
    @{ name = "MaterialsSelection-Core-API"; zip = "core.zip"; env = $null }
    @{ name = "MaterialsSelection-Projects-API"; zip = "projects.zip"; env = $spEnvJson }
    @{ name = "MaterialsSelection-Orders-API"; zip = "orders.zip"; env = $null }
    @{ name = "MaterialsSelection-AI-API"; zip = "ai.zip"; env = $null }
)

foreach ($lam in $lambdas) {
    $zipPath = "$ZIPDIR\$($lam.zip)"

    if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -eq 0) {
        Write-Host "  ERROR: $zipPath missing or empty — run build-and-deploy-lambdas.ps1 first" -ForegroundColor Red
        exit 1
    }

    $mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "  $($lam.name)  ($mb MB)"

    # Check existence without throwing on 404
    $null = aws lambda get-function --function-name $lam.name `
        --profile $PROFILE --region $REGION --output text 2>&1
    $fnExists = ($LASTEXITCODE -eq 0)

    if ($fnExists) {
        aws lambda update-function-code `
            --function-name $lam.name `
            --zip-file "fileb://$zipPath" `
            --profile $PROFILE --region $REGION --output text 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Error "  update-function-code failed for $($lam.name)"; exit 1 }

        if ($lam.env) {
            # Small wait — update-function-code and update-function-configuration
            # cannot run concurrently on the same Lambda
            Start-Sleep -Seconds 5
            aws lambda update-function-configuration `
                --function-name $lam.name --environment $lam.env `
                --profile $PROFILE --region $REGION --output text 2>&1 | Out-Null
        }
        Write-Host "    Updated" -ForegroundColor Green
    }
    else {
        $createArgs = @(
            "lambda", "create-function",
            "--function-name", $lam.name,
            "--runtime", "nodejs22.x",
            "--handler", "index.handler",
            "--role", $ROLE,
            "--timeout", "30",
            "--memory-size", "256",
            "--zip-file", "fileb://$zipPath",
            "--profile", $PROFILE,
            "--region", $REGION,
            "--output", "text"
        )
        if ($lam.env) { $createArgs += "--environment"; $createArgs += $lam.env }

        & aws @createArgs 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Error "  create-function failed for $($lam.name)"; exit 1 }
        Write-Host "    Created" -ForegroundColor Green
    }

    # Add/refresh Lambda resource-based policy so API GW can invoke it.
    # Remove first (ignore error) then add — avoids "already exists" error on re-runs.
    aws lambda remove-permission `
        --function-name $lam.name --statement-id "apigw-prod-invoke" `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
    aws lambda add-permission `
        --function-name $lam.name `
        --statement-id  "apigw-prod-invoke" `
        --action        "lambda:InvokeFunction" `
        --principal     "apigateway.amazonaws.com" `
        --source-arn    "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/*" `
        --profile $PROFILE --region $REGION --output text 2>&1 | Out-Null
    Write-Host "    Invoke permission set" -ForegroundColor Green
}

# ============================================================
# STEP 2 — Re-wire API Gateway integrations
# ============================================================
Write-Step "Step 2: Re-wire API Gateway integrations"

# route table: resource-id, HTTP methods to update, target lambda
# Source of truth: test API Gateway integrations queried 2026-04-13
# OPTIONS methods use MOCK integrations — never touch them
$routes = @(
    # ── Catalog-API ────────────────────────────────────────────────────────────
    @{ id = "l1v5kv"; methods = @("GET", "POST"); fn = "MaterialsSelection-Catalog-API" }  # /vendors
    @{ id = "cl498j"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Catalog-API" }  # /vendors/{vendorId}
    @{ id = "kwy1cq"; methods = @("GET", "POST"); fn = "MaterialsSelection-Catalog-API" }  # /manufacturers
    @{ id = "rqx82h"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Catalog-API" }  # /manufacturers/{manufacturerId}
    @{ id = "n1du2m"; methods = @("GET", "POST"); fn = "MaterialsSelection-Catalog-API" }  # /products
    @{ id = "3vuems"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Catalog-API" }  # /products/{productId}
    @{ id = "s6o9eb"; methods = @("GET"); fn = "MaterialsSelection-Catalog-API" }  # /products/{productId}/vendors
    @{ id = "ysiueg"; methods = @("POST"); fn = "MaterialsSelection-Catalog-API" }  # /product-vendors
    @{ id = "ls1yn0"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Catalog-API" }  # /product-vendors/{id}
    # ── Core-API ───────────────────────────────────────────────────────────────
    @{ id = "cg43y3"; methods = @("GET", "POST"); fn = "MaterialsSelection-Core-API" }     # /categories
    @{ id = "w6dhje"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Core-API" }     # /categories/{categoryId}
    @{ id = "zxgtat"; methods = @("POST"); fn = "MaterialsSelection-Core-API" }     # /categories/{categoryId}/lineitems
    @{ id = "1fvbi4"; methods = @("GET", "POST"); fn = "MaterialsSelection-Core-API" }     # /lineitems
    @{ id = "udh4t7"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Core-API" }     # /lineitems/{id}
    @{ id = "61toz1"; methods = @("GET", "POST"); fn = "MaterialsSelection-Core-API" }     # /lineitems/{id}/options
    @{ id = "f6q5to"; methods = @("PUT"); fn = "MaterialsSelection-Core-API" }     # /lineitems/{id}/select-option
    @{ id = "2yxhni"; methods = @("DELETE", "PUT"); fn = "MaterialsSelection-Core-API" }     # /lineitem-options/{optionId}
    @{ id = "jcl0tr"; methods = @("GET"); fn = "MaterialsSelection-Core-API" }     # /projects/{projectId}/categories
    @{ id = "x5ekxk"; methods = @("GET"); fn = "MaterialsSelection-Core-API" }     # /projects/{projectId}/lineitems
    # ── Projects-API ───────────────────────────────────────────────────────────
    @{ id = "8o1qho"; methods = @("GET", "POST"); fn = "MaterialsSelection-Projects-API" } # /projects
    @{ id = "i3kmta"; methods = @("DELETE", "GET", "PUT"); fn = "MaterialsSelection-Projects-API" } # /projects/{projectId}
    # ── AI-API ─────────────────────────────────────────────────────────────────
    @{ id = "3zf2t7"; methods = @("POST"); fn = "MaterialsSelection-AI-API" }       # /ai/chat
    @{ id = "bfuee8"; methods = @("POST"); fn = "MaterialsSelection-AI-API" }       # /ai/test
    @{ id = "puk0kb"; methods = @("POST"); fn = "MaterialsSelection-AI-API" }       # /ai/docs
    # NOTE: Salesforce routes (fzc0ly, wkt4v8) already point to Salesforce-API — skip
    # NOTE: /lineitem-options (9drdxe) has no non-OPTIONS methods — skip
)

$updated = 0
$skipped = 0
$failed = 0

foreach ($route in $routes) {
    foreach ($method in $route.methods) {
        # Silently skip if method doesn't exist on this resource
        $null = aws apigateway get-method `
            --rest-api-id $API_ID --resource-id $route.id --http-method $method `
            --profile $PROFILE --region $REGION --output text 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  SKIP  $($route.id) $method (method not in this resource)" -ForegroundColor Yellow
            $skipped++
            continue
        }

        aws apigateway put-integration `
            --rest-api-id          $API_ID `
            --resource-id          $route.id `
            --http-method          $method `
            --type                 AWS_PROXY `
            --integration-http-method POST `
            --uri                  (LambdaUri $route.fn) `
            --passthrough-behavior WHEN_NO_MATCH `
            --profile $PROFILE --region $REGION --output text 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host ("  OK    {0,-8} {1,-8} -> {2}" -f $route.id, $method, $route.fn)
            $updated++
        }
        else {
            Write-Host "  FAIL  $($route.id) $method" -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host "`n  Updated: $updated  |  Skipped: $skipped  |  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
if ($failed -gt 0) {
    Write-Error "Some integrations failed to update — check output above before proceeding"
    exit 1
}

# ============================================================
# STEP 3 — Redeploy the API Gateway stage
# ============================================================
Write-Step "Step 3: Redeploy API stage '$STAGE'"

$dep = aws apigateway create-deployment `
    --rest-api-id  $API_ID `
    --stage-name   $STAGE `
    --description  "Split lambda migration $(Get-Date -Format 'yyyy-MM-dd HH:mm')" `
    --profile $PROFILE --region $REGION `
    --output json 2>&1 | ConvertFrom-Json

Write-Host "  Deployment ID: $($dep.id)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  All prod routes now use split lambdas:" -ForegroundColor Green
Write-Host "    Catalog-API  -> products, vendors, manufacturers, product-vendors"
Write-Host "    Core-API     -> categories, lineitems, lineitem-options"
Write-Host "    Projects-API -> projects (+ sharepoint)"
Write-Host "    Orders-API   -> orders (routes exist in test; NOT yet in prod API)"
Write-Host "    AI-API       -> ai"
Write-Host ""
Write-Host "  TODO (future): Add orders/files/sharepoint API routes to prod" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
