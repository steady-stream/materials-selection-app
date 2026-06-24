#!/usr/bin/env pwsh
# Completes OPTIONS MOCK CORS setup for all production orders routes
# Adds the missing method-response and integration-response to each resource
$api = "6extgb87v1"; $p = "megapros-prod"; $r = "us-east-1"

$rids = @("xlq6ay","7cat3y","d3t041","gg31t8","qas3e9","5ee076","u4wh4g","ni1e78","w99z1j","qmpieg")
foreach ($rid in $rids) {
    # Method response - declares allowed response headers
    aws apigateway put-method-response `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
        --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" `
        --profile $p --region $r | Out-Null
    $rc1 = $LASTEXITCODE

    # Integration response - returns the actual header values
    aws apigateway put-integration-response `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
        --response-parameters "method.response.header.Access-Control-Allow-Headers='Content-Type,Authorization',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Origin='*'" `
        --profile $p --region $r | Out-Null
    $rc2 = $LASTEXITCODE

    Write-Host "$rid  method-response:$rc1  integration-response:$rc2"
}

$dep = aws apigateway create-deployment `
    --rest-api-id $api --stage-name prod `
    --profile $p --region $r --query id --output text
Write-Host "Deployed: $dep" -ForegroundColor Green
