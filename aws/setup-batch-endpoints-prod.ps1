#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Setup batch endpoints in production API Gateway with CORS
#>

$api = "6extgb87v1"
$stage = "prod"
$region = "us-east-1"
$profile = "megapros-prod"

Write-Host "Setting up batch endpoints in production API Gateway..." -ForegroundColor Cyan

# Get all batch resources
Write-Host "Getting batch resources..."
$json = aws apigateway get-resources --rest-api-id $api --region $region --profile $profile --output json
$batchResources = $json | ConvertFrom-Json | Select-Object -ExpandProperty items | Where-Object { $_.path -like "/batch*" }

$resourceMap = @{}
$batchResources | ForEach-Object {
    $resourceMap[$_.path] = $_.id
    Write-Host "Found: $($_.path) -> $($_.id)"
}

# Define batch endpoints and their Lambda targets
$endpoints = @{
    "/batch/products"         = "MaterialsSelection-Catalog-API"
    "/batch/manufacturers"    = "MaterialsSelection-Catalog-API"
    "/batch/vendors"          = "MaterialsSelection-Catalog-API"
    "/batch/lineitem-options" = "MaterialsSelection-Core-API"
}

# For each batch endpoint, configure POST and OPTIONS
foreach ($path in $endpoints.Keys) {
    $resourceId = $resourceMap[$path]
    if (-not $resourceId) {
        Write-Host "WARNING: Resource $path not found" -ForegroundColor Yellow
        continue
    }
  
    Write-Host "`n--- Configuring $path ---" -ForegroundColor Yellow
  
    # Create POST method
    Write-Host "  Creating POST method..."
    aws apigateway put-method --rest-api-id $api --resource-id $resourceId --http-method POST --type AWS_PROXY --authorization-type NONE --region $region --profile $profile 2>&1 | Out-Null
  
    # Create method response with CORS headers
    Write-Host "  Setting up POST response..."
    $methodResp = '{"method.response.header.Access-Control-Allow-Origin":true,"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true}'
    aws apigateway put-method-response --rest-api-id $api --resource-id $resourceId --http-method POST --status-code 200 --response-models '{}' --response-parameters $methodResp --region $region --profile $profile 2>&1 | Out-Null
  
    # Create integration (Lambda)
    $lambdaArn = "arn:aws:apigateway:$region`:lambda:path/2015-03-31/functions/$($endpoints[$path])/invocations"
    Write-Host "  Creating integration with $($endpoints[$path])..."
    aws apigateway put-integration --rest-api-id $api --resource-id $resourceId --http-method POST --type AWS_PROXY --uri $lambdaArn --integration-http-method POST --region $region --profile $profile 2>&1 | Out-Null
  
    # Create integration response (maps Lambda headers to method response)
    Write-Host "  Mapping integration response..."
    $integResp = '{"method.response.header.Access-Control-Allow-Origin":"integration.response.header.Access-Control-Allow-Origin","method.response.header.Access-Control-Allow-Headers":"integration.response.header.Access-Control-Allow-Headers","method.response.header.Access-Control-Allow-Methods":"integration.response.header.Access-Control-Allow-Methods"}'
    aws apigateway put-integration-response --rest-api-id $api --resource-id $resourceId --http-method POST --status-code 200 --response-templates '{"application/json":""}' --response-parameters $integResp --region $region --profile $profile 2>&1 | Out-Null
  
    # Create OPTIONS method for CORS preflight
    Write-Host "  Creating OPTIONS method for CORS preflight..."
    aws apigateway put-method --rest-api-id $api --resource-id $resourceId --http-method OPTIONS --type MOCK --authorization-type NONE --region $region --profile $profile 2>&1 | Out-Null
  
    # OPTIONS method response
    Write-Host "  Setting up OPTIONS response..."
    $optionsResp = '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}'
    aws apigateway put-method-response --rest-api-id $api --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-models '{}' --response-parameters $optionsResp --region $region --profile $profile 2>&1 | Out-Null
  
    # OPTIONS integration (mock)
    Write-Host "  Creating OPTIONS integration..."
    aws apigateway put-integration --rest-api-id $api --resource-id $resourceId --http-method OPTIONS --type MOCK --integration-http-method POST --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $region --profile $profile 2>&1 | Out-Null
  
    # OPTIONS integration response
    Write-Host "  Mapping OPTIONS integration response..."
    $optionsIntegResp = '{"method.response.header.Access-Control-Allow-Headers":"Content-Type,Authorization","method.response.header.Access-Control-Allow-Methods":"POST,OPTIONS","method.response.header.Access-Control-Allow-Origin":"*"}'
    aws apigateway put-integration-response --rest-api-id $api --resource-id $resourceId --http-method OPTIONS --status-code 200 --response-templates '{"application/json":""}' --response-parameters $optionsIntegResp --region $region --profile $profile 2>&1 | Out-Null
  
    Write-Host "  * $path configured" -ForegroundColor Green
}

Write-Host "`nCreating deployment..." -ForegroundColor Cyan
$deployment = aws apigateway create-deployment --rest-api-id $api --stage-name $stage --region $region --profile $profile --query 'id' --output text

Write-Host "* Deployment created: $deployment" -ForegroundColor Green
Write-Host "* All batch endpoints ready in production!" -ForegroundColor Green
