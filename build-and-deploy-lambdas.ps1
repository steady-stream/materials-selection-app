#!/usr/bin/env pwsh
# Build and deploy all 5 domain Lambdas to TEST
# Run this from the project root: .\build-and-deploy-lambdas.ps1

$BASE    = "G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\lambda"
$OUTDIR  = "$BASE\deploy"
$PROFILE = "megapros-test"
$REGION  = "us-east-1"
$ACCOUNT = "634752426026"
$ROLE    = "arn:aws:iam::${ACCOUNT}:role/MaterialsSelection-Lambda-Role"
$LOG     = "G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\deploy-split-lambda.log"

$sp = @{
    SHAREPOINT_LIBRARY     = "Projects"
    SHAREPOINT_SITE_URL    = "https://apiaconsulting.sharepoint.com/sites/MegaPros360"
    SHAREPOINT_BASE_FOLDER = "ProjectFolders"
    AZURE_TENANT_ID        = "2ea2b9df-669a-48d1-b2c2-15411ba08071"
    AZURE_CLIENT_ID        = "24b3320a-35c0-4f2b-a6d2-99a146e62468"
    AZURE_CLIENT_SECRET    = "<REDACTED - see aws/secrets.ps1>"
}

$configs = @(
    @{ name="MaterialsSelection-Projects-API"; dir="projects"; env=$sp }
    @{ name="MaterialsSelection-Core-API";     dir="core";     env=@{} }
    @{ name="MaterialsSelection-Catalog-API";  dir="catalog";  env=@{} }
    @{ name="MaterialsSelection-Orders-API";   dir="orders";   env=@{} }
    @{ name="MaterialsSelection-AI-API";       dir="ai";       env=@{} }
)

function Write-Log($msg) { 
    $ts = Get-Date -Format "HH:mm:ss"
    "$ts $msg" | Tee-Object -FilePath $LOG -Append | Write-Host
}

"" | Out-File $LOG
Write-Log "=== Deploy Split Lambdas to TEST ==="

foreach ($cfg in $configs) {
    $dir  = "$BASE\$($cfg.dir)"
    $zip  = "$OUTDIR\$($cfg.dir).zip"
    $name = $cfg.name

    Write-Log ""
    Write-Log "--- $name ---"

    # Zip
    Write-Log "  Zipping $dir ..."
    Remove-Item $zip -EA 0
    Compress-Archive -Path "$dir\*" -DestinationPath $zip -Force
    $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
    Write-Log "  $zip ($mb MB)"

    # Check if function exists
    $exists = aws lambda get-function --function-name $name `
        --profile $PROFILE --region $REGION --output text 2>&1
    $fnExists = ($LASTEXITCODE -eq 0)

    if ($fnExists) {
        Write-Log "  Updating function code..."
        aws lambda update-function-code `
            --function-name $name `
            --zip-file "fileb://$zip" `
            --profile $PROFILE --region $REGION --output text 2>&1 | Out-File $LOG -Append
        if ($LASTEXITCODE -ne 0) { Write-Log "  ERROR: update-function-code failed"; continue }

        if ($cfg.env.Count -gt 0) {
            $vars = ($cfg.env.GetEnumerator() | ForEach-Object { "`"$($_.Key)`":`"$($_.Value)`"" }) -join ','
            $envJson = "{`"Variables`":{$vars}}"
            aws lambda update-function-configuration `
                --function-name $name --environment $envJson `
                --profile $PROFILE --region $REGION --output text 2>&1 | Out-File $LOG -Append
        }
        Write-Log "  Updated $name"
    } else {
        Write-Log "  Creating new function..."
        $args = @(
            "lambda", "create-function",
            "--function-name", $name,
            "--runtime", "nodejs22.x",
            "--handler", "index.handler",
            "--role", $ROLE,
            "--timeout", "30",
            "--memory-size", "256",
            "--zip-file", "fileb://$zip",
            "--profile", $PROFILE,
            "--region", $REGION,
            "--output", "json"
        )
        if ($cfg.env.Count -gt 0) {
            $vars = ($cfg.env.GetEnumerator() | ForEach-Object { "`"$($_.Key)`":`"$($_.Value)`"" }) -join ','
            $envJson = "{`"Variables`":{$vars}}"
            $args += "--environment"
            $args += $envJson
        }
        & aws @args 2>&1 | Out-File $LOG -Append
        if ($LASTEXITCODE -ne 0) { Write-Log "  ERROR: create-function failed"; continue }
        Write-Log "  Created $name"
    }
}

Write-Log ""
Write-Log "=== Done ==="
Write-Log "Check $LOG for details"
