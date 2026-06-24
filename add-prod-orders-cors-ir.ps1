#!/usr/bin/env pwsh
# Sets CORS integration-response on all production orders OPTIONS routes
$api = "6extgb87v1"; $p = "megapros-prod"; $r = "us-east-1"
$rids = @("xlq6ay","7cat3y","d3t041","gg31t8","qas3e9","5ee076","u4wh4g","ni1e78","w99z1j","qmpieg")

# Write params to a temp file — avoids all shell quoting issues with nested quotes
$params = @{
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
}
$tmpFile = [System.IO.Path]::GetTempFileName() + ".json"
$params | ConvertTo-Json | Set-Content -Path $tmpFile -Encoding utf8

foreach ($rid in $rids) {
    aws apigateway put-integration-response `
        --rest-api-id $api --resource-id $rid --http-method OPTIONS --status-code 200 `
        --response-parameters "file://$tmpFile" `
        --profile $p --region $r | Out-Null
    Write-Host "$rid integration-response: $LASTEXITCODE"
}

Remove-Item $tmpFile -Force

$dep = aws apigateway create-deployment `
    --rest-api-id $api --stage-name prod `
    --profile $p --region $r --query id --output text
Write-Host "Deployed: $dep" -ForegroundColor Green
