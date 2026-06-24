#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Adds the complete orders/orderitems/receipts route set to the production API Gateway.

.NOTES
    Run from project root: .\add-prod-orders-routes.ps1
    One-time script — safe to re-run (will error on already-existing resources, which can be ignored).
#>

$ErrorActionPreference = "Stop"
$api = "6extgb87v1"
$profile = "megapros-prod"
$region = "us-east-1"
$root = "8m994af4jb"   # /
$projId = "i3kmta"       # /projects/{projectId}
$ordersUri = "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${region}:860601623272:function:MaterialsSelection-Orders-API/invocations"

function New-Res([string]$parent, [string]$part) {
    $r = aws apigateway create-resource `
        --rest-api-id $api --parent-id $parent --path-part $part `
        --profile $profile --region $region --output json | ConvertFrom-Json
    return $r.id
}
function Add-LambdaMethod([string]$rid, [string]$method) {
    aws apigateway put-method --rest-api-id $api --resource-id $rid `
        --http-method $method --authorization-type NONE `
        --profile $profile --region $region | Out-Null
    aws apigateway put-integration --rest-api-id $api --resource-id $rid `
        --http-method $method --type AWS_PROXY --integration-http-method POST `
        --uri $ordersUri --profile $profile --region $region | Out-Null
}
function Add-MockOptions([string]$rid, [string]$methods) {
    aws apigateway put-method --rest-api-id $api --resource-id $rid `
        --http-method OPTIONS --authorization-type NONE `
        --profile $profile --region $region 2>&1 | Out-Null
    aws apigateway put-integration --rest-api-id $api --resource-id $rid `
        --http-method OPTIONS --type MOCK `
        --request-templates '{"application/json":"{\"statusCode\":200}"}' `
        --profile $profile --region $region | Out-Null
    aws apigateway put-method-response --rest-api-id $api --resource-id $rid `
        --http-method OPTIONS --status-code 200 `
        --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" `
        --profile $profile --region $region | Out-Null
    aws apigateway put-integration-response --rest-api-id $api --resource-id $rid `
        --http-method OPTIONS --status-code 200 `
        --response-parameters "method.response.header.Access-Control-Allow-Headers='Content-Type,Authorization',method.response.header.Access-Control-Allow-Methods='$methods',method.response.header.Access-Control-Allow-Origin='*'" `
        --profile $profile --region $region | Out-Null
}

Write-Host "=== Adding Orders routes to production API Gateway ===" -ForegroundColor Cyan
$account = aws sts get-caller-identity --profile $profile --query "Account" --output text
if ($account -ne "860601623272") { Write-Error "Wrong account: $account"; exit 1 }
Write-Host "Account verified: $account" -ForegroundColor Green

# /projects/{projectId}/orders  — GET project orders
Write-Host "`n[1/9] /projects/{projectId}/orders..."
$projOrders = New-Res $projId "orders"
Add-LambdaMethod $projOrders "GET"
Add-MockOptions  $projOrders "GET,OPTIONS"

# /projects/{projectId}/orderitems — GET all order items for project
Write-Host "[2/9] /projects/{projectId}/orderitems..."
$projOrderItems = New-Res $projId "orderitems"
Add-LambdaMethod $projOrderItems "GET"
Add-MockOptions  $projOrderItems "GET,OPTIONS"

# /orders  — POST create order
Write-Host "[3/9] /orders..."
$ordersRoot = New-Res $root "orders"
Add-LambdaMethod $ordersRoot "POST"
Add-MockOptions  $ordersRoot "POST,OPTIONS"

# /orders/{id}  — GET, PUT, DELETE
Write-Host "[4/9] /orders/{id}..."
$ordersItem = New-Res $ordersRoot "{id}"
foreach ($m in @("GET", "PUT", "DELETE")) { Add-LambdaMethod $ordersItem $m }
Add-MockOptions $ordersItem "GET,PUT,DELETE,OPTIONS"

# /orders/{id}/items  — GET order items
Write-Host "[5/9] /orders/{id}/items..."
$orderItemsPath = New-Res $ordersItem "items"
Add-LambdaMethod $orderItemsPath "GET"
Add-MockOptions  $orderItemsPath "GET,OPTIONS"

# /orders/{id}/receipts  — GET receipts for order
Write-Host "[6/9] /orders/{id}/receipts..."
$orderReceiptsPath = New-Res $ordersItem "receipts"
Add-LambdaMethod $orderReceiptsPath "GET"
Add-MockOptions  $orderReceiptsPath "GET,OPTIONS"

# /orderitems  — POST
Write-Host "[7/9] /orderitems..."
$orderitemsRoot = New-Res $root "orderitems"
Add-LambdaMethod $orderitemsRoot "POST"
Add-MockOptions  $orderitemsRoot "POST,OPTIONS"

# /orderitems/{id}  — DELETE
Write-Host "[8/9] /orderitems/{id}..."
$orderitemsItem = New-Res $orderitemsRoot "{id}"
Add-LambdaMethod $orderitemsItem "DELETE"
Add-MockOptions  $orderitemsItem "DELETE,OPTIONS"

# /receipts  — POST
Write-Host "[9a/9] /receipts..."
$receiptsRoot = New-Res $root "receipts"
Add-LambdaMethod $receiptsRoot "POST"
Add-MockOptions  $receiptsRoot "POST,OPTIONS"

# /receipts/{id}  — DELETE
Write-Host "[9b/9] /receipts/{id}..."
$receiptsItem = New-Res $receiptsRoot "{id}"
Add-LambdaMethod $receiptsItem "DELETE"
Add-MockOptions  $receiptsItem "DELETE,OPTIONS"

# Deploy
Write-Host "`nDeploying API stage..."
$dep = aws apigateway create-deployment --rest-api-id $api --stage-name prod `
    --description "Add orders/orderitems/receipts route parity $(Get-Date -Format 'yyyy-MM-dd')" `
    --profile $profile --region $region --query id --output text

Write-Host ""
Write-Host "=== Complete! ===" -ForegroundColor Green
Write-Host "Deployment: $dep"
Write-Host ""
Write-Host "Resource IDs (add to migrate-prod-lambdas.ps1):"
Write-Host "  projOrders=$projOrders  projOrderItems=$projOrderItems"
Write-Host "  ordersRoot=$ordersRoot  ordersItem=$ordersItem"
Write-Host "  orderItemsPath=$orderItemsPath  orderReceiptsPath=$orderReceiptsPath"
Write-Host "  orderitemsRoot=$orderitemsRoot  orderitemsItem=$orderitemsItem"
Write-Host "  receiptsRoot=$receiptsRoot  receiptsItem=$receiptsItem"
