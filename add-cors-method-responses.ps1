#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Adds CORS response headers to GET/POST/PUT/DELETE method responses in production API Gateway.
    This allows Lambda-returned CORS headers to pass through to the client.
#>

$api = "6extgb87v1"
$profile = "megapros-prod"
$region = "us-east-1"

# Methods that need CORS headers in their response configuration
$routes = @(
    @{ id = "l1v5kv"; methods = @("GET", "POST") }  # /vendors
    @{ id = "cl498j"; methods = @("DELETE", "GET", "PUT") }  # /vendors/{vendorId}
    @{ id = "kwy1cq"; methods = @("GET", "POST") }  # /manufacturers
    @{ id = "rqx82h"; methods = @("DELETE", "GET", "PUT") }  # /manufacturers/{manufacturerId}
    @{ id = "n1du2m"; methods = @("GET", "POST") }  # /products
    @{ id = "3vuems"; methods = @("DELETE", "GET", "PUT") }  # /products/{productId}
    @{ id = "ysiueg"; methods = @("GET", "POST") }  # /product-vendors
    @{ id = "ls1yn0"; methods = @("DELETE", "GET", "PUT") }  # /product-vendors/{id}
    @{ id = "cg43y3"; methods = @("GET", "POST") }  # /categories
    @{ id = "w6dhje"; methods = @("DELETE", "GET", "PUT") }  # /categories/{categoryId}
    @{ id = "1fvbi4"; methods = @("GET", "POST") }  # /lineitems
    @{ id = "udh4t7"; methods = @("DELETE", "GET", "PUT") }  # /lineitems/{id}
    @{ id = "61toz1"; methods = @("GET", "POST") }  # /lineitems/{id}/options
    @{ id = "8o1qho"; methods = @("GET", "POST") }  # /projects
    @{ id = "i3kmta"; methods = @("DELETE", "GET", "PUT") }  # /projects/{projectId}
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Add CORS Headers to Method Responses" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$updated = 0
$failed = 0

foreach ($route in $routes) {
    foreach ($method in $route.methods) {
        Write-Host "Configuring $($route.id) $method..." -ForegroundColor Cyan

        # Check if method exists
        $null = aws apigateway get-method `
            --rest-api-id $api --resource-id $route.id --http-method $method `
            --profile $profile --region $region 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  SKIP  (method does not exist)"
            continue
        }

        # Check if 200 response exists, if not create it
        $null = aws apigateway get-method-response `
            --rest-api-id $api --resource-id $route.id --http-method $method --status-code 200 `
            --profile $profile --region $region 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            # Create the 200 response
            aws apigateway put-method-response `
                --rest-api-id $api --resource-id $route.id --http-method $method --status-code 200 `
                --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" `
                --profile $profile --region $region 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Created method response with CORS headers"
                $updated++
            }
            else {
                Write-Host "  ✗ Failed to create method response" -ForegroundColor Red
                $failed++
                continue
            }
        }
        else {
            Write-Host "  ✓ Method response already exists"
        }

        # Configure integration response to map Lambda headers to method response headers
        # This is the critical step that passes CORS headers from Lambda through to the client
        $corsParams = @{
            "method.response.header.Access-Control-Allow-Origin"  = "integration.response.header.Access-Control-Allow-Origin"
            "method.response.header.Access-Control-Allow-Headers" = "integration.response.header.Access-Control-Allow-Headers"
            "method.response.header.Access-Control-Allow-Methods" = "integration.response.header.Access-Control-Allow-Methods"
        }
        
        $tmpFile = [System.IO.Path]::GetTempFileName() + ".json"
        $corsParams | ConvertTo-Json | Set-Content -Path $tmpFile -Encoding utf8
        
        aws apigateway put-integration-response `
            --rest-api-id $api --resource-id $route.id --http-method $method --status-code 200 `
            --response-parameters "file://$tmpFile" `
            --profile $profile --region $region 2>&1 | Out-Null
        
        Remove-Item $tmpFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Integration response configured"
            $updated++
        }
        else {
            Write-Host "  ✗ Failed to configure integration response" -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host ""
Write-Host "Updated: $updated  |  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "Redeploying API stage..." -ForegroundColor Cyan
    
    $dep = aws apigateway create-deployment `
        --rest-api-id $api --stage-name prod `
        --description "Add CORS headers to method responses $(Get-Date -Format 'yyyy-MM-dd HH:mm')" `
        --profile $profile --region $region `
        --query 'id' --output text 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Deployment successful: $dep" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Deployment failed" -ForegroundColor Red
    }
}

Write-Host ""
