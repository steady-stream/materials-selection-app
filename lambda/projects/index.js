const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  BatchGetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");
const {
  createProjectFolder,
  getProjectFolderContents,
  uploadFileToProjectFolder,
  deleteFileFromProjectFolder,
  listFoldersInBaseDir,
  createFolderWithName,
  listFolderById,
  createFolderInParent,
} = require("./sharepointService");

const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const PROJECTS_TABLE = "MaterialsSelection-Projects";

// Tables used for the review data aggregation (read-only cross-domain queries)
const CATEGORIES_TABLE = "MaterialsSelection-Categories";
const LINEITEMS_TABLE = "MaterialsSelection-LineItems";
const LINEITEMOPTIONS_TABLE = "MaterialsSelection-LineItemOptions";
const PRODUCTS_TABLE = "MaterialsSelection-Products";
const MANUFACTURERS_TABLE = "MaterialsSelection-Manufacturers";
const VENDORS_TABLE = "MaterialsSelection-Vendors";

// Table name driven by env var so same code works in test and prod
// Set SHARES_TABLE_NAME = "ProjectShares-prod" on the prod lambda
const SHARES_TABLE = process.env.SHARES_TABLE_NAME || "ProjectShares-test";

// Base URL used when constructing the share link shown to the MegaPros user
// Set REVIEW_BASE_URL on each lambda: test = https://mpmaterials.apiaconsulting.com
//                                     prod = https://d377ynyh0ngsji.cloudfront.net (until custom domain is live)
const REVIEW_BASE_URL =
  process.env.REVIEW_BASE_URL || "https://mpmaterials.apiaconsulting.com";

const SHARE_TTL_DAYS = 30;
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 60;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;

  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Projects routes
    if (path === "/projects" && method === "GET") {
      return await getAllProjects();
    }
    if (path.match(/^\/projects\/[^/]+$/) && method === "GET") {
      return await getProject(path.split("/")[2]);
    }
    if (path === "/projects" && method === "POST") {
      return await createProject(JSON.parse(event.body));
    }
    if (path.match(/^\/projects\/[^/]+$/) && method === "PUT") {
      return await updateProject(path.split("/")[2], JSON.parse(event.body));
    }
    if (path.match(/^\/projects\/[^/]+$/) && method === "DELETE") {
      return await deleteProject(path.split("/")[2]);
    }

    // Project files routes
    if (path.match(/^\/projects\/[^/]+\/files$/) && method === "GET") {
      return await getProjectFiles(path.split("/")[2]);
    }
    if (path.match(/^\/projects\/[^/]+\/files\/upload$/) && method === "POST") {
      return await uploadProjectFile(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (
      path.match(/^\/projects\/[^/]+\/files\/[^/]+$/) &&
      method === "DELETE"
    ) {
      const parts = path.split("/");
      return await deleteProjectFile(parts[2], parts[4]);
    }

    // SharePoint folder-browser and link routes
    if (
      path.match(/^\/projects\/[^/]+\/sharepoint\/folders$/) &&
      method === "GET"
    ) {
      return await listSharepointFolders(
        path.split("/")[2],
        event.queryStringParameters || {},
      );
    }
    if (
      path.match(/^\/projects\/[^/]+\/sharepoint\/folders$/) &&
      method === "POST"
    ) {
      return await createProjectSubfolder(
        path.split("/")[2],
        JSON.parse(event.body || "{}"),
      );
    }
    if (
      path.match(/^\/projects\/[^/]+\/sharepoint\/link$/) &&
      method === "POST"
    ) {
      return await linkSharepointFolder(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path === "/sharepoint/config" && method === "GET") {
      return await getSharepointConfig();
    }

    // -------------------------------------------------------------
    // Project share routes (create / get status / revoke)
    // -------------------------------------------------------------
    if (path.match(/^\/projects\/[^/]+\/share$/) && method === "POST") {
      return await createProjectShare(path.split("/")[2]);
    }
    if (path.match(/^\/projects\/[^/]+\/share$/) && method === "GET") {
      return await getProjectShareStatus(path.split("/")[2]);
    }
    if (path.match(/^\/projects\/[^/]+\/share$/) && method === "DELETE") {
      return await revokeProjectShare(path.split("/")[2]);
    }

    // -------------------------------------------------------------
    // Public review endpoint — validate PIN, return project data
    // Must be BEFORE any catch-all 404
    // -------------------------------------------------------------
    if (path.match(/^\/review\/[^/]+$/) && method === "GET") {
      return await getReviewData(
        path.split("/")[2],
        event.queryStringParameters?.pin,
      );
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Not found" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

async function getAllProjects() {
  const result = await ddb.send(new ScanCommand({ TableName: PROJECTS_TABLE }));
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ projects: result.Items || [] }),
  };
}

async function getProject(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createProject(data) {
  const project = {
    id: randomUUID(),
    name: data.name,
    description: data.description,
    projectNumber: data.projectNumber || "",
    customerName: data.customerName || "",
    address: data.address || "",
    email: data.email || "",
    phone: data.phone || "",
    mobilePhone: data.mobilePhone || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedStartDate: data.estimatedStartDate || "",
    type: data.type || "",
    status: data.status || "planning",
    opportunityId: data.opportunityId || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // SharePoint folder is NOT created automatically — user links from Project Detail
  await ddb.send(new PutCommand({ TableName: PROJECTS_TABLE, Item: project }));
  return { statusCode: 201, headers, body: JSON.stringify(project) };
}

async function updateProject(id, data) {
  const existingResult = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!existingResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Project not found" }),
    };
  }
  const project = {
    ...existingResult.Item,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: PROJECTS_TABLE, Item: project }));
  return { statusCode: 200, headers, body: JSON.stringify(project) };
}

async function deleteProject(id) {
  await ddb.send(new DeleteCommand({ TableName: PROJECTS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

async function getProjectFiles(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  const project = result.Item;
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ files: [], message: "No SharePoint folder" }),
    };
  }
  try {
    const files = await getProjectFolderContents(
      project.sharepointDriveId,
      project.sharepointFolderId,
    );
    return { statusCode: 200, headers, body: JSON.stringify({ files }) };
  } catch (error) {
    console.error("Error fetching SharePoint files:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to fetch files from SharePoint",
        error: error.message,
      }),
    };
  }
}

async function uploadProjectFile(id, data) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  const project = result.Item;
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Project has no SharePoint folder" }),
    };
  }
  if (!data.fileName || !data.fileContent) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "fileName and fileContent are required",
      }),
    };
  }
  try {
    const fileBuffer = Buffer.from(data.fileContent, "base64");
    const uploadedFile = await uploadFileToProjectFolder(
      project.sharepointDriveId,
      project.sharepointFolderId,
      data.fileName,
      fileBuffer,
    );
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: "File uploaded successfully",
        file: uploadedFile,
      }),
    };
  } catch (error) {
    console.error("Error uploading file to SharePoint:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to upload file to SharePoint",
        error: error.message,
      }),
    };
  }
}

async function deleteProjectFile(id, fileId) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  const project = result.Item;
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Project has no SharePoint folder" }),
    };
  }
  try {
    await deleteFileFromProjectFolder(project.sharepointDriveId, fileId);
    return { statusCode: 204, headers, body: "" };
  } catch (error) {
    console.error("Error deleting file from SharePoint:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to delete file from SharePoint",
        error: error.message,
      }),
    };
  }
}

async function getSharepointConfig() {
  const configured =
    !!process.env.SHAREPOINT_SITE_URL && !!process.env.AZURE_TENANT_ID;
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      configured,
      siteUrl: process.env.SHAREPOINT_SITE_URL || null,
      library: process.env.SHAREPOINT_LIBRARY || "Projects",
      baseFolder: process.env.SHAREPOINT_BASE_FOLDER || "ProjectFolders",
    }),
  };
}

async function listSharepointFolders(id, queryParams) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  if (!process.env.SHAREPOINT_SITE_URL) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "SharePoint is not configured for this environment",
      }),
    };
  }
  try {
    const { folderId, driveId, siteId } = queryParams || {};
    const data =
      folderId && driveId
        ? await listFolderById(driveId, folderId, siteId || "")
        : await listFoldersInBaseDir();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Error listing SharePoint folders:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to list SharePoint folders",
        error: error.message,
      }),
    };
  }
}

async function createProjectSubfolder(id, data) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  if (!process.env.SHAREPOINT_SITE_URL) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "SharePoint is not configured for this environment",
      }),
    };
  }
  const { parentFolderId, driveId, siteId, folderName } = data;
  if (!parentFolderId || !driveId || !folderName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "parentFolderId, driveId, and folderName are required",
      }),
    };
  }
  try {
    const folder = await createFolderInParent(
      driveId,
      parentFolderId,
      siteId || "",
      folderName,
    );
    return { statusCode: 201, headers, body: JSON.stringify({ folder }) };
  } catch (error) {
    console.error("Error creating SharePoint subfolder:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to create folder",
        error: error.message,
      }),
    };
  }
}

async function linkSharepointFolder(id, data) {
  const result = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }
  if (!process.env.SHAREPOINT_SITE_URL) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "SharePoint is not configured for this environment",
      }),
    };
  }
  const project = result.Item;
  try {
    let folderInfo;
    if (data.createNew && data.folderName) {
      folderInfo = await createFolderWithName(data.folderName);
    } else if (data.folderId && data.driveId && data.siteId) {
      folderInfo = {
        id: data.folderId,
        name: data.folderName || "",
        webUrl: data.folderUrl || "",
        driveId: data.driveId,
        siteId: data.siteId,
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message:
            "Provide either createNew+folderName, or folderId+driveId+siteId",
        }),
      };
    }
    const updatedProject = {
      ...project,
      sharepointFolderId: folderInfo.id,
      sharepointFolderName: folderInfo.name,
      sharepointFolderUrl: folderInfo.webUrl,
      sharepointDriveId: folderInfo.driveId,
      sharepointSiteId: folderInfo.siteId,
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({ TableName: PROJECTS_TABLE, Item: updatedProject }),
    );
    return { statusCode: 200, headers, body: JSON.stringify(updatedProject) };
  } catch (error) {
    console.error("Error linking SharePoint folder:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to link SharePoint folder",
        error: error.message,
      }),
    };
  }
}

// =============================================================================
// Project Share handlers
// =============================================================================

async function createProjectShare(projectId) {
  // Verify project exists first
  const projectResult = await ddb.send(
    new GetCommand({ TableName: PROJECTS_TABLE, Key: { id: projectId } }),
  );
  if (!projectResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }

  // Check for an existing active share — idempotent, return it unchanged so the PIN isn't regenerated
  const existing = await ddb.send(
    new QueryCommand({
      TableName: SHARES_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :pid",
      ExpressionAttributeValues: { ":pid": projectId },
      Limit: 1,
    }),
  );

  if (existing.Items?.length > 0) {
    const share = existing.Items[0];
    const now = new Date();
    if (share.expiresAt && new Date(share.expiresAt) > now) {
      // Active share already exists — return the URL but not the PIN (already shown once)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          shareUrl: `${REVIEW_BASE_URL}/review/${share.shareToken}`,
          expiresAt: share.expiresAt,
          alreadyActive: true,
        }),
      };
    }
    // Expired share — delete it and fall through to create a new one
    await ddb.send(
      new DeleteCommand({
        TableName: SHARES_TABLE,
        Key: { shareToken: share.shareToken },
      }),
    );
  }

  // Generate new share
  const shareToken = randomUUID();
  const pin = String(
    Math.floor(1000 + Math.random() * 9000), // 1000-9999 guaranteed 4 digits
  );
  const pinHash = await bcrypt.hash(pin, 8); // cost 8 — fast enough for Lambda cold start
  const expiresAt = new Date(
    Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await ddb.send(
    new PutCommand({
      TableName: SHARES_TABLE,
      Item: {
        shareToken,
        projectId,
        pinHash,
        expiresAt,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
      },
    }),
  );

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      shareUrl: `${REVIEW_BASE_URL}/review/${shareToken}`,
      pin, // shown ONCE to the staff member who created the share
      expiresAt,
    }),
  };
}

async function getProjectShareStatus(projectId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: SHARES_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :pid",
      ExpressionAttributeValues: { ":pid": projectId },
      Limit: 1,
    }),
  );

  if (!result.Items?.length) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ active: false }),
    };
  }

  const share = result.Items[0];
  const expired = share.expiresAt && new Date(share.expiresAt) <= new Date();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      active: !expired,
      expiresAt: share.expiresAt,
      shareUrl: expired
        ? null
        : `${REVIEW_BASE_URL}/review/${share.shareToken}`,
    }),
  };
}

async function revokeProjectShare(projectId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: SHARES_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :pid",
      ExpressionAttributeValues: { ":pid": projectId },
      Limit: 1,
    }),
  );

  if (!result.Items?.length) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "No active share found" }),
    };
  }

  await ddb.send(
    new DeleteCommand({
      TableName: SHARES_TABLE,
      Key: { shareToken: result.Items[0].shareToken },
    }),
  );

  return { statusCode: 204, headers, body: "" };
}

// =============================================================================
// Public review endpoint — validate PIN, aggregate and return project data
// =============================================================================

async function getReviewData(shareToken, pin) {
  // 1. Fetch the share record
  const shareResult = await ddb.send(
    new GetCommand({ TableName: SHARES_TABLE, Key: { shareToken } }),
  );

  if (!shareResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Share link not found or expired" }),
    };
  }

  const share = shareResult.Item;
  const now = new Date();

  // 2. Check expiry
  if (share.expiresAt && new Date(share.expiresAt) <= now) {
    return {
      statusCode: 410,
      headers,
      body: JSON.stringify({ message: "This share link has expired" }),
    };
  }

  // 3. Check lockout
  if (share.lockedUntil && new Date(share.lockedUntil) > now) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        message: "Too many incorrect attempts. Try again later.",
        lockedUntil: share.lockedUntil,
      }),
    };
  }

  // 4. PIN required
  if (!pin) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: "PIN required" }),
    };
  }

  // 5. Validate PIN
  const pinCorrect = await bcrypt.compare(pin, share.pinHash);

  if (!pinCorrect) {
    const newFailedAttempts = (share.failedAttempts || 0) + 1;
    const updateExpr =
      newFailedAttempts >= MAX_FAILED_PIN_ATTEMPTS
        ? "SET failedAttempts = :fa, lockedUntil = :lu"
        : "SET failedAttempts = :fa";
    const exprValues =
      newFailedAttempts >= MAX_FAILED_PIN_ATTEMPTS
        ? {
            ":fa": newFailedAttempts,
            ":lu": new Date(
              now.getTime() + PIN_LOCKOUT_MINUTES * 60 * 1000,
            ).toISOString(),
          }
        : { ":fa": newFailedAttempts };

    await ddb.send(
      new UpdateCommand({
        TableName: SHARES_TABLE,
        Key: { shareToken },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprValues,
      }),
    );

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        message: "Incorrect PIN",
        attemptsRemaining: Math.max(
          0,
          MAX_FAILED_PIN_ATTEMPTS - newFailedAttempts,
        ),
      }),
    };
  }

  // 6. PIN correct — reset failed attempts
  if ((share.failedAttempts || 0) > 0) {
    await ddb.send(
      new UpdateCommand({
        TableName: SHARES_TABLE,
        Key: { shareToken },
        UpdateExpression: "SET failedAttempts = :z",
        ExpressionAttributeValues: { ":z": 0 },
      }),
    );
  }

  // 7. Aggregate project data — mirrors fetchProjectData in pptxService.ts
  const projectResult = await ddb.send(
    new GetCommand({
      TableName: PROJECTS_TABLE,
      Key: { id: share.projectId },
    }),
  );

  if (!projectResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Project not found" }),
    };
  }

  const project = projectResult.Item;

  // Fetch categories for this project
  const categoriesResult = await ddb.send(
    new QueryCommand({
      TableName: CATEGORIES_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :pid",
      ExpressionAttributeValues: { ":pid": share.projectId },
    }),
  );
  const categories = categoriesResult.Items || [];

  // Fetch all line items for this project
  const lineItemsResult = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMS_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :pid",
      ExpressionAttributeValues: { ":pid": share.projectId },
    }),
  );
  const lineItems = lineItemsResult.Items || [];

  if (!lineItems.length) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ project, categories, lineItems: [] }),
    };
  }

  // Fetch line item options in one go via ProjectIdIndex (if available) or individual queries
  const optionResults = await Promise.all(
    lineItems.map((li) =>
      ddb
        .send(
          new QueryCommand({
            TableName: LINEITEMOPTIONS_TABLE,
            IndexName: "lineItemId-index",
            KeyConditionExpression: "lineItemId = :lid",
            ExpressionAttributeValues: { ":lid": li.id },
          }),
        )
        .then((r) => r.Items || [])
        .catch(() => []),
    ),
  );

  // Collect unique product IDs (selected + option products)
  const productIdSet = new Set();
  lineItems.forEach((li) => li.productId && productIdSet.add(li.productId));
  optionResults.flat().forEach((opt) => productIdSet.add(opt.productId));

  // BatchGet all products at once (max 100 per call — fine for typical project sizes)
  let productsMap = {};
  if (productIdSet.size > 0) {
    const productKeys = [...productIdSet].map((id) => ({ id }));
    const batchResult = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [PRODUCTS_TABLE]: { Keys: productKeys },
        },
      }),
    );
    (batchResult.Responses?.[PRODUCTS_TABLE] || []).forEach((p) => {
      productsMap[p.id] = p;
    });
  }

  // Collect unique manufacturer IDs
  const manufacturerIdSet = new Set();
  Object.values(productsMap).forEach(
    (p) => p.manufacturerId && manufacturerIdSet.add(p.manufacturerId),
  );

  let manufacturersMap = {};
  if (manufacturerIdSet.size > 0) {
    const mfgKeys = [...manufacturerIdSet].map((id) => ({ id }));
    const mfgBatch = await ddb.send(
      new BatchGetCommand({
        RequestItems: { [MANUFACTURERS_TABLE]: { Keys: mfgKeys } },
      }),
    );
    (mfgBatch.Responses?.[MANUFACTURERS_TABLE] || []).forEach((m) => {
      manufacturersMap[m.id] = m;
    });
  }

  // Collect unique vendor IDs
  const vendorIdSet = new Set();
  lineItems.forEach((li) => li.vendorId && vendorIdSet.add(li.vendorId));

  let vendorsMap = {};
  if (vendorIdSet.size > 0) {
    const vendorKeys = [...vendorIdSet].map((id) => ({ id }));
    const vendorBatch = await ddb.send(
      new BatchGetCommand({
        RequestItems: { [VENDORS_TABLE]: { Keys: vendorKeys } },
      }),
    );
    (vendorBatch.Responses?.[VENDORS_TABLE] || []).forEach((v) => {
      vendorsMap[v.id] = v;
    });
  }

  // Build enriched line items grouped by category
  const categoriesMap = {};
  categories.forEach((c) => {
    categoriesMap[c.id] = c;
  });

  const enrichedLineItems = lineItems.map((li, idx) => {
    const options = (optionResults[idx] || [])
      .filter((opt) => !opt.isSelected)
      .map((opt) => ({
        option: opt,
        product: productsMap[opt.productId] || null,
        manufacturer: productsMap[opt.productId]?.manufacturerId
          ? manufacturersMap[productsMap[opt.productId].manufacturerId] || null
          : null,
        vendor: null,
      }));

    return {
      ...li,
      category: categoriesMap[li.categoryId] || null,
      product: li.productId ? productsMap[li.productId] || null : null,
      manufacturer:
        li.productId && productsMap[li.productId]?.manufacturerId
          ? manufacturersMap[productsMap[li.productId].manufacturerId] || null
          : null,
      vendor: li.vendorId ? vendorsMap[li.vendorId] || null : null,
      options,
    };
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      project,
      categories,
      lineItems: enrichedLineItems,
      expiresAt: share.expiresAt,
    }),
  };
}
