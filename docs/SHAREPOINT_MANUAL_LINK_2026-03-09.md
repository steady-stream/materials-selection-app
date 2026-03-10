# SharePoint Manual Folder Link — Session Notes (March 9, 2026)

## What Changed

Replaced automatic SharePoint folder creation (which ran on every project save) with
a manual "Link SharePoint" flow initiated by the user from the Project Detail page.

---

## Why

- Auto-creation was running silently on project creation and causing failures when
  SharePoint env vars were not configured or the Graph API was unreachable.
- Users wanted control over which SharePoint folder is associated with a project,
  including the ability to pick an existing folder or create a new one with a
  custom name.

---

## Files Changed

### `lambda/index.js`

- **Removed** the auto-create block inside `createProject()` that called
  `createProjectFolder()` whenever `project.name` and `SHAREPOINT_SITE_URL` were set.
- **Added** three new handler functions:
  - `getSharepointConfig()` — returns non-secret config (siteUrl, library, baseFolder)
    so the frontend can display which environment it is connecting to.
  - `listSharepointFolders(id)` — validates the project exists, then proxies
    `listFoldersInBaseDir()` from `sharepointService.js`.
  - `linkSharepointFolder(id, data)` — accepts either `{createNew, folderName}` or
    `{folderId, driveId, siteId, folderName, folderUrl}`, writes SharePoint fields back
    to the project record in DynamoDB via `PutCommand`.
- **Added** three new routes in the router:
  - `GET /sharepoint/config`
  - `GET /projects/:id/sharepoint/folders`
  - `POST /projects/:id/sharepoint/link`

### `lambda/sharepointService.js`

- **Added** `listFoldersInBaseDir()` — lists all child folders inside `SHAREPOINT_BASE_FOLDER`
  via the Microsoft Graph API. Returns `{ folders, driveId, siteId }`.
- **Added** `createFolderWithName(folderName)` — creates a new folder under
  `SHAREPOINT_BASE_FOLDER` with a sanitized user-supplied name.
- Updated `module.exports` to include both new functions.

### `src/services/projectService.ts`

- Added `SharepointFolder` interface `{ id, name, webUrl, driveId, siteId }`.
- Added `listSharepointFolders(id)` → `GET /projects/:id/sharepoint/folders`
- Added `linkSharepointFolder(id, data)` → `POST /projects/:id/sharepoint/link`
- Added `getSharepointConfig()` → `GET /sharepoint/config`

### `src/components/ProjectDetail.tsx`

- Added state: `showSpLinkModal`, `spFolders`, `spFoldersLoading`, `spFoldersError`,
  `spNewFolderName`, `spLinking`, `spConfig`.
- **Documents button logic changed:** When a project has no `sharepointFolderId`, shows
  a **🔗 Link SharePoint** button instead of the Documents button.
- **New modal** "Link SharePoint Folder":
  - Header shows `siteUrl / library / baseFolder` from `spConfig`.
  - "Create a new folder" input + **Create & Link** button.
  - Divider "or select an existing folder".
  - Scrollable list of existing folders in `SHAREPOINT_BASE_FOLDER`, each with a **Link** button.

---

## API Gateway Changes (test environment)

Three new resources were added to REST API `xrld1hq3e2`:

| Resource ID | Path                                       | Methods       |
| ----------- | ------------------------------------------ | ------------- |
| `oqym0n`    | `/sharepoint`                              | (parent only) |
| `2zxkl1`    | `/sharepoint/config`                       | GET, OPTIONS  |
| `n2t22w`    | `/projects/{projectId}/sharepoint`         | (parent only) |
| `nod7n9`    | `/projects/{projectId}/sharepoint/folders` | GET, OPTIONS  |
| `r2t74e`    | `/projects/{projectId}/sharepoint/link`    | POST, OPTIONS |

All GET/POST methods use `AWS_PROXY` integration → `MaterialsSelection-API`.
All OPTIONS methods use `MOCK` integration with standard CORS response headers.

Deployed to stage `prod` — deployment ID `62t8fo`.

> **PRODUCTION NOTE:** The same API Gateway resources must be added to `6extgb87v1`
> before deploying the Lambda and frontend changes to production.

---

## SharePoint Connectivity (test environment — verified March 9, 2026)

| Setting          | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| Tenant           | `apiaconsulting` (ID: `2ea2b9df-669a-48d1-b2c2-15411ba08071`) |
| App (Client ID)  | `24b3320a-35c0-4f2b-a6d2-99a146e62468`                        |
| Site             | `https://apiaconsulting.sharepoint.com/sites/MegaPros360`     |
| Document Library | `Projects`                                                    |
| Base Folder      | `ProjectFolders`                                              |

All credentials are stored as Lambda environment variables (`SHAREPOINT_*`).
Auth, site access, library, and base folder all confirmed working.
