# Azure AD Setup Guide for SharePoint Integration

## Quick Reference - Materials Selection App

This guide walks through setting up Azure AD authentication for automated SharePoint folder creation.

---

> ### ⏳ STATUS: WAITING FOR CLIENT CREDENTIALS — April 14, 2026
>
> Instructions have been sent to the client's Microsoft 365 admin.
> **Target SharePoint**: `https://netorgft2978387.sharepoint.com/sites/megapros`
> **Document Library**: `Shared Documents`
>
> When the admin sends back the three credential values, jump to
> **[When You Receive Credentials →](#when-you-receive-credentials-developer-checklist)**

---

## Prerequisites

✅ Microsoft 365 admin access on the **client's** tenant (`netorgft2978387`)  
✅ Access to Azure Portal  
✅ SharePoint site: `https://netorgft2978387.sharepoint.com/sites/megapros`  
✅ Document library: `Shared Documents`

---

## Step 1: Register Application in Azure AD

### 1.1 Navigate to Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your admin account
3. Click "Azure Active Directory" (or search for it)

### 1.2 Create App Registration

1. In left menu, click **"App registrations"**
2. Click **"+ New registration"**
3. Fill in the form:
   - **Name**: `MaterialsSelectionApp`
   - **Supported account types**: `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI**: Leave blank (we'll use client credentials flow)
4. Click **"Register"**

### 1.3 Note Application IDs

After registration, you'll see the Overview page. **Copy these values** (you'll need them later):

```
Application (client) ID: ___________________________________
Directory (tenant) ID:   ___________________________________
```

---

## Step 2: Create Client Secret

### 2.1 Generate Secret

1. In your app registration, click **"Certificates & secrets"** (left menu)
2. Click **"+ New client secret"**
3. Fill in:
   - **Description**: `Lambda SharePoint Access`
   - **Expires**: `24 months` (or as per your security policy)
4. Click **"Add"**

### 2.2 Copy Secret Value

⚠️ **IMPORTANT**: Copy the secret **VALUE** immediately! You won't see it again!

```
Client Secret Value: ___________________________________
```

**DO NOT** copy the "Secret ID" - you need the **VALUE** field.

---

## Step 3: Grant API Permissions

### 3.1 Add Permissions

1. In your app registration, click **"API permissions"** (left menu)
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Application permissions"** (NOT Delegated)
5. Search and select these permissions:
   - `Sites.ReadWrite.All` - Full control of all site collections
   - `Files.ReadWrite.All` - Read and write files in all site collections
6. Click **"Add permissions"**

### 3.2 Grant Admin Consent

⚠️ **Critical Step**: You must grant admin consent!

1. Click **"✓ Grant admin consent for [your organization]"**
2. Click **"Yes"** in the confirmation dialog
3. Verify that both permissions show "Granted for [your organization]" in green

Your permissions should look like this:

```
API / Permissions Name          Type        Status
─────────────────────────────────────────────────────────
Microsoft Graph
  Sites.ReadWrite.All           Application ✓ Granted
  Files.ReadWrite.All           Application ✓ Granted
```

---

## Step 4: Verify SharePoint Configuration

### 4.1 Confirm SharePoint Details

1. Navigate to: `https://apiaconsulting.sharepoint.com/sites/MegaPros360`
2. Verify the site exists and you have access
3. Click **"Documents"** or **"Projects"** library (whatever it's named)
4. Confirm the document library name

**Your SharePoint Configuration:**

```
Site URL:     https://netorgft2978387.sharepoint.com/sites/megapros
Library Name: Shared Documents
Base Folder:  Materials Selection (will be created automatically)
```

---

## Step 5: Configure Lambda Environment Variables

### 5.1 Prepare Environment Variables

Copy your values into this template:

```bash
AZURE_TENANT_ID=<directory-tenant-id-from-client-admin>
AZURE_CLIENT_ID=<application-client-id-from-client-admin>
AZURE_CLIENT_SECRET=<client-secret-value-from-client-admin>
SHAREPOINT_SITE_URL=https://netorgft2978387.sharepoint.com/sites/megapros
SHAREPOINT_LIBRARY=Shared Documents
SHAREPOINT_BASE_FOLDER=Materials Selection
```

### 5.2 Set in AWS Lambda

**Option A: AWS Console**

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Select function: `MaterialsSelectionAPI`
3. Go to "Configuration" tab → "Environment variables"
4. Click "Edit"
5. Add each variable above
6. Click "Save"

**Option B: AWS CLI** (after filling in values):

```bash
aws lambda update-function-configuration \
  --function-name MaterialsSelection-Projects-API \
  --environment Variables="{
    AZURE_TENANT_ID=<value-from-client>,
    AZURE_CLIENT_ID=<value-from-client>,
    AZURE_CLIENT_SECRET=<value-from-client>,
    SHAREPOINT_SITE_URL=https://netorgft2978387.sharepoint.com/sites/megapros,
    SHAREPOINT_LIBRARY=Shared Documents,
    SHAREPOINT_BASE_FOLDER=Materials Selection
  }" \
  --region us-east-1
```

---

## Step 6: Install Dependencies and Deploy

### 6.1 Install Dependencies

```bash
cd lambda
npm install
```

This will install:

- `@microsoft/microsoft-graph-client@^3.0.7`
- `isomorphic-fetch@^3.0.0`

### 6.2 Package Lambda

```bash
# Create deployment package
zip -r lambda-function.zip .
```

### 6.3 Deploy to AWS Lambda

```bash
aws lambda update-function-code \
  --function-name MaterialsSelectionAPI \
  --zip-file fileb://lambda-function.zip \
  --region us-east-1
```

### 6.4 Increase Lambda Timeout

SharePoint API calls may take a few seconds:

```bash
aws lambda update-function-configuration \
  --function-name MaterialsSelectionAPI \
  --timeout 30 \
  --region us-east-1
```

---

## Step 7: Test the Integration

### 7.1 Create Test Project

1. Open your app: `https://d3f4oecpygbpd.cloudfront.net`
2. Create a new project:
   - **Name**: "Test Bathroom Remodel"
   - **Type**: "bath"
   - **Customer Name**: "John Smith"
3. Click "Create Project"

### 7.2 Verify Folder Creation

**Expected Behavior:**

- Folder created in SharePoint: `https://apiaconsulting.sharepoint.com/sites/MegaPros360/Projects/ProjectFolders/Test Bathroom Remodel-bath-John Smith`
- Blue link appears in project header: "📁 Open Project Folder in SharePoint →"

**Check SharePoint:**

1. Navigate to: `https://apiaconsulting.sharepoint.com/sites/MegaPros360/Projects`
2. Open folder: `ProjectFolders`
3. Verify folder exists: `Test Bathroom Remodel-bath-John Smith`

**Check CloudWatch Logs:**

```bash
aws logs tail /aws/lambda/MaterialsSelectionAPI --follow
```

Look for:

```
SharePoint: Creating folder for project <project-id>
SharePoint folder created: https://apiaconsulting.sharepoint.com/...
```

---

## Troubleshooting

### Error: "Failed to get auth token: 401"

**Problem**: Invalid client ID, secret, or tenant ID

**Solution**:

1. Verify all three IDs are correct
2. Regenerate client secret if needed
3. Check for extra spaces or quotes in environment variables

---

### Error: "403 Forbidden"

**Problem**: Insufficient permissions or admin consent not granted

**Solution**:

1. Go to Azure AD → App registrations → API permissions
2. Verify both permissions are granted (green checkmark)
3. Click "Grant admin consent" again
4. Wait 5-10 minutes for permissions to propagate

---

### Error: "Document library 'Projects' not found"

**Problem**: Wrong library name

**Solution**:

1. Navigate to SharePoint site
2. Check actual library name (might be "Shared Documents" or "Documents")
3. Update `SHAREPOINT_LIBRARY` environment variable
4. Common names: `Documents`, `Shared Documents`, `Projects`

---

### Error: "Site not found" or "404"

**Problem**: Wrong SharePoint URL

**Solution**:

1. Verify site URL format: `https://tenant.sharepoint.com/sites/SiteName`
2. Remove any trailing `/Shared Documents` or `/Documents` from URL
3. Just the site URL, not the library path

---

### Folder Not Created, But No Error

**Problem**: SharePoint integration silently failing

**Check CloudWatch Logs**:

```bash
aws logs tail /aws/lambda/MaterialsSelectionAPI --since 5m
```

Look for error messages starting with "SharePoint"

**Verify Environment Variables**:

```bash
aws lambda get-function-configuration \
  --function-name MaterialsSelectionAPI \
  --query 'Environment.Variables' \
  --region us-east-1
```

---

### Project Created Without SharePoint Link

**This is expected behavior!**

If SharePoint folder creation fails, the project is still created successfully. The integration is designed to be non-blocking:

```javascript
try {
  // Create SharePoint folder
} catch (error) {
  console.error("SharePoint failed:", error);
  // Continue anyway - project creation succeeds
}
```

Check CloudWatch logs to see why SharePoint failed.

---

## Folder Naming Convention

Folders are named using this format:

```
{ProjectName}-{Type}-{CustomerName}
```

**Examples:**

- `Vance Bathroom Remodel-bath-John Vance`
- `Smith Kitchen Update-kitchen-Mary Smith`
- `Deck Addition-deck-Project-a1b2c3d4` (when customer name missing)

**Special Character Handling:**

- Invalid characters removed: `< > : " / \ | ? *`
- Trailing periods removed
- Leading/trailing spaces trimmed

**Duplicates:**
If a folder with the same name exists, SharePoint auto-renames:

- `Project Name-bath-Smith`
- `Project Name-bath-Smith 1`
- `Project Name-bath-Smith 2`

---

## Security Best Practices

### Rotate Client Secrets

Client secrets should be rotated every 12-24 months:

1. Azure AD → App registrations → Certificates & secrets
2. Create new secret
3. Update Lambda environment variable
4. Test that new secret works
5. Delete old secret

### Minimize Permissions

Currently using:

- `Sites.ReadWrite.All` - Required for folder creation
- `Files.ReadWrite.All` - Required for file operations

These are broad permissions. If possible, use SharePoint app-only permissions scoped to specific sites.

### Store Secrets Securely

For production, consider using AWS Secrets Manager instead of environment variables:

```javascript
const AWS = require("aws-sdk");
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  const data = await secretsManager
    .getSecretValue({ SecretId: secretName })
    .promise();
  return JSON.parse(data.SecretString);
}
```

---

---

## When You Receive Credentials — Developer Checklist

When the client's Microsoft 365 admin sends back the three credential values, follow these steps **in order**.

### Step A — Confirm you received all three values

```
☐  Directory (Tenant) ID
☐  Application (Client) ID
☐  Client Secret Value
☐  Admin confirmed: consent granted + PnP PowerShell step done
```

### Step B — Update `aws/secrets.ps1`

Open `aws/secrets.ps1` (not committed — see `.gitignore`) and fill in the three values:

```powershell
$AZURE_CLIENT_ID        = "<Application Client ID from admin>"
$AZURE_CLIENT_SECRET    = "<Client Secret Value from admin>"
$AZURE_TENANT_ID        = "<Directory Tenant ID from admin>"
$SHAREPOINT_SITE_URL    = "https://netorgft2978387.sharepoint.com/sites/megapros"
$SHAREPOINT_LIBRARY     = "Shared Documents"
$SHAREPOINT_BASE_FOLDER = "Materials Selection"
```

> `aws/secrets.ps1` is gitignored. Never commit real credentials.

### Step C — Deploy the updated env vars to `MaterialsSelection-Projects-API` (prod)

This updates **only** the Projects-API Lambda environment — no code change needed.

```powershell
# Load secrets file
. .\aws\secrets.ps1

# Push env vars to prod Projects lambda
aws lambda update-function-configuration `
  --function-name MaterialsSelection-Projects-API `
  --environment "Variables={AZURE_TENANT_ID=$AZURE_TENANT_ID,AZURE_CLIENT_ID=$AZURE_CLIENT_ID,AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET,SHAREPOINT_SITE_URL=$SHAREPOINT_SITE_URL,SHAREPOINT_LIBRARY=$SHAREPOINT_LIBRARY,SHAREPOINT_BASE_FOLDER=$SHAREPOINT_BASE_FOLDER}" `
  --profile megapros-prod `
  --region us-east-1
```

### Step D — Verify the env vars were saved

```powershell
aws lambda get-function-configuration `
  --function-name MaterialsSelection-Projects-API `
  --profile megapros-prod `
  --region us-east-1 `
  --query "Environment.Variables"
```

Expect all 6 keys to be present. Confirm `SHAREPOINT_SITE_URL` = `https://netorgft2978387.sharepoint.com/sites/megapros`.

### Step E — Smoke test

1. Open the prod app: `https://d377ynyh0ngsji.cloudfront.net`
2. Open any existing project's detail page.
3. Click **"Link to SharePoint"** (or create/navigate to the SharePoint folder button).
4. The app should either navigate to the folder in SharePoint or prompt to create one.
5. Check CloudWatch logs for the Projects lambda:

```powershell
aws logs tail /aws/lambda/MaterialsSelection-Projects-API `
  --follow `
  --profile megapros-prod `
  --region us-east-1
```

Look for: `SharePoint folder created` or `SharePoint auth token acquired`.

### Step F — If it fails

| Error                           | Likely cause                                       | Fix                                                                     |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `401 Unauthorized`              | Wrong tenant/client ID or secret                   | Re-check the three values in `secrets.ps1`                              |
| `403 Forbidden`                 | Admin consent not granted or PnP step not done     | Ask admin to re-run Step 4 and Step 5 of the setup guide                |
| `404 Site not found`            | Wrong `SHAREPOINT_SITE_URL`                        | Confirm URL with admin — just the site, no `/Shared Documents` suffix   |
| `403` after consent looks right | `Sites.Selected` scope — PnP grant may have failed | Ask admin to re-run the PnP `Grant-PnPAzureADAppSitePermission` command |

---

## Next Steps

Once SharePoint integration is working:

1. ✅ **Test edge cases**
   - Projects without customer name
   - Projects without type
   - Special characters in names
   - Very long project names

2. **Add file upload (future)**
   - Upload invoices, receipts, photos
   - Store file metadata in DynamoDB
   - Display file list in UI

3. **Add file listing (future)**
   - Show SharePoint files in project detail
   - Download/preview files
   - Delete files

4. **Create subfolders (future)**
   ```
   Project Folder/
     ├── Invoices/
     ├── Receipts/
     ├── Photos/
     └── Documents/
   ```

---

## Reference Links

- [Azure Portal](https://portal.azure.com/)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [SharePoint REST API](https://docs.microsoft.com/en-us/sharepoint/dev/sp-add-ins/get-to-know-the-sharepoint-rest-service)
- [Microsoft Graph Client Library](https://github.com/microsoftgraph/msgraph-sdk-javascript)

---

## Support

If you encounter issues:

1. Check CloudWatch Logs first
2. Review this troubleshooting guide
3. Verify Azure AD permissions
4. Test authentication manually using Graph Explorer

**Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer

---

**Last Updated**: Feb 5, 2025  
**Configuration**: apiaconsulting.sharepoint.com/sites/MegaPros360
