#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Add the /review/{token} (public) and /projects/{id}/share (GET/POST/DELETE)
    routes to the TEST API Gateway.

.DESCRIPTION
    Kept separate so the share/review API Gateway changes can be run independently.
    Safe to re-run — create-resource failures (already exists) are ignored.

.NOTES
    REST API : xrld1hq3e2  (test)
    Stage    : prod
    Account  : 634752426026
    Profile  : megapros-test
#>

$ErrorActionPreference = "Stop"

$PROFILE  = "megapros-test"
$REGION   = "us-east-1"
$ACCOUNT  = "634752426026"
$API      = "xrld1hq3e2"
$STAGE    = "prod"
$ROOT_ID  = "bvnxzqxftg"  # resource id for "/"
$PROJ_PARAM_ID = "6yfsm9" # /projects/{projectId}
$FUNC_NAME = "MaterialsSelection-Projects-API"

$LAMBDA_URI = "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FUNC_NAME}/invocations"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Ensure-Method([string]$resourceId, [string]$method) {
    aws apigateway put-method `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --authorization-type NONE `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function Set-LambdaProxyIntegration([string]$resourceId, [string]$method) {
    aws apigateway put-integration `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --type AWS_PROXY `
        --integration-http-method POST `
        --uri $LAMBDA_URI `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "put-integration failed for $resourceId $method"
    }
}

function Ensure-MethodResponse([string]$resourceId, [string]$method) {
    aws apigateway put-method-response `
        --rest-api-id $API `
        --resource-id $resourceId `
        --http-method $method `
        --status-code 200 `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function Add-CorsOptions([string]$resourceId, [string]$allowedMethods) {
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

    aws apigateway put-integration-response `
        --rest-api-id $API --resource-id $resourceId `
        --http-method OPTIONS --status-code 200 `
        --response-parameters @{
            "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
            "method.response.header.Access-Control-Allow-Methods" = "'$allowedMethods'"
            "method.response.header.Access-Control-Allow-Origin"  = "'*'"
        } `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}

function New-ApiResource([string]$parentId, [string]$pathPart) {
    # Returns resource ID; exits on failure
    $result = aws apigateway create-resource `
        --rest-api-id $API `
        --parent-id $parentId `
        --path-part $pathPart `
        --output json `
        --profile $PROFILE --region $REGION 2>&1

    if ($LASTEXITCODE -ne 0) {
        # "already exists" is fine — fetch the existing ID
        Write-Host "    Resource '$pathPart' already exists, fetching..." -ForegroundColor Gray
        $existing = aws apigateway get-resources `
            --rest-api-id $API `
            --output json `
            --profile $PROFILE --region $REGION | ConvertFrom-Json
        $match = $existing.items | Where-Object { $_.parentId -eq $parentId -and $_.pathPart -eq $pathPart }
        return $match.id
    }
    return ($result | ConvertFrom-Json).id
}

function Add-LambdaPermission {
    $statementId = "apigw-review-$(Get-Date -Format 'yyyyMMddHHmmss')"
    aws lambda add-permission `
        --function-name $FUNC_NAME `
        --statement-id $statementId `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API}/*/*" `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
    # Exit code 1 = statement already exists — not a real error
}

# ==============================================================================
# Pre-flight
# ==============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup Review API Gateway Routes → TEST" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($account -ne $ACCOUNT) {
    Write-Error "Profile '$PROFILE' returned account '$account', expected $ACCOUNT"
    exit 1
}
Write-Host "Verified: account $account (test)" -ForegroundColor Green

# ==============================================================================
# 1. Add /projects/{projectId}/share  (POST = create, GET = status, DELETE = revoke)
# ==============================================================================
Write-Host "`n[1/3] Adding /projects/{projectId}/share resource..."

$shareId = New-ApiResource -parentId $PROJ_PARAM_ID -pathPart "share"
Write-Host "      Resource ID: $shareId"

foreach ($method in @("GET", "POST", "DELETE")) {
    Ensure-Method -resourceId $shareId -method $method
    Set-LambdaProxyIntegration -resourceId $shareId -method $method
    Ensure-MethodResponse -resourceId $shareId -method $method
    Write-Host "      $method method configured" -ForegroundColor Gray
}
Add-CorsOptions -resourceId $shareId -allowedMethods "GET,POST,DELETE,OPTIONS"
Write-Host "      CORS OPTIONS configured" -ForegroundColor Gray

# ==============================================================================
# 2. Add /review  and  /review/{token}  (public, NONE auth)
# ==============================================================================
Write-Host "`n[2/3] Adding /review/{token} resource..."

$reviewId = New-ApiResource -parentId $ROOT_ID -pathPart "review"
Write-Host "      /review resource ID: $reviewId"

$reviewTokenId = New-ApiResource -parentId $reviewId -pathPart "{token}"
Write-Host "      /review/{token} resource ID: $reviewTokenId"

Ensure-Method -resourceId $reviewTokenId -method "GET"
Set-LambdaProxyIntegration -resourceId $reviewTokenId -method "GET"
Ensure-MethodResponse -resourceId $reviewTokenId -method "GET"
Write-Host "      GET method configured" -ForegroundColor Gray

Add-CorsOptions -resourceId $reviewTokenId -allowedMethods "GET,OPTIONS"
Write-Host "      CORS OPTIONS configured" -ForegroundColor Gray

# ==============================================================================
# 3. Grant Lambda invoke permission and redeploy stage
# ==============================================================================
Write-Host "`n[3/3] Granting Lambda permission and redeploying $STAGE stage..."

Add-LambdaPermission
Write-Host "      Lambda invoke permission granted (or already exists)" -ForegroundColor Gray

aws apigateway create-deployment `
    --rest-api-id $API `
    --stage-name $STAGE `
    --description "Add review and share routes" `
    --profile $PROFILE --region $REGION | Out-Null

if ($LASTEXITCODE -ne 0) { Write-Error "create-deployment failed"; exit 1 }

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host ""
Write-Host "New endpoints:"
Write-Host "  GET  https://$API.execute-api.$REGION.amazonaws.com/$STAGE/review/{token}?pin=XXXX"
Write-Host "  POST https://$API.execute-api.$REGION.amazonaws.com/$STAGE/projects/{id}/share"
Write-Host "  GET  https://$API.execute-api.$REGION.amazonaws.com/$STAGE/projects/{id}/share"
Write-Host "  DELETE https://$API.execute-api.$REGION.amazonaws.com/$STAGE/projects/{id}/share"
Write-Host ""
Write-Host "Next: run .\deploy-test.ps1 to push the updated frontend."
