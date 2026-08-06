#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Adds CORS headers to ALL production API Gateway routes that are missing them.
    Fixes PowerPoint export CORS failures on /vendors/{id}, /manufacturers/{id}, /lineitems/{id}/options.

.DESCRIPTION
    1. Adds OPTIONS methods with CORS headers to each resource
    2. Configures method-response and integration-response for CORS
    3. Redeploys the API Gateway stage

.NOTES
    Run from project root: .\add-prod-all-cors-headers.ps1
#>

$api = "6extgb87v1"
$profile = "megapros-prod"
$region = "us-east-1"
$stage = "prod"

# Resource IDs that need CORS headers (from migrate-prod-lambdas.ps1)
# These are routes that the PowerPoint export calls
$resourceIds = @(
    @{ id = "l1v5kv"; name = "/vendors" }
    @{ id = "cl498j"; name = "/vendors/{vendorId}" }
    @{ id = "kwy1cq"; name = "/manufacturers" }
    @{ id = "rqx82h"; name = "/manufacturers/{manufacturerId}" }
    @{ id = "n1du2m"; name = "/products" }
    @{ id = "3vuems"; name = "/products/{productId}" }
    @{ id = "ysiueg"; name = "/product-vendors" }
    @{ id = "ls1yn0"; name = "/product-vendors/{id}" }
    @{ id = "cg43y3"; name = "/categories" }
    @{ id = "w6dhje"; name = "/categories/{categoryId}" }
    @{ id = "1fvbi4"; name = "/lineitems" }
    @{ id = "udh4t7"; name = "/lineitems/{id}" }
    @{ id = "61toz1"; name = "/lineitems/{id}/options" }
    @{ id = "8o1qho"; name = "/projects" }
    @{ id = "i3kmta"; name = "/projects/{projectId}" }
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Add CORS to Production API Routes" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$updated = 0
$failed = 0

foreach ($resource in $resourceIds) {
    $rid = $resource.id
    $name = $resource.name

    Write-Host "Processing $name ($rid)..." -ForegroundColor Cyan

    # 1. Ensure OPTIONS method exists
    $null = aws apigateway get-method `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS `
        --profile $profile --region $region 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        # Create OPTIONS method
        aws apigateway put-method `
            --rest-api-id $api --resource-id $rid --http-method OPTIONS `
            --authorization-type NONE `
            --profile $profile --region $region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ OPTIONS method created"
        }
        else {
            Write-Host "  ✗ Failed to create OPTIONS method" -ForegroundColor Red
            $failed++
            continue
        }
    }
    else {
        Write-Host "  ✓ OPTIONS method exists"
    }

    # 2. Try to get existing method response; if not, create it
    $null = aws apigateway get-method-response `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
        --profile $profile --region $region 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        aws apigateway put-method-response `
            --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
            --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" `
            --profile $profile --region $region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Method response created"
        }
        else {
            Write-Host "  ✗ Failed to create method response" -ForegroundColor Red
            $failed++
            continue
        }
    }
    else {
        Write-Host "  ✓ Method response exists"
    }

    # 3. Ensure mock integration exists
    $null = aws apigateway get-integration `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS `
        --profile $profile --region $region 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        aws apigateway put-integration `
            --rest-api-id $api --resource-id $rid --http-method OPTIONS `
            --type MOCK `
            --request-templates '{"application/json":"{\\"statusCode\\": 200}"}' `
            --profile $profile --region $region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Mock integration created"
        }
        else {
            Write-Host "  ✗ Failed to create mock integration" -ForegroundColor Red
            $failed++
            continue
        }
    }
    else {
        Write-Host "  ✓ Mock integration exists"
    }

    # 4. Update integration response with CORS headers (this works even if it exists)
    # AWS expects values quoted with single quotes to be treated as literals, not mapping expressions
    $corsParams = @{
        "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
        "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
        "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    }
    
    $tmpFile = [System.IO.Path]::GetTempFileName() + ".json"
    $corsParams | ConvertTo-Json | Set-Content -Path $tmpFile -Encoding utf8
    
    aws apigateway put-integration-response `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
        --response-parameters "file://$tmpFile" `
        --profile $profile --region $region | Out-Null
    
    Remove-Item $tmpFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Integration response with CORS headers set"
        $updated++
    }
    else {
        Write-Host "  ✗ Failed to set integration response" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Updated: $updated  |  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

if ($failed -eq 0) {
    # Redeploy the API Gateway stage
    Write-Host ""
    Write-Host "Redeploying API stage..." -ForegroundColor Cyan
    
    $dep = aws apigateway create-deployment `
        --rest-api-id $api --stage-name $stage `
        --description "Add CORS headers $(Get-Date -Format 'yyyy-MM-dd HH:mm')" `
        --profile $profile --region $region `
        --query 'id' --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deployment successful: $dep" -ForegroundColor Green
    }
    else {
        Write-Host "Deployment failed" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Error "Some CORS configurations failed — check output above"
    exit 1
}

Write-Host ""
Write-Host "✓ CORS headers added to all routes" -ForegroundColor Green
Write-Host ""
