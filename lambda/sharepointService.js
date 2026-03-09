const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

/**
 * SharePoint Integration Service
 *
 * Handles automated folder creation in SharePoint Online when projects are created.
 * Uses Microsoft Graph API with client credentials flow (app-only authentication).
 *
 * Configuration via environment variables:
 * - AZURE_TENANT_ID: Azure AD tenant ID
 * - AZURE_CLIENT_ID: Application client ID
 * - AZURE_CLIENT_SECRET: Application client secret
 * - SHAREPOINT_SITE_URL: Full SharePoint site URL
 * - SHAREPOINT_LIBRARY: Document library name (default: "Projects")
 * - SHAREPOINT_BASE_FOLDER: Base folder for project folders (default: "ProjectFolders")
 */

/**
 * Get OAuth access token using client credentials flow
 * @returns {Promise<string>} Access token for Microsoft Graph API
 */
async function getAuthToken() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "SharePoint configuration incomplete: Missing Azure AD credentials",
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get auth token: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Initialize Microsoft Graph client with authentication
 * @returns {Promise<Client>} Authenticated Graph client
 */
async function getGraphClient() {
  const accessToken = await getAuthToken();

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Extract SharePoint site ID from URL
 * @param {Client} client - Graph API client
 * @param {string} siteUrl - Full SharePoint site URL
 * @returns {Promise<string>} Site ID
 */
async function getSiteId(client, siteUrl) {
  // Parse site URL: https://tenant.sharepoint.com/sites/SiteName
  const urlParts = siteUrl.replace("https://", "").split("/");
  const hostname = urlParts[0];
  const sitePath = "/" + urlParts.slice(1).join("/");

  const site = await client.api(`/sites/${hostname}:${sitePath}`).get();

  return site.id;
}

/**
 * Get drive ID for specified document library
 * @param {Client} client - Graph API client
 * @param {string} siteId - SharePoint site ID
 * @param {string} libraryName - Document library name
 * @returns {Promise<string>} Drive ID
 */
async function getDriveId(client, siteId, libraryName) {
  const drives = await client.api(`/sites/${siteId}/drives`).get();

  const targetDrive = drives.value.find((d) => d.name === libraryName);

  if (!targetDrive) {
    throw new Error(
      `Document library '${libraryName}' not found in SharePoint site`,
    );
  }

  return targetDrive.id;
}

/**
 * Ensure base folder exists (create if needed)
 * @param {Client} client - Graph API client
 * @param {string} driveId - Drive ID
 * @param {string} baseFolderName - Base folder name
 * @returns {Promise<object>} Folder object
 */
async function ensureBaseFolderExists(client, driveId, baseFolderName) {
  try {
    // Try to get the folder
    const folder = await client
      .api(`/drives/${driveId}/root:/${baseFolderName}`)
      .get();
    return folder;
  } catch (error) {
    if (error.statusCode === 404) {
      // Folder doesn't exist, create it
      const newFolder = await client
        .api(`/drives/${driveId}/root/children`)
        .post({
          name: baseFolderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        });
      console.log(`Created base folder: ${baseFolderName}`);
      return newFolder;
    }
    throw error;
  }
}

/**
 * Sanitize folder name to be filesystem-friendly
 * Removes SharePoint-prohibited characters: < > : " / \ | ? * and control characters
 * @param {string} name - Original name
 * @returns {string} Sanitized name
 */
function sanitizeFolderName(name) {
  if (!name) return "";
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Remove invalid chars
    .replace(/\.+$/, "") // Remove trailing periods
    .trim();
}

/**
 * Generate folder name following convention: ProjectName-Type-Customer
 * @param {string} projectName - Project name
 * @param {string} projectType - Project type (bath, kitchen, etc.)
 * @param {string} customerName - Customer name
 * @param {string} projectId - Project ID (fallback for missing customer)
 * @returns {string} Generated folder name
 */
function generateFolderName(projectName, projectType, customerName, projectId) {
  const cleanProjectName = sanitizeFolderName(projectName);
  const cleanType = projectType || "other";

  // Use project ID if customer name is missing
  const cleanCustomerName = customerName
    ? sanitizeFolderName(customerName)
    : `Project-${projectId.substring(0, 8)}`;

  return `${cleanProjectName}-${cleanType}-${cleanCustomerName}`;
}

/**
 * Create project folder in SharePoint
 * Main entry point for creating SharePoint folders when projects are created
 *
 * @param {string} projectId - Project ID
 * @param {string} projectName - Project name
 * @param {string} projectType - Project type
 * @param {string} customerName - Customer name (optional)
 * @returns {Promise<object>} Folder info: { id, name, webUrl, driveId, siteId }
 * @throws {Error} If SharePoint configuration is missing or folder creation fails
 */
async function createProjectFolder(
  projectId,
  projectName,
  projectType,
  customerName,
) {
  const client = await getGraphClient();

  // Get SharePoint configuration from environment
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  const libraryName = process.env.SHAREPOINT_LIBRARY || "Projects";
  const baseFolderName = process.env.SHAREPOINT_BASE_FOLDER || "ProjectFolders";

  if (!siteUrl) {
    throw new Error(
      "SharePoint configuration incomplete: SHAREPOINT_SITE_URL not set",
    );
  }

  console.log(`SharePoint: Creating folder for project ${projectId}`);
  console.log(`  Site: ${siteUrl}`);
  console.log(`  Library: ${libraryName}`);
  console.log(`  Base folder: ${baseFolderName}`);

  // Get SharePoint site and drive
  const siteId = await getSiteId(client, siteUrl);
  const driveId = await getDriveId(client, siteId, libraryName);

  console.log(`  Site ID: ${siteId}`);
  console.log(`  Drive ID: ${driveId}`);

  // Ensure base folder exists
  await ensureBaseFolderExists(client, driveId, baseFolderName);

  // Generate folder name
  const folderName = generateFolderName(
    projectName,
    projectType,
    customerName,
    projectId,
  );
  console.log(`  Folder name: ${folderName}`);

  // Create project folder inside base folder
  const newFolder = await client
    .api(`/drives/${driveId}/root:/${baseFolderName}:/children`)
    .post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename", // Auto-rename if duplicate
    });

  console.log(`SharePoint: Folder created successfully - ${newFolder.webUrl}`);

  // Return folder info
  return {
    id: newFolder.id,
    name: newFolder.name,
    webUrl: newFolder.webUrl,
    driveId: driveId,
    siteId: siteId,
  };
}

/**
 * Get folder contents (for future file listing feature)
 * @param {string} driveId - Drive ID
 * @param {string} folderId - Folder ID
 * @returns {Promise<Array>} Array of file/folder objects
 */
async function getProjectFolderContents(driveId, folderId) {
  const client = await getGraphClient();

  const contents = await client
    .api(`/drives/${driveId}/items/${folderId}/children`)
    .get();

  return contents.value;
}

/**
 * Upload file to project folder (for future file upload feature)
 * @param {string} driveId - Drive ID
 * @param {string} folderId - Folder ID
 * @param {string} fileName - File name
 * @param {Buffer} fileContent - File content
 * @returns {Promise<object>} Uploaded file object
 */
async function uploadFileToProjectFolder(
  driveId,
  folderId,
  fileName,
  fileContent,
) {
  const client = await getGraphClient();

  const uploadedFile = await client
    .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
    .put(fileContent);

  return uploadedFile;
}

/**
 * Delete file from project folder
 * @param {string} driveId - Drive ID
 * @param {string} fileId - File ID to delete
 * @returns {Promise<void>}
 */
async function deleteFileFromProjectFolder(driveId, fileId) {
  const client = await getGraphClient();

  await client.api(`/drives/${driveId}/items/${fileId}`).delete();
}

/**
 * List all existing folders in the base SharePoint folder.
 * Called when the user wants to browse and link an existing folder.
 * @returns {Promise<{folders: Array<{id,name,webUrl,driveId,siteId}>, driveId, siteId}>}
 */
async function listFoldersInBaseDir() {
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  const libraryName = process.env.SHAREPOINT_LIBRARY || "Projects";
  const baseFolderName = process.env.SHAREPOINT_BASE_FOLDER || "ProjectFolders";

  if (!siteUrl) {
    throw new Error(
      "SharePoint configuration incomplete: SHAREPOINT_SITE_URL not set",
    );
  }

  const client = await getGraphClient();
  const siteId = await getSiteId(client, siteUrl);
  const driveId = await getDriveId(client, siteId, libraryName);

  // Creates the base folder if it doesn't exist yet
  await ensureBaseFolderExists(client, driveId, baseFolderName);

  const children = await client
    .api(`/drives/${driveId}/root:/${baseFolderName}:/children`)
    .get();

  const folders = (children.value || [])
    .filter((item) => item.folder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      driveId,
      siteId,
    }));

  return { folders, driveId, siteId };
}

/**
 * Create a folder using the exact name supplied by the user (instead of the
 * auto-generated ProjectName-Type-Customer convention).
 * @param {string} folderName - Desired folder name (will be sanitized)
 * @returns {Promise<{id,name,webUrl,driveId,siteId}>}
 */
async function createFolderWithName(folderName) {
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  const libraryName = process.env.SHAREPOINT_LIBRARY || "Projects";
  const baseFolderName = process.env.SHAREPOINT_BASE_FOLDER || "ProjectFolders";

  if (!siteUrl) {
    throw new Error(
      "SharePoint configuration incomplete: SHAREPOINT_SITE_URL not set",
    );
  }

  const sanitized = sanitizeFolderName(folderName);
  if (!sanitized) {
    throw new Error("Invalid folder name after sanitization");
  }

  const client = await getGraphClient();
  const siteId = await getSiteId(client, siteUrl);
  const driveId = await getDriveId(client, siteId, libraryName);

  await ensureBaseFolderExists(client, driveId, baseFolderName);

  const newFolder = await client
    .api(`/drives/${driveId}/root:/${baseFolderName}:/children`)
    .post({
      name: sanitized,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    });

  console.log(
    `SharePoint: Created folder '${newFolder.name}' - ${newFolder.webUrl}`,
  );

  return {
    id: newFolder.id,
    name: newFolder.name,
    webUrl: newFolder.webUrl,
    driveId,
    siteId,
  };
}

module.exports = {
  createProjectFolder,
  getProjectFolderContents,
  uploadFileToProjectFolder,
  deleteFileFromProjectFolder,
  listFoldersInBaseDir,
  createFolderWithName,
};
