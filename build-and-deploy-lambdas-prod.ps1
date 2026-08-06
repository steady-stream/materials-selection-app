#!/usr/bin/env pwsh
# Build and deploy all 5 domain Lambdas to PRODUCTION

$BASE = "G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\lambda"
$OUTDIR = "$BASE\deploy"
$PROFILE = "megapros-prod"
$REGION = "us-east-1"
$ACCOUNT = "860601623272"
$ROLE = "arn:aws:iam::${ACCOUNT}:role/MaterialsSelection-Lambda-Role"
$LOG = "G:\Projects\MegaPros\MaterialsSelectionApp\WebPrototype\deploy-split-lambda-prod.log"

$sp = @{
    SHAREPOINT_LIBRARY     = "Projects"
    SHAREPOINT_SITE_URL    = "https://apiaconsulting.sharepoint.com/sites/MegaPros360"
    SHAREPOINT_BASE_FOLDER = "ProjectFolders"
    AZURE_TENANT_ID        = "2ea2b9df-669a-48d1-b2c2-15411ba08071"
    AZURE_CLIENT_ID        = "24b3320a-35c0-4f2b-a6d2-99a146e62468"
    AZURE_CLIENT_SECRET    = "<REDACTED - see aws/secrets.ps1>"
    SHARES_TABLE_NAME      = "ProjectShares-prod"
    REVIEW_BASE_URL        = "https://d377ynyh0ngsji.cloudfront.net"
}

$configs = @(
    @{ name = "MaterialsSelection-Projects-API"; dir = "projects"; env = $sp }
    @{ name = "MaterialsSelection-Core-API"; dir = "core"; env = @{} }
    @{ name = "MaterialsSelection-Catalog-API"; dir = "catalog"; env = @{} }
    @{ name = "MaterialsSelection-Orders-API"; dir = "orders"; env = @{} }
    @{ name = "MaterialsSelection-AI-API"; dir = "ai"; env = @{} }
)

function Write-Log($msg) { 
    Write-Host $msg
    Add-Content $LOG "`n$msg"
}

"" | Set-Content $LOG

Write-Log "========================================" 
Write-Log "  Deploy Split Lambdas to PRODUCTION"
Write-Log "========================================"
Write-Log ""

foreach ($cfg in $configs) {
    $name = $cfg.name
    $dir = $cfg.dir
    $env = $cfg.env
    
    Write-Log ""
    Write-Log "--- $name ---"
    
    # Build
    $zipPath = "$OUTDIR\$dir.zip"
    Write-Log "  Zipping $BASE\$dir ..."
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    
    $excludeList = @(".git", ".gitignore", ".env*", "*.log", "node_modules", ".esbuild-*")
    & cmd /c "cd $BASE\$dir && 7z a -r -xr!.git -xr!node_modules -xr!.esbuild-* -xr!.env* -xr!*.log `"$zipPath`"" 2>&1 | Out-Null
    
    $size = (Get-Item $zipPath).Length / 1MB
    Write-Log "  $zipPath ($([math]::Round($size, 1)) MB)"
    
    # Deploy
    Write-Log "  Updating function code..."
    $exists = aws lambda get-function --function-name $name `
        --profile $PROFILE --region $REGION 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # Update existing
        aws lambda update-function-code --function-name $name `
            --zip-file fileb://$zipPath --profile $PROFILE --region $REGION `
            --query 'LastModified' --output text | ForEach-Object { Write-Log "  Updated $name" }
    }
    else {
        # Create new
        Write-Log "  Creating function..."
        
        & aws lambda create-function `
            "--function-name", $name,
        "--runtime", "nodejs22.x",
        "--role", $ROLE,
        "--handler", "index.handler",
        "--zip-file", "fileb://$zipPath",
        "--timeout", "30",
        "--memory-size", "512",
        "--profile", $PROFILE,
        "--region", $REGION | Out-Null
        
        Write-Log "  Created $name"
    }
}

Write-Log ""
Write-Log "=== Done ==="
Write-Log "Check $LOG for details"
Write-Host "[DONE] Production deployment complete!" -ForegroundColor Green
