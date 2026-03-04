#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Provision all PRODUCTION infrastructure in a new AWS account.

.DESCRIPTION
    Creates the complete MegaPros Materials Selection App stack in the
    production AWS account. Run this once to set up prod from scratch.

    Prerequisites:
      1. Configure prod credentials first:
             aws configure --profile megapros-prod
         Enter the Access Key ID and Secret for the new account.

      2. Build Lambda zips from local source (if not already created):
             cd lambda; npm ci; Compress-Archive -Path * -Dest lambda.zip
             cd ..\lambda-salesforce; npm ci
             # deploy-test.ps1 or setup script will package them

      3. Update the Salesforce and Azure env var blocks below if prod
         uses different credentials/Salesforce orgs than test.

.OUTPUTS
    Prints all created resource IDs at the end. Copy them into:
      - deploy-prod.ps1   ($S3_BUCKET, $CF_DIST_ID)
      - .env.production   (VITE_API_BASE_URL, VITE_SF_API_URL,
                           VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID)

.NOTES
    This script is idempotent where possible — re-running it will skip
    resources that already exist.
#>

param(
    # Override bucket name if desired; default generates a unique name
    [string]$BucketName = "materials-selection-prod-$(Get-Random -Minimum 1000 -Maximum 9999)"
)

$ErrorActionPreference = "Stop"

# ===========================================================================
# CONFIGURATION
# ===========================================================================

$PROFILE = "megapros-prod"
$REGION = "us-east-1"
$APP = "MaterialsSelection"
$S3_BUCKET = $BucketName
$LAMBDA_ROLE = "$APP-Lambda-Role"
$MAIN_LAMBDA = "$APP-API"
$SF_LAMBDA = "$APP-Salesforce-API"
$TEST_ACCOUNT = "634752426026"   # test account — used to retrieve Python Lambda zips

# ---------------------------------------------------------------------------
# Salesforce credentials for Salesforce Lambda
# Load from aws/secrets.ps1 (NOT committed to git — see aws/secrets.ps1.example)
# ---------------------------------------------------------------------------
$secretsFile = "$PSScriptRoot\secrets.ps1"
if (Test-Path $secretsFile) {
    . $secretsFile
}
else {
    Write-Error "Secrets file not found: $secretsFile`nCopy aws/secrets.ps1.example to aws/secrets.ps1 and fill in the values."
    exit 1
}
# Expected variables from secrets.ps1:
#   $SF_CLIENT_ID, $SF_CLIENT_SECRET, $SF_USERNAME, $SF_PASSWORD
#   $SF_AUTH_URL, $SF_INSTANCE_URL
#   $AZURE_CLIENT_ID, $AZURE_CLIENT_SECRET, $AZURE_TENANT_ID
#   $SHAREPOINT_SITE_URL, $SHAREPOINT_LIBRARY, $SHAREPOINT_BASE_FOLDER

# Azure/SharePoint and Salesforce credentials are loaded from aws/secrets.ps1 above.

# ===========================================================================
# HELPERS
# ===========================================================================

function Write-Section([string]$title) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
}

function Write-Step([string]$msg) { Write-Host "  -> $msg" -ForegroundColor White }
function Write-Ok([string]$msg) { Write-Host "  OK: $msg" -ForegroundColor Green }
function Write-Skip([string]$msg) { Write-Host "  SKIP: $msg (already exists)" -ForegroundColor Yellow }

# ===========================================================================
# SECTION 0: Prerequisites
# ===========================================================================
Write-Section "Prerequisites"

# Verify prod profile has real credentials
$prodAccount = aws sts get-caller-identity --profile $PROFILE --query "Account" --output text 2>&1
if ($prodAccount -eq $TEST_ACCOUNT) {
    Write-Error "Profile '$PROFILE' is pointing at the TEST account. Update ~/.aws/credentials with prod keys."
    exit 1
}
if ($prodAccount -notmatch "^\d{12}$") {
    Write-Error "Could not authenticate: $prodAccount`nRun: aws configure --profile megapros-prod"
    exit 1
}
Write-Ok "Authenticated to prod account $prodAccount"
$PROD_ACCOUNT = $prodAccount

# ===========================================================================
# SECTION 1: DynamoDB Tables
# ===========================================================================
Write-Section "DynamoDB Tables"

function New-DDBTable {
    param(
        [string]$TableName,
        [hashtable[]]$AttributeDefinitions,  # @{Name=...; Type=...}
        [string]$HashKey,
        [hashtable[]]$GSIs = @()             # @{Name=...; HashKey=...}
    )

    # Check if exists
    $existing = aws dynamodb describe-table --table-name $TableName --profile $PROFILE --region $REGION 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Skip $TableName; return }

    $attrDefs = ($AttributeDefinitions | ForEach-Object { "AttributeName=$($_.Name),AttributeType=$($_.Type)" }) -join " "
    $keySchema = "AttributeName=$HashKey,KeyType=HASH"

    $cmd = "aws dynamodb create-table --table-name $TableName --attribute-definitions $attrDefs --key-schema $keySchema --billing-mode PAY_PER_REQUEST --profile $PROFILE --region $REGION"

    if ($GSIs.Count -gt 0) {
        $gsiDefs = ($GSIs | ForEach-Object {
                "IndexName=$($_.Name),KeySchema=[{AttributeName=$($_.HashKey),KeyType=HASH}],Projection={ProjectionType=ALL}"
            }) -join " "
        $cmd += " --global-secondary-indexes `"$gsiDefs`""
    }

    Invoke-Expression $cmd | Out-Null
    Write-Ok $TableName
}

# Tables with no GSIs
@("$APP-Projects", "$APP-Manufacturers", "$APP-Vendors") | ForEach-Object {
    $existing = aws dynamodb describe-table --table-name $_ --profile $PROFILE --region $REGION 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Skip $_; return }
    aws dynamodb create-table --table-name $_ `
        --attribute-definitions AttributeName=id, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $_
}

# Categories: GSI on projectId
$t = "$APP-Categories"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=projectId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=ProjectIdIndex,KeySchema=[{AttributeName=projectId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# LineItems: GSIs on projectId and categoryId
$t = "$APP-LineItems"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=projectId, AttributeType=S AttributeName=categoryId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=ProjectIdIndex,KeySchema=[{AttributeName=projectId,KeyType=HASH}],Projection={ProjectionType=ALL}" "IndexName=CategoryIdIndex,KeySchema=[{AttributeName=categoryId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# LineItemOptions: GSI on lineItemId
$t = "$APP-LineItemOptions"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=lineItemId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=lineItemId-index,KeySchema=[{AttributeName=lineItemId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# Products: GSI on manufacturerId
$t = "$APP-Products"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=manufacturerId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=ManufacturerIdIndex,KeySchema=[{AttributeName=manufacturerId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# ProductVendors: GSI on productId
$t = "$APP-ProductVendors"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=productId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=ProductIdIndex,KeySchema=[{AttributeName=productId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# Orders: GSIs on projectId and vendorId
$t = "$APP-Orders"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=projectId, AttributeType=S AttributeName=vendorId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=ProjectIndex,KeySchema=[{AttributeName=projectId,KeyType=HASH}],Projection={ProjectionType=ALL}" "IndexName=VendorIndex,KeySchema=[{AttributeName=vendorId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# OrderItems: GSIs on orderId and lineItemId
$t = "$APP-OrderItems"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=orderId, AttributeType=S AttributeName=lineItemId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=OrderIndex,KeySchema=[{AttributeName=orderId,KeyType=HASH}],Projection={ProjectionType=ALL}" "IndexName=LineItemIndex,KeySchema=[{AttributeName=lineItemId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# Receipts: GSIs on orderId and orderItemId
$t = "$APP-Receipts"
$existing = aws dynamodb describe-table --table-name $t --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name $t `
        --attribute-definitions AttributeName=id, AttributeType=S AttributeName=orderId, AttributeType=S AttributeName=orderItemId, AttributeType=S `
        --key-schema AttributeName=id, KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --global-secondary-indexes "IndexName=OrderIndex,KeySchema=[{AttributeName=orderId,KeyType=HASH}],Projection={ProjectionType=ALL}" "IndexName=OrderItemIndex,KeySchema=[{AttributeName=orderItemId,KeyType=HASH}],Projection={ProjectionType=ALL}" `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok $t
}
else { Write-Skip $t }

# ===========================================================================
# SECTION 2: S3 Bucket (static website hosting)
# ===========================================================================
Write-Section "S3 Bucket: $S3_BUCKET"

$existing = aws s3api head-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Step "Creating bucket..."
    aws s3api create-bucket --bucket $S3_BUCKET --region $REGION --profile $PROFILE | Out-Null

    Write-Step "Disabling Block Public Access..."
    aws s3api put-public-access-block --bucket $S3_BUCKET --profile $PROFILE `
        --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" | Out-Null

    Write-Step "Enabling static website hosting..."
    aws s3 website "s3://$S3_BUCKET" --index-document index.html --error-document index.html --profile $PROFILE | Out-Null

    Write-Step "Setting bucket policy (public read)..."
    $policy = @{ Version = "2012-10-17"; Statement = @(@{ Effect = "Allow"; Principal = "*"; Action = "s3:GetObject"; Resource = "arn:aws:s3:::$S3_BUCKET/*" }) } | ConvertTo-Json -Compress
    aws s3api put-bucket-policy --bucket $S3_BUCKET --policy $policy --profile $PROFILE | Out-Null

    Write-Ok "S3 bucket created"
}
else {
    Write-Skip "S3 bucket $S3_BUCKET"
}

$S3_WEBSITE_URL = "$S3_BUCKET.s3-website-$REGION.amazonaws.com"

# ===========================================================================
# SECTION 3: IAM Role for Lambda
# ===========================================================================
Write-Section "IAM Role: $LAMBDA_ROLE"

$existing = aws iam get-role --role-name $LAMBDA_ROLE --profile $PROFILE 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Step "Creating role..."
    $trustPolicy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    aws iam create-role --role-name $LAMBDA_ROLE --assume-role-policy-document $trustPolicy --profile $PROFILE | Out-Null

    Write-Step "Attaching managed policies..."
    aws iam attach-role-policy --role-name $LAMBDA_ROLE --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" --profile $PROFILE | Out-Null
    aws iam attach-role-policy --role-name $LAMBDA_ROLE --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" --profile $PROFILE | Out-Null

    Write-Step "Adding Bedrock inline policies..."
    $bedrockInvoke = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"bedrock:InvokeModel","Resource":["arn:aws:bedrock:*::foundation-model/*","arn:aws:bedrock:*:' + $PROD_ACCOUNT + ':inference-profile/*"]}]}'
    aws iam put-role-policy --role-name $LAMBDA_ROLE --policy-name BedrockInvokeModel --policy-document $bedrockInvoke --profile $PROFILE | Out-Null
    # Note: BedrockKnowledgeBaseAccess requires a Knowledge Base to be created first.
    # After creating a Bedrock Knowledge Base for prod, add:
    # aws iam put-role-policy --role-name $LAMBDA_ROLE --policy-name BedrockKnowledgeBaseAccess \
    #   --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["bedrock:Retrieve","bedrock:RetrieveAndGenerate"],"Resource":"arn:aws:bedrock:us-east-1:<PROD_ACCOUNT>:knowledge-base/<KB_ID>"}]}'

    Write-Ok "IAM Role created"
}
else {
    Write-Skip $LAMBDA_ROLE
}

$LAMBDA_ROLE_ARN = aws iam get-role --role-name $LAMBDA_ROLE --profile $PROFILE --query "Role.Arn" --output text
Write-Step "Role ARN: $LAMBDA_ROLE_ARN"

# Give IAM a moment to propagate before Lambda creation
Start-Sleep -Seconds 10

# ===========================================================================
# SECTION 4: Lambda Functions
# ===========================================================================
Write-Section "Lambda Functions"

# -- 4a: Main API Lambda (Node.js) --
Write-Step "Packaging $MAIN_LAMBDA from lambda/ ..."
$lambdaZip = "$PSScriptRoot\..\lambda\lambda-package.zip"
if (-not (Test-Path $lambdaZip)) {
    # Build the zip from the lambda directory
    $staging = "$env:TEMP\lambda-main-stage"
    Remove-Item $staging -Recurse -ErrorAction SilentlyContinue
    New-Item -ItemType Directory $staging | Out-Null
    Copy-Item "$PSScriptRoot\..\lambda\index.js" $staging
    Copy-Item "$PSScriptRoot\..\lambda\package.json" $staging
    Copy-Item "$PSScriptRoot\..\lambda\sharepointService.js" $staging
    if (Test-Path "$PSScriptRoot\..\lambda\node_modules") {
        Copy-Item "$PSScriptRoot\..\lambda\node_modules" $staging -Recurse
    }
    else {
        Push-Location $staging; npm ci --omit=dev; Pop-Location
    }
    Compress-Archive -Path "$staging\*" -DestinationPath $lambdaZip
    Write-Step "Built $lambdaZip ($([Math]::Round((Get-Item $lambdaZip).Length / 1KB))KB)"
}

$existing = aws lambda get-function --function-name $MAIN_LAMBDA --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Step "Creating Lambda $MAIN_LAMBDA ..."
    aws lambda create-function `
        --function-name $MAIN_LAMBDA `
        --runtime nodejs22.x `
        --handler index.handler `
        --role $LAMBDA_ROLE_ARN `
        --zip-file "fileb://$lambdaZip" `
        --timeout 30 `
        --memory-size 256 `
        --region $REGION `
        --profile $PROFILE | Out-Null
    aws lambda wait function-active --function-name $MAIN_LAMBDA --profile $PROFILE --region $REGION
}
else {
    Write-Step "Updating code for $MAIN_LAMBDA ..."
    aws lambda update-function-code --function-name $MAIN_LAMBDA --zip-file "fileb://$lambdaZip" --profile $PROFILE --region $REGION | Out-Null
    aws lambda wait function-updated --function-name $MAIN_LAMBDA --profile $PROFILE --region $REGION
}

Write-Step "Setting env vars for $MAIN_LAMBDA ..."
$envVars = "Variables={AZURE_CLIENT_ID=$AZURE_CLIENT_ID,AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET,AZURE_TENANT_ID=$AZURE_TENANT_ID,SHAREPOINT_SITE_URL=$SHAREPOINT_SITE_URL,SHAREPOINT_LIBRARY=$SHAREPOINT_LIBRARY,SHAREPOINT_BASE_FOLDER=$SHAREPOINT_BASE_FOLDER}"
aws lambda update-function-configuration --function-name $MAIN_LAMBDA --environment $envVars --profile $PROFILE --region $REGION | Out-Null
Write-Ok "$MAIN_LAMBDA"

# -- 4b: Salesforce Lambda (Node.js) --
Write-Step "Packaging $SF_LAMBDA from lambda-salesforce/ ..."
$sfZip = "$PSScriptRoot\..\lambda-salesforce\salesforce-lambda.zip"
if (-not (Test-Path $sfZip)) {
    $staging = "$env:TEMP\lambda-sf-stage"
    Remove-Item $staging -Recurse -ErrorAction SilentlyContinue
    New-Item -ItemType Directory $staging | Out-Null
    Copy-Item "$PSScriptRoot\..\lambda-salesforce\index.js" $staging
    Copy-Item "$PSScriptRoot\..\lambda-salesforce\package.json" $staging
    if (Test-Path "$PSScriptRoot\..\lambda-salesforce\node_modules") {
        Copy-Item "$PSScriptRoot\..\lambda-salesforce\node_modules" $staging -Recurse
    }
    else {
        Push-Location $staging; npm ci --omit=dev; Pop-Location
    }
    Compress-Archive -Path "$staging\*" -DestinationPath $sfZip
}

$existing = aws lambda get-function --function-name $SF_LAMBDA --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Step "Creating Lambda $SF_LAMBDA ..."
    aws lambda create-function `
        --function-name $SF_LAMBDA `
        --runtime nodejs22.x `
        --handler index.handler `
        --role $LAMBDA_ROLE_ARN `
        --zip-file "fileb://$sfZip" `
        --timeout 30 `
        --memory-size 256 `
        --region $REGION `
        --profile $PROFILE | Out-Null
    aws lambda wait function-active --function-name $SF_LAMBDA --profile $PROFILE --region $REGION
}
else {
    Write-Step "Updating code for $SF_LAMBDA ..."
    aws lambda update-function-code --function-name $SF_LAMBDA --zip-file "fileb://$sfZip" --profile $PROFILE --region $REGION | Out-Null
    aws lambda wait function-updated --function-name $SF_LAMBDA --profile $PROFILE --region $REGION
}

Write-Step "Setting env vars for $SF_LAMBDA ..."
$sfEnvVars = "Variables={SF_CLIENT_ID=$SF_CLIENT_ID,SF_CLIENT_SECRET=$SF_CLIENT_SECRET,SF_USERNAME=$SF_USERNAME,SF_PASSWORD=$SF_PASSWORD,SF_AUTH_URL=$SF_AUTH_URL,SF_INSTANCE_URL=$SF_INSTANCE_URL}"
aws lambda update-function-configuration --function-name $SF_LAMBDA --environment $sfEnvVars --profile $PROFILE --region $REGION | Out-Null
Write-Ok "$SF_LAMBDA"

# -- 4c: Python Lambdas (download zips from test account and redeploy) --
$pythonLambdas = @(
    @{ Name = "$APP-GetProjects"; Handler = "index.lambda_handler"; Runtime = "python3.11" },
    @{ Name = "$APP-GetCategories"; Handler = "lambda_temp.get_categories"; Runtime = "python3.11" },
    @{ Name = "$APP-GetLineItems"; Handler = "lambda_temp.get_lineitems"; Runtime = "python3.11" }
)

foreach ($fn in $pythonLambdas) {
    Write-Step "Deploying $($fn.Name) ..."
    $tmpZip = "$env:TEMP\$($fn.Name).zip"

    # Download zip from test account (profile default = megapros-test)
    $codeUrl = aws lambda get-function --function-name $fn.Name --profile megapros-test --region $REGION --query "Code.Location" --output text 2>&1
    if ($LASTEXITCODE -eq 0) {
        Invoke-WebRequest -Uri $codeUrl -OutFile $tmpZip -UseBasicParsing
    }
    else {
        Write-Host "  WARNING: Could not download $($fn.Name) from test account. Skipping." -ForegroundColor Yellow
        continue
    }

    $existing = aws lambda get-function --function-name $fn.Name --profile $PROFILE --region $REGION 2>&1
    if ($LASTEXITCODE -ne 0) {
        aws lambda create-function `
            --function-name $fn.Name `
            --runtime $fn.Runtime `
            --handler $fn.Handler `
            --role $LAMBDA_ROLE_ARN `
            --zip-file "fileb://$tmpZip" `
            --timeout 30 `
            --memory-size 256 `
            --region $REGION `
            --profile $PROFILE | Out-Null
        aws lambda wait function-active --function-name $fn.Name --profile $PROFILE --region $REGION
    }
    else {
        aws lambda update-function-code --function-name $fn.Name --zip-file "fileb://$tmpZip" --profile $PROFILE --region $REGION | Out-Null
        aws lambda wait function-updated --function-name $fn.Name --profile $PROFILE --region $REGION
    }
    Write-Ok $fn.Name
}

# ===========================================================================
# SECTION 5: Cognito User Pool
# ===========================================================================
Write-Section "Cognito User Pool"

# Check if a pool with this name already exists
$existingPool = aws cognito-idp list-user-pools --max-results 20 --profile $PROFILE --region $REGION `
    --query "UserPools[?Name=='MaterialsSelectionApp'].Id" --output text

if ($existingPool) {
    $COGNITO_POOL_ID = $existingPool
    Write-Skip "User Pool (ID: $COGNITO_POOL_ID)"
}
else {
    Write-Step "Creating User Pool..."
    $COGNITO_POOL_ID = aws cognito-idp create-user-pool `
        --pool-name "MaterialsSelectionApp" `
        --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" `
        --admin-create-user-config "AllowAdminCreateUserOnly=true" `
        --auto-verified-attributes email `
        --username-attributes email `
        --profile $PROFILE --region $REGION `
        --query "UserPool.Id" --output text
    Write-Ok "User Pool: $COGNITO_POOL_ID"
}

# App Client
$existingClient = aws cognito-idp list-user-pool-clients --user-pool-id $COGNITO_POOL_ID --profile $PROFILE --region $REGION `
    --query "UserPoolClients[?ClientName=='MaterialsSelectionWebApp'].ClientId" --output text

if ($existingClient) {
    $COGNITO_CLIENT_ID = $existingClient
    Write-Skip "App Client (ID: $COGNITO_CLIENT_ID)"
}
else {
    Write-Step "Creating App Client..."
    $COGNITO_CLIENT_ID = aws cognito-idp create-user-pool-client `
        --user-pool-id $COGNITO_POOL_ID `
        --client-name "MaterialsSelectionWebApp" `
        --no-generate-secret `
        --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH `
        --access-token-validity 8 `
        --refresh-token-validity 30 `
        --token-validity-units "AccessToken=hours,RefreshToken=days" `
        --profile $PROFILE --region $REGION `
        --query "UserPoolClient.ClientId" --output text
    Write-Ok "App Client: $COGNITO_CLIENT_ID"
}

# ===========================================================================
# SECTION 6: API Gateway
# ===========================================================================
Write-Section "API Gateway"

# Check if API already exists
$existingApi = aws apigateway get-rest-apis --profile $PROFILE --region $REGION `
    --query "items[?name=='MaterialsSelection-API'].id" --output text

if ($existingApi) {
    $API_ID = $existingApi
    Write-Skip "REST API (ID: $API_ID)"
}
else {
    Write-Step "Importing API from spec (aws/api-gateway-export-full.json)..."

    # Replace test account number with prod account number in integrations
    $specPath = "$PSScriptRoot\api-gateway-export-full.json"
    $specContent = Get-Content $specPath -Raw
    $prodSpec = $specContent -replace $TEST_ACCOUNT, $PROD_ACCOUNT

    $tmpSpec = "$env:TEMP\api-gateway-prod.json"
    $prodSpec | Set-Content $tmpSpec -Encoding UTF8

    $API_ID = aws apigateway import-rest-api `
        --fail-on-warnings `
        --body "fileb://$tmpSpec" `
        --profile $PROFILE --region $REGION `
        --query "id" --output text
    Write-Ok "API created: $API_ID"

    # Create deployment to /prod stage
    Write-Step "Deploying API to /prod stage..."
    aws apigateway create-deployment `
        --rest-api-id $API_ID `
        --stage-name prod `
        --profile $PROFILE --region $REGION | Out-Null
    Write-Ok "API deployed to /prod"
}

# Grant API Gateway permission to invoke all Lambda functions
Write-Step "Adding Lambda invoke permissions for API Gateway..."
$lambdaNames = @($MAIN_LAMBDA, $SF_LAMBDA, "$APP-GetProjects", "$APP-GetCategories", "$APP-GetLineItems")
foreach ($fn in $lambdaNames) {
    $existing = aws lambda get-policy --function-name $fn --profile $PROFILE --region $REGION 2>&1
    if ($existing -match "APIGatewayInvoke") { continue }
    aws lambda add-permission `
        --function-name $fn `
        --statement-id APIGatewayInvoke `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${REGION}:${PROD_ACCOUNT}:${API_ID}/*/*/*" `
        --profile $PROFILE --region $REGION 2>&1 | Out-Null
}
Write-Ok "Invoke permissions set"

$API_BASE_URL = "https://$API_ID.execute-api.$REGION.amazonaws.com/prod"

# ===========================================================================
# SECTION 7: CloudFront Distribution
# ===========================================================================
Write-Section "CloudFront Distribution"

# Check if distribution for this origin already exists
$existingDist = aws cloudfront list-distributions --profile $PROFILE `
    --query "DistributionList.Items[?Origins.Items[0].DomainName=='$S3_WEBSITE_URL'].Id" --output text

if ($existingDist) {
    $CF_DIST_ID = $existingDist
    Write-Skip "CloudFront distribution (ID: $CF_DIST_ID)"
}
else {
    Write-Step "Creating CloudFront distribution..."

    $cfConfig = @{
        CallerReference      = "materials-selection-prod-$(Get-Date -Format 'yyyyMMddHHmmss')"
        Origins              = @{
            Quantity = 1
            Items    = @(@{
                    Id                 = "S3-$S3_BUCKET"
                    DomainName         = $S3_WEBSITE_URL
                    CustomOriginConfig = @{
                        HTTPPort             = 80
                        HTTPSPort            = 443
                        OriginProtocolPolicy = "http-only"
                    }
                })
        }
        DefaultCacheBehavior = @{
            TargetOriginId       = "S3-$S3_BUCKET"
            ViewerProtocolPolicy = "redirect-to-https"
            CachePolicyId        = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # AWS Managed CachingOptimized
            Compress             = $true
            AllowedMethods       = @{ Quantity = 2; Items = @("GET", "HEAD") }
        }
        CustomErrorResponses = @{
            Quantity = 2
            Items    = @(
                @{ ErrorCode = 403; ResponseCode = 200; ResponsePagePath = "/index.html"; ErrorCachingMinTTL = 10 },
                @{ ErrorCode = 404; ResponseCode = 200; ResponsePagePath = "/index.html"; ErrorCachingMinTTL = 10 }
            )
        }
        Comment              = "materials-selection-prod"
        Enabled              = $true
        PriceClass           = "PriceClass_100"
    } | ConvertTo-Json -Depth 10 -Compress

    $tmpCf = "$env:TEMP\cf-distrib-config.json"
    $cfConfig | Set-Content $tmpCf -Encoding UTF8

    $cfResult = aws cloudfront create-distribution --distribution-config "file://$tmpCf" --profile $PROFILE | ConvertFrom-Json
    $CF_DIST_ID = $cfResult.Distribution.Id
    $CF_DOMAIN = $cfResult.Distribution.DomainName
    Write-Ok "CloudFront Distribution: $CF_DIST_ID ($CF_DOMAIN)"
    Write-Host "  NOTE: Distribution is deploying — takes 5-10 minutes to become fully active." -ForegroundColor Yellow
}

$CF_DOMAIN = aws cloudfront get-distribution --id $CF_DIST_ID --profile $PROFILE `
    --query "Distribution.DomainName" --output text

# ===========================================================================
# SECTION 8: Summary
# ===========================================================================
Write-Section "SETUP COMPLETE — Next Steps"

Write-Host ""
Write-Host "PRODUCTION RESOURCES CREATED" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host "AWS Account    : $PROD_ACCOUNT"
Write-Host "S3 Bucket      : $S3_BUCKET"
Write-Host "CloudFront ID  : $CF_DIST_ID"
Write-Host "CloudFront URL : https://$CF_DOMAIN"
Write-Host "API Gateway ID : $API_ID"
Write-Host "API Base URL   : $API_BASE_URL"
Write-Host "Cognito Pool   : $COGNITO_POOL_ID"
Write-Host "Cognito Client : $COGNITO_CLIENT_ID"
Write-Host ""
Write-Host "ACTION REQUIRED — Copy these values into the following files:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. deploy-prod.ps1:" -ForegroundColor Cyan
Write-Host "     `$S3_BUCKET  = '$S3_BUCKET'"
Write-Host "     `$CF_DIST_ID = '$CF_DIST_ID'"
Write-Host ""
Write-Host "2. .env.production:" -ForegroundColor Cyan
Write-Host "     VITE_API_BASE_URL=$API_BASE_URL"
Write-Host "     VITE_SF_API_URL=$API_BASE_URL"
Write-Host "     VITE_COGNITO_USER_POOL_ID=$COGNITO_POOL_ID"
Write-Host "     VITE_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID"
Write-Host ""
Write-Host "3. Create initial Cognito users:" -ForegroundColor Cyan
Write-Host "     aws cognito-idp admin-create-user --user-pool-id $COGNITO_POOL_ID --username <email> --user-attributes Name=email,Value=<email> Name=email_verified,Value=true --temporary-password 'Welcome1!' --message-action SUPPRESS --profile $PROFILE --region $REGION"
Write-Host ""
Write-Host "4. If Azure/SharePoint vars were left as REPLACE_WITH_PROD_..., update them:" -ForegroundColor Cyan
Write-Host "     See lambda/ directory for env var names, then run:"
Write-Host "     aws lambda update-function-configuration --function-name $MAIN_LAMBDA --environment Variables={...} --profile $PROFILE --region $REGION"
Write-Host ""
Write-Host "5. After updating .env.production and deploy-prod.ps1, deploy the frontend:" -ForegroundColor Cyan
Write-Host "     .\deploy-prod.ps1"
Write-Host ""
