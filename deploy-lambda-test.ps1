#!/usr/bin/env pwsh
# One-shot Lambda deploy to test environment (account 634752426026)
$ErrorActionPreference = "Stop"
$PROFILE = "megapros-test"
$FUNCTION = "MaterialsSelection-API"
$REGION = "us-east-1"
$LAMBDA_DIR = "g:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\lambda"
$ZIP = "g:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\lambda-sp-changes.zip"
$LOG = "g:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\deploy-lambda-log.txt"

"[$(Get-Date -Format 'HH:mm:ss')] Starting Lambda deployment" | Tee-Object -FilePath $LOG

# Verify account
$account = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
"[$(Get-Date -Format 'HH:mm:ss')] AWS account: $account" | Tee-Object -FilePath $LOG -Append
if ($account -ne "634752426026") {
    "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Wrong account. Expected 634752426026." | Tee-Object -FilePath $LOG -Append
    exit 1
}

# Package
"[$(Get-Date -Format 'HH:mm:ss')] Packaging lambda..." | Tee-Object -FilePath $LOG -Append
Push-Location $LAMBDA_DIR
if (Test-Path $ZIP) { Remove-Item $ZIP -Force }
Compress-Archive -Path ".\*" -DestinationPath $ZIP -Force
Pop-Location
$sizeMB = [math]::Round(([IO.FileInfo]$ZIP).Length / 1MB, 2)
"[$(Get-Date -Format 'HH:mm:ss')] Zip created: $sizeMB MB" | Tee-Object -FilePath $LOG -Append

# Deploy Lambda
"[$(Get-Date -Format 'HH:mm:ss')] Uploading to Lambda..." | Tee-Object -FilePath $LOG -Append
$updateResult = aws lambda update-function-code `
    --function-name $FUNCTION `
    --zip-file "fileb://$ZIP" `
    --region $REGION `
    --profile $PROFILE `
    --query "[FunctionName,LastModified,CodeSize]" `
    --output json 2>&1
"[$(Get-Date -Format 'HH:mm:ss')] Lambda result: $updateResult" | Tee-Object -FilePath $LOG -Append

"[$(Get-Date -Format 'HH:mm:ss')] Lambda deployment DONE" | Tee-Object -FilePath $LOG -Append
