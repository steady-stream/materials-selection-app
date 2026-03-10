#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Reroute API Gateway integrations from the monolith to the 5 domain Lambdas,
    and create the missing Orders/Receipts routes.

.DESCRIPTION
    Phase 1 — Update existing integrations (put-integration)
    Phase 2 — Add Lambda invoke permissions
    Phase 3 — Create missing Orders/Receipts/OrderItems resources + methods
    Phase 4 — Deploy API Gateway stage

.NOTES
    REST API  : xrld1hq3e2  (test)
    Stage     : prod
    Account   : 634752426026
    Region    : us-east-1
    Profile   : megapros-test
#>

$ErrorActionPreference = "Stop"

$PROFILE = "megapros-test"
$REGION = "us-east-1"
$ACCOUNT = "634752426026"
$API = "xrld1hq3e2"
$STAGE = "prod"
$ROOT_ID = "bvnxzqxftg"   # resource id for "/"
$PROJ_ID = "6yfsm9"       # /projects/{projectId}

# ---- Lambda ARN builder -------------------------------------------------------
function Get-LambdaUri([string]$fnName) {
    return "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT}:function:${fnName}/invocations"
}

$LAMBDA = @{
    Projects = Get-LambdaUri "MaterialsSelection-Projects-API"
    Core     = Get-LambdaUri "MaterialsSelection-Core-API"
    Catalog  = Get-LambdaUri "MaterialsSelection-Catalog-API"
    Orders   = Get-LambdaUri "MaterialsSelection-Orders-API"
    AI       = Get-LambdaUri "MaterialsSelection-AI-API"
}

# ---- APIGW CLI wrappers -------------------------------------------------------
function Update-Integration([string]$resourceId, [string]$method, [string]$lambdaUri) {
    $r = aws apigateway put-integration `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --type AWS_PROXY `
        --integration-http-method POST `
        --uri $lambdaUri `
        --profile $PROFILE --region $REGION 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  put-integration failed: $resourceId $method => $($r)"
    }
}

function Ensure-Method([string]$resourceId, [string]$method) {
    # put-method is idempotent — safe to re-run
    aws apigateway put-method `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --authorization-type NONE `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function Ensure-MethodResponse([string]$resourceId, [string]$method, [string]$statusCode = "200") {
    aws apigateway put-method-response `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --status-code $statusCode `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function Add-CorsOptions([string]$resourceId, [string]$allowedMethods) {
    # Mock integration for OPTIONS (preflight)
    aws apigateway put-method `
        --rest-api-id $API --resource-id $resourceId `
        --http-method OPTIONS --authorization-type NONE `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null

    aws apigateway put-integration `
        --rest-api-id $API --resource-id $resourceId `
        --http-method OPTIONS --type MOCK `
        --request-templates '{"application/json":"{\"statusCode\":200}"}' `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null

    aws apigateway put-method-response `
        --rest-api-id $API --resource-id $resourceId `
        --http-method OPTIONS --status-code 200 `
        --response-parameters @{
        "method.response.header.Access-Control-Allow-Headers" = $false
        "method.response.header.Access-Control-Allow-Methods" = $false
        "method.response.header.Access-Control-Allow-Origin"  = $false
    } `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null

    $responseParams = @{
        "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
        "method.response.header.Access-Control-Allow-Methods" = "'$allowedMethods'"
        "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    }
    aws apigateway put-integration-response `
        --rest-api-id $API --resource-id $resourceId `
        --http-method OPTIONS --status-code 200 `
        --response-parameters $responseParams `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function New-Resource([string]$parentId, [string]$pathPart) {
    $result = aws apigateway create-resource `
        --rest-api-id $API `
        --parent-id $parentId `
        --path-part $pathPart `
        --output json `
        --profile $PROFILE --region $REGION 2>&1 | ConvertFrom-Json
    return $result.id
}

function Add-LambdaPermission([string]$fnName) {
    $statementId = "apigw-invoke-$(Get-Date -Format 'yyyyMMddHHmmss')-$fnName"
    aws lambda add-permission `
        --function-name $fnName `
        --statement-id $statementId `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API}/*/*" `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    Lambda permission added: $fnName" -ForegroundColor Gray
    }
    # Exit code 1 = "already exists" — not a real error
}

# ==============================================================================
# Pre-flight
# ==============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Updating API Gateway Route Integrations" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne $ACCOUNT) {
    Write-Error "Profile returned account '$account', expected $ACCOUNT"
    exit 1
}
Write-Host "Verified: AWS account $account (test)" -ForegroundColor Green

# Verify all 5 new Lambdas exist before touching API GW
$newFunctions = @(
    "MaterialsSelection-Projects-API",
    "MaterialsSelection-Core-API",
    "MaterialsSelection-Catalog-API",
    "MaterialsSelection-Orders-API",
    "MaterialsSelection-AI-API"
)
foreach ($fn in $newFunctions) {
    aws lambda get-function --function-name $fn --profile $PROFILE --region $REGION 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Lambda '$fn' not found. Run deploy-new-lambdas.ps1 first."
        exit 1
    }
}
Write-Host "All 5 domain Lambdas verified." -ForegroundColor Green

# ==============================================================================
# Phase 1 — Add Lambda invoke permissions
# ==============================================================================
Write-Host ""
Write-Host "Phase 1: Lambda invoke permissions..." -ForegroundColor Cyan

foreach ($fn in $newFunctions) {
    Add-LambdaPermission $fn
}

# ==============================================================================
# Phase 2 — Update existing route integrations
# ==============================================================================
Write-Host ""
Write-Host "Phase 2: Re-pointing API Gateway integrations..." -ForegroundColor Cyan

# ---- Projects Lambda ----------------------------------------------------------
Write-Host "  Projects Lambda..."
# GET /projects (currently points to old MaterialsSelection-GetProjects)
Update-Integration "5hsdxi"  "GET"    $LAMBDA.Projects
Update-Integration "5hsdxi"  "POST"   $LAMBDA.Projects
Update-Integration "6yfsm9"  "GET"    $LAMBDA.Projects
Update-Integration "6yfsm9"  "PUT"    $LAMBDA.Projects
Update-Integration "6yfsm9"  "DELETE" $LAMBDA.Projects
# /sharepoint/config
Update-Integration "2zxkl1"  "GET"    $LAMBDA.Projects
# /projects/{projectId}/sharepoint/folders
Update-Integration "nod7n9"  "GET"    $LAMBDA.Projects
# /projects/{projectId}/sharepoint/link
Update-Integration "r2t74e"  "POST"   $LAMBDA.Projects
Write-Host "    Done." -ForegroundColor Gray

# ---- Core Lambda --------------------------------------------------------------
Write-Host "  Core Lambda..."
# /categories
Update-Integration "2jek2u"  "GET"    $LAMBDA.Core
Update-Integration "2jek2u"  "POST"   $LAMBDA.Core
# /categories/{categoryId}
Update-Integration "elc5aw"  "GET"    $LAMBDA.Core
Update-Integration "elc5aw"  "PUT"    $LAMBDA.Core
Update-Integration "elc5aw"  "DELETE" $LAMBDA.Core
# /categories/{categoryId}/lineitems
Update-Integration "5kpowd"  "GET"    $LAMBDA.Core
Update-Integration "5kpowd"  "POST"   $LAMBDA.Core
# /lineitems
Update-Integration "kts8z1"  "GET"    $LAMBDA.Core
Update-Integration "kts8z1"  "POST"   $LAMBDA.Core
# /lineitems/{id}
Update-Integration "pphjcn"  "GET"    $LAMBDA.Core
Update-Integration "pphjcn"  "PUT"    $LAMBDA.Core
Update-Integration "pphjcn"  "DELETE" $LAMBDA.Core
# /lineitems/{id}/select-option
Update-Integration "751462"  "PUT"    $LAMBDA.Core
# /lineitems/{id}/options
Update-Integration "apbt0y"  "GET"    $LAMBDA.Core
# /lineitem-options
Update-Integration "ofnca5"  "GET"    $LAMBDA.Core
Update-Integration "ofnca5"  "POST"   $LAMBDA.Core
# /lineitem-options/{optionId}
Update-Integration "nvzfl5"  "GET"    $LAMBDA.Core
Update-Integration "nvzfl5"  "PUT"    $LAMBDA.Core
Update-Integration "nvzfl5"  "DELETE" $LAMBDA.Core
# /projects/{projectId}/categories
Update-Integration "sfrh0z"  "GET"    $LAMBDA.Core
# /projects/{projectId}/lineitems
Update-Integration "8uendb"  "GET"    $LAMBDA.Core
Write-Host "    Done." -ForegroundColor Gray

# ---- Catalog Lambda -----------------------------------------------------------
Write-Host "  Catalog Lambda..."
# /vendors
Update-Integration "3f6bow"  "GET"    $LAMBDA.Catalog
Update-Integration "3f6bow"  "POST"   $LAMBDA.Catalog
# /vendors/{vendorId}
Update-Integration "yla3k3"  "GET"    $LAMBDA.Catalog
Update-Integration "yla3k3"  "PUT"    $LAMBDA.Catalog
Update-Integration "yla3k3"  "DELETE" $LAMBDA.Catalog
# /manufacturers
Update-Integration "6t75zr"  "GET"    $LAMBDA.Catalog
Update-Integration "6t75zr"  "POST"   $LAMBDA.Catalog
# /manufacturers/{manufacturerId}
Update-Integration "sfq8od"  "GET"    $LAMBDA.Catalog
Update-Integration "sfq8od"  "PUT"    $LAMBDA.Catalog
Update-Integration "sfq8od"  "DELETE" $LAMBDA.Catalog
# /products
Update-Integration "1z63lw"  "GET"    $LAMBDA.Catalog
Update-Integration "1z63lw"  "POST"   $LAMBDA.Catalog
# /products/{productId}
Update-Integration "m83lje"  "GET"    $LAMBDA.Catalog
Update-Integration "m83lje"  "PUT"    $LAMBDA.Catalog
Update-Integration "m83lje"  "DELETE" $LAMBDA.Catalog
# /products/{productId}/vendors
Update-Integration "ax2msi"  "GET"    $LAMBDA.Catalog
# /product-vendors
Update-Integration "2cqzh6"  "GET"    $LAMBDA.Catalog
Update-Integration "2cqzh6"  "POST"   $LAMBDA.Catalog
# /product-vendors/{id}
Update-Integration "oahf6q"  "GET"    $LAMBDA.Catalog
Update-Integration "oahf6q"  "PUT"    $LAMBDA.Catalog
Update-Integration "oahf6q"  "DELETE" $LAMBDA.Catalog
Write-Host "    Done." -ForegroundColor Gray

# ---- AI Lambda ----------------------------------------------------------------
Write-Host "  AI Lambda..."
Update-Integration "907j2b"  "POST"   $LAMBDA.AI
Update-Integration "lpbzyd"  "POST"   $LAMBDA.AI
Update-Integration "mayoy1"  "POST"   $LAMBDA.AI
Write-Host "    Done." -ForegroundColor Gray

# ==============================================================================
# Phase 3 — Create missing Orders / OrderItems / Receipts routes
# ==============================================================================
Write-Host ""
Write-Host "Phase 3: Creating Orders/Receipts API Gateway resources..." -ForegroundColor Cyan

# /orders  (top-level under root)
Write-Host "  Creating /orders..."
$ordersId = New-Resource $ROOT_ID "orders"
Ensure-Method $ordersId "POST"
Update-Integration $ordersId "POST" $LAMBDA.Orders
Ensure-MethodResponse $ordersId "POST" "201"
Add-CorsOptions $ordersId "POST,OPTIONS"

# /orders/{id}
Write-Host "  Creating /orders/{id}..."
$orderItemId = New-Resource $ordersId "{id}"
foreach ($m in @("GET", "PUT", "DELETE")) {
    Ensure-Method $orderItemId $m
    Update-Integration $orderItemId $m $LAMBDA.Orders
    Ensure-MethodResponse $orderItemId $m "200"
}
Add-CorsOptions $orderItemId "GET,PUT,DELETE,OPTIONS"

# /orders/{id}/items
Write-Host "  Creating /orders/{id}/items..."
$orderItemsId = New-Resource $orderItemId "items"
Ensure-Method $orderItemsId "GET"
Update-Integration $orderItemsId "GET" $LAMBDA.Orders
Ensure-MethodResponse $orderItemsId "GET" "200"
Add-CorsOptions $orderItemsId "GET,OPTIONS"

# /orders/{id}/receipts
Write-Host "  Creating /orders/{id}/receipts..."
$orderReceiptsId = New-Resource $orderItemId "receipts"
Ensure-Method $orderReceiptsId "GET"
Update-Integration $orderReceiptsId "GET" $LAMBDA.Orders
Ensure-MethodResponse $orderReceiptsId "GET" "200"
Add-CorsOptions $orderReceiptsId "GET,OPTIONS"

# /projects/{projectId}/orders  (under existing /projects/{projectId})
Write-Host "  Creating /projects/{projectId}/orders..."
$projOrdersId = New-Resource $PROJ_ID "orders"
Ensure-Method $projOrdersId "GET"
Update-Integration $projOrdersId "GET" $LAMBDA.Orders
Ensure-MethodResponse $projOrdersId "GET" "200"
Add-CorsOptions $projOrdersId "GET,OPTIONS"

# /orderitems  (top-level)
Write-Host "  Creating /orderitems..."
$orderItemsRootId = New-Resource $ROOT_ID "orderitems"
Ensure-Method $orderItemsRootId "POST"
Update-Integration $orderItemsRootId "POST" $LAMBDA.Orders
Ensure-MethodResponse $orderItemsRootId "POST" "201"
Add-CorsOptions $orderItemsRootId "POST,OPTIONS"

# /orderitems/{id}
Write-Host "  Creating /orderitems/{id}..."
$orderItemsItemId = New-Resource $orderItemsRootId "{id}"
Ensure-Method $orderItemsItemId "DELETE"
Update-Integration $orderItemsItemId "DELETE" $LAMBDA.Orders
Ensure-MethodResponse $orderItemsItemId "DELETE" "204"
Add-CorsOptions $orderItemsItemId "DELETE,OPTIONS"

# /projects/{projectId}/orderitems  (under existing /projects/{projectId})
Write-Host "  Creating /projects/{projectId}/orderitems..."
$projOrderItemsId = New-Resource $PROJ_ID "orderitems"
Ensure-Method $projOrderItemsId "GET"
Update-Integration $projOrderItemsId "GET" $LAMBDA.Orders
Ensure-MethodResponse $projOrderItemsId "GET" "200"
Add-CorsOptions $projOrderItemsId "GET,OPTIONS"

# /receipts  (top-level)
Write-Host "  Creating /receipts..."
$receiptsId = New-Resource $ROOT_ID "receipts"
Ensure-Method $receiptsId "POST"
Update-Integration $receiptsId "POST" $LAMBDA.Orders
Ensure-MethodResponse $receiptsId "POST" "201"
Add-CorsOptions $receiptsId "POST,OPTIONS"

# /receipts/{id}
Write-Host "  Creating /receipts/{id}..."
$receiptsItemId = New-Resource $receiptsId "{id}"
Ensure-Method $receiptsItemId "DELETE"
Update-Integration $receiptsItemId "DELETE" $LAMBDA.Orders
Ensure-MethodResponse $receiptsItemId "DELETE" "204"
Add-CorsOptions $receiptsItemId "DELETE,OPTIONS"

Write-Host "  Orders routes created." -ForegroundColor Gray

# ==============================================================================
# Phase 4 — Deploy API Gateway stage
# ==============================================================================
Write-Host ""
Write-Host "Phase 4: Deploying API Gateway stage '$STAGE'..." -ForegroundColor Cyan

$deployResult = aws apigateway create-deployment `
    --rest-api-id $API `
    --stage-name $STAGE `
    --description "Route integrations: 5 domain Lambdas + orders routes" `
    --output json `
    --profile $PROFILE --region $REGION 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Error "create-deployment failed"
    exit 1
}

# ==============================================================================
# Summary
# ==============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  API Gateway update complete!" -ForegroundColor Green
Write-Host "  Deployment ID: $($deployResult.id)" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Route summary:" -ForegroundColor Yellow
Write-Host "  Projects  -> MaterialsSelection-Projects-API" -ForegroundColor White
Write-Host "  Core      -> MaterialsSelection-Core-API" -ForegroundColor White
Write-Host "  Catalog   -> MaterialsSelection-Catalog-API" -ForegroundColor White
Write-Host "  Orders    -> MaterialsSelection-Orders-API  (NEW routes created)" -ForegroundColor White
Write-Host "  AI        -> MaterialsSelection-AI-API" -ForegroundColor White
Write-Host ""
Write-Host "Next: smoke-test the API, then decommission old per-function Lambdas." -ForegroundColor Yellow
Write-Host ""
