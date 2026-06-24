#!/usr/bin/env pwsh
# Wires OPTIONS MOCK integrations to all production orders routes
# Run: .\add-prod-orders-options.ps1
$api = "6extgb87v1"; $p = "megapros-prod"; $r = "us-east-1"
$tmpl = '{"application/json":"{\"statusCode\":200}"}'

$rids = @("xlq6ay","7cat3y","d3t041","gg31t8","qas3e9","5ee076","u4wh4g","ni1e78","w99z1j","qmpieg")
foreach ($rid in $rids) {
    aws apigateway put-integration `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS `
        --type MOCK `
        --request-templates $tmpl `
        --profile $p --region $r | Out-Null
    Write-Host "$rid OPTIONS integration: $LASTEXITCODE"
}

$dep = aws apigateway create-deployment `
    --rest-api-id $api --stage-name prod `
    --profile $p --region $r --query id --output text
Write-Host "Deployed: $dep" -ForegroundColor Green
