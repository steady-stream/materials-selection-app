const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
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
