#!/usr/bin/env pwsh
# Fix CORS method responses for production API Gateway
# This script fixes the issue where method responses lack CORS header declarations

$ErrorActionPreference = "Stop"

$apiId = "6extgb87v1"
$profile = "megapros-prod"

# Define resources with their HTTP methods
$resources = @(
    @{ id = "3vuems"; path = "/products/{productId}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "rqx82h"; path = "/manufacturers/{manufacturerId}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "w6dhje"; path = "/categories/{categoryId}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "61toz1"; path = "/lineitems/{id}/options"; methods = @("GET", "POST") }
    @{ id = "cl498j"; path = "/vendors/{vendorId}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "n1du2m"; path = "/products"; methods = @("GET", "POST") }
    @{ id = "kwy1cq"; path = "/manufacturers"; methods = @("GET", "POST") }
    @{ id = "cg43y3"; path = "/categories"; methods = @("GET", "POST") }
    @{ id = "l1v5kv"; path = "/vendors"; methods = @("GET", "POST") }
    @{ id = "1fvbi4"; path = "/lineitems"; methods = @("GET", "POST") }
    @{ id = "udh4t7"; path = "/lineitems/{id}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "ysiueg"; path = "/product-vendors"; methods = @("GET", "POST") }
    @{ id = "ls1yn0"; path = "/product-vendors/{id}"; methods = @("GET", "PUT", "DELETE") }
    @{ id = "8o1qho"; path = "/projects"; methods = @("GET", "POST") }
    @{ id = "i3kmta"; path = "/projects/{projectId}"; methods = @("GET", "PUT", "DELETE") }
)

$updated = 0
$failed = 0

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Fixing CORS Method Responses" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

foreach ($resource in $resources) {
    $rid = $resource.id
    $path = $resource.path
    
    foreach ($method in $resource.methods) {
        Write-Host "Fixing $path $method..." -ForegroundColor Yellow
        
        try {
            # Step 1: Create or update method response with CORS header parameters
            $resp = & aws apigateway put-method-response `
                --rest-api-id $apiId `
                --resource-id $rid `
                --http-method $method `
                --status-code 200 `
                --response-parameters method.response.header.Access-Control-Allow-Origin=true,method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true `
                --profile $profile 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                throw "put-method-response failed: $resp"
            }
            Write-Host "  ✓ Method response created" -ForegroundColor Green
            
            # Step 2: Create integration response with header mapping
            $resp = & aws apigateway put-integration-response `
                --rest-api-id $apiId `
                --resource-id $rid `
                --http-method $method `
                --status-code 200 `
                --response-parameters method.response.header.Access-Control-Allow-Origin=integration.response.header.Access-Control-Allow-Origin,method.response.header.Access-Control-Allow-Headers=integration.response.header.Access-Control-Allow-Headers,method.response.header.Access-Control-Allow-Methods=integration.response.header.Access-Control-Allow-Methods `
                --response-templates '{"application/json":""}' `
                --profile $profile 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                throw "put-integration-response failed: $resp"
            }
            Write-Host "  ✓ Integration response configured" -ForegroundColor Green
            $updated++
            
        } catch {
            Write-Host "  ✗ Error: $_" -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host "`nUpdated: $updated  |  Failed: $failed`n" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "Redeploying API stage..." -ForegroundColor Cyan
    $deployment = & aws apigateway create-deployment `
        --rest-api-id $apiId `
        --stage-name prod `
        --description "CORS method response fix" `
        --profile $profile `
        --query 'id' `
        --output text
    
    Write-Host "✓ Deployment successful: $deployment`n" -ForegroundColor Green
} else {
    Write-Host "⚠ Some configurations failed. Please review the errors above." -ForegroundColor Yellow
}
