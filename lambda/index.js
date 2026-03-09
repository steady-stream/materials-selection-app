const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const {
  createProjectFolder,
  getProjectFolderContents,
  uploadFileToProjectFolder,
  deleteFileFromProjectFolder,
  listFoldersInBaseDir,
  createFolderWithName,
} = require("./sharepointService");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} = require("@aws-sdk/client-bedrock-agent-runtime");

const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const bedrockAgentClient = new BedrockAgentRuntimeClient({
  region: "us-east-1",
});

const KNOWLEDGE_BASE_ID = "WWMDUQTZJZ";

const PROJECTS_TABLE = "MaterialsSelection-Projects";
const CATEGORIES_TABLE = "MaterialsSelection-Categories";
const LINEITEMS_TABLE = "MaterialsSelection-LineItems";
const VENDORS_TABLE = "MaterialsSelection-Vendors";
const MANUFACTURERS_TABLE = "MaterialsSelection-Manufacturers";
const PRODUCTS_TABLE = "MaterialsSelection-Products";
const ORDERS_TABLE = "MaterialsSelection-Orders";
const ORDERITEMS_TABLE = "MaterialsSelection-OrderItems";
const RECEIPTS_TABLE = "MaterialsSelection-Receipts";
const PRODUCTVENDORS_TABLE = "MaterialsSelection-ProductVendors";
const LINEITEMOPTIONS_TABLE = "MaterialsSelection-LineItemOptions";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  // Support both REST API (v1) and HTTP API (v2) formats
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
    if (path.match(/^\/projects\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getProject(id);
    }
    if (path === "/projects" && method === "POST") {
      return await createProject(JSON.parse(event.body));
    }
    if (path.match(/^\/projects\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateProject(id, JSON.parse(event.body));
    }
    if (path.match(/^\/projects\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteProject(id);
    }
    if (path.match(/^\/projects\/[^\/]+\/files$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getProjectFiles(id);
    }
    if (
      path.match(/^\/projects\/[^\/]+\/files\/upload$/) &&
      method === "POST"
    ) {
      const id = path.split("/")[2];
      return await uploadProjectFile(id, JSON.parse(event.body));
    }
    if (
      path.match(/^\/projects\/[^\/]+\/files\/[^\/]+$/) &&
      method === "DELETE"
    ) {
      const id = path.split("/")[2];
      const fileId = path.split("/")[4];
      return await deleteProjectFile(id, fileId);
    }
    // SharePoint folder-browser and link routes
    if (
      path.match(/^\/projects\/[^\/]+\/sharepoint\/folders$/) &&
      method === "GET"
    ) {
      const id = path.split("/")[2];
      return await listSharepointFolders(id);
    }
    if (
      path.match(/^\/projects\/[^\/]+\/sharepoint\/link$/) &&
      method === "POST"
    ) {
      const id = path.split("/")[2];
      return await linkSharepointFolder(id, JSON.parse(event.body));
    }
    // Return non-secret SharePoint configuration (site URL, library, base folder)
    // so the frontend can display what environment it's connecting to
    if (path === "/sharepoint/config" && method === "GET") {
      return await getSharepointConfig();
    }

    // AI routes
    if (path === "/ai/test" && method === "POST") {
      return await testBedrock();
    }
    if (path === "/ai/chat" && method === "POST") {
      const { projectId, messages } = JSON.parse(event.body);
      return await chatWithProject(projectId, messages);
    }
    if (path === "/ai/docs" && method === "POST") {
      const { question } = JSON.parse(event.body);
      return await queryKnowledgeBase(question);
    }

    // Categories routes
    if (path.match(/^\/projects\/[^\/]+\/categories$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getCategoriesByProject(projectId);
    }
    if (path.match(/^\/categories\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getCategory(id);
    }
    if (path === "/categories" && method === "POST") {
      return await createCategory(JSON.parse(event.body));
    }
    if (path.match(/^\/categories\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateCategory(id, JSON.parse(event.body));
    }
    if (path.match(/^\/categories\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteCategory(id);
    }

    // LineItems routes
    if (path.match(/^\/categories\/[^\/]+\/lineitems$/) && method === "GET") {
      const categoryId = path.split("/")[2];
      return await getLineItemsByCategory(categoryId);
    }
    if (path.match(/^\/categories\/[^\/]+\/lineitems$/) && method === "POST") {
      const categoryId = path.split("/")[2];
      // Get category to find projectId
      const categoryResult = await ddb.send(
        new GetCommand({
          TableName: CATEGORIES_TABLE,
          Key: { id: categoryId },
        }),
      );
      if (!categoryResult.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Category not found" }),
        };
      }
      const lineItemData = {
        ...JSON.parse(event.body),
        categoryId: categoryId,
        projectId: categoryResult.Item.projectId,
      };
      return await createLineItem(lineItemData);
    }
    if (path.match(/^\/projects\/[^\/]+\/lineitems$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getLineItemsByProject(projectId);
    }
    if (path.match(/^\/lineitems\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getLineItem(id);
    }
    if (path === "/lineitems" && method === "POST") {
      return await createLineItem(JSON.parse(event.body));
    }
    if (path.match(/^\/lineitems\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateLineItem(id, JSON.parse(event.body));
    }
    if (path.match(/^\/lineitems\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteLineItem(id);
    }

    // LineItemOptions routes
    if (path.match(/^\/lineitems\/[^\/]+\/options$/) && method === "GET") {
      const lineItemId = path.split("/")[2];
      return await getLineItemOptions(lineItemId);
    }
    if (path.match(/^\/lineitems\/[^\/]+\/options$/) && method === "POST") {
      const lineItemId = path.split("/")[2];
      return await createLineItemOption(lineItemId, JSON.parse(event.body));
    }
    if (
      path.match(/^\/lineitems\/[^\/]+\/select-option$/) &&
      method === "PUT"
    ) {
      const lineItemId = path.split("/")[2];
      return await selectLineItemOption(lineItemId, JSON.parse(event.body));
    }
    if (path.match(/^\/lineitem-options\/[^\/]+$/) && method === "PUT") {
      const optionId = path.split("/")[2];
      return await updateLineItemOption(optionId, JSON.parse(event.body));
    }
    if (path.match(/^\/lineitem-options\/[^\/]+$/) && method === "DELETE") {
      const optionId = path.split("/")[2];
      return await deleteLineItemOption(optionId);
    }

    // Vendors routes
    if (path === "/vendors" && method === "GET") {
      return await getAllVendors();
    }
    if (path.match(/^\/vendors\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getVendor(id);
    }
    if (path === "/vendors" && method === "POST") {
      return await createVendor(JSON.parse(event.body));
    }
    if (path.match(/^\/vendors\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateVendor(id, JSON.parse(event.body));
    }
    if (path.match(/^\/vendors\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteVendor(id);
    }

    // Manufacturers routes
    if (path === "/manufacturers" && method === "GET") {
      return await getAllManufacturers();
    }
    if (path.match(/^\/manufacturers\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getManufacturer(id);
    }
    if (path === "/manufacturers" && method === "POST") {
      return await createManufacturer(JSON.parse(event.body));
    }
    if (path.match(/^\/manufacturers\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateManufacturer(id, JSON.parse(event.body));
    }
    if (path.match(/^\/manufacturers\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteManufacturer(id);
    }

    // Products routes
    if (path === "/products" && method === "GET") {
      return await getAllProducts();
    }
    if (path.match(/^\/manufacturers\/[^\/]+\/products$/) && method === "GET") {
      const manufacturerId = path.split("/")[2];
      return await getProductsByManufacturer(manufacturerId);
    }
    if (path.match(/^\/products\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getProduct(id);
    }
    if (path === "/products" && method === "POST") {
      return await createProduct(JSON.parse(event.body));
    }
    if (path.match(/^\/products\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateProduct(id, JSON.parse(event.body));
    }
    if (path.match(/^\/products\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteProduct(id);
    }

    // ProductVendor routes
    if (path.match(/^\/products\/[^\/]+\/vendors$/) && method === "GET") {
      const productId = path.split("/")[2];
      return await getProductVendorsByProduct(productId);
    }
    if (path === "/product-vendors" && method === "POST") {
      return await createProductVendor(JSON.parse(event.body));
    }
    if (path.match(/^\/product-vendors\/[^\/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      return await getProductVendor(id);
    }
    if (path.match(/^\/product-vendors\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateProductVendor(id, JSON.parse(event.body));
    }
    if (path.match(/^\/product-vendors\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteProductVendor(id);
    }

    // Orders routes
    if (path.match(/^\/projects\/[^\/]+\/orders$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getOrdersByProject(projectId);
    }
    if (path === "/orders" && method === "POST") {
      return await createOrder(JSON.parse(event.body));
    }
    if (path.match(/^\/orders\/[^\/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateOrder(id, JSON.parse(event.body));
    }
    if (path.match(/^\/orders\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteOrder(id);
    }

    // OrderItems routes
    if (path.match(/^\/orders\/[^\/]+\/items$/) && method === "GET") {
      const orderId = path.split("/")[2];
      return await getOrderItemsByOrder(orderId);
    }
    if (path.match(/^\/projects\/[^\/]+\/orderitems$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getOrderItemsByProject(projectId);
    }
    if (path === "/orderitems" && method === "POST") {
      return await createOrderItems(JSON.parse(event.body));
    }
    if (path.match(/^\/orderitems\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteOrderItem(id);
    }

    // Receipts routes
    if (path.match(/^\/orders\/[^\/]+\/receipts$/) && method === "GET") {
      const orderId = path.split("/")[2];
      return await getReceiptsByOrder(orderId);
    }
    if (path === "/receipts" && method === "POST") {
      return await createReceipts(JSON.parse(event.body));
    }
    if (path.match(/^\/receipts\/[^\/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteReceipt(id);
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

// Project functions
async function getAllProjects() {
  const result = await ddb.send(new ScanCommand({ TableName: PROJECTS_TABLE }));
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
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
  // First get the existing project to preserve fields
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
  // Get the project to retrieve SharePoint folder info
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

  // Check if project has SharePoint folder
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ files: [], message: "No SharePoint folder" }),
    };
  }

  // Get folder contents from SharePoint
  try {
    const files = await getProjectFolderContents(
      project.sharepointDriveId,
      project.sharepointFolderId,
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ files }),
    };
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
  // Get the project to retrieve SharePoint folder info
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

  // Check if project has SharePoint folder
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Project has no SharePoint folder" }),
    };
  }

  // Validate request
  if (!data.fileName || !data.fileContent) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "fileName and fileContent are required",
      }),
    };
  }

  // Upload file to SharePoint
  try {
    // Convert base64 to Buffer
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
  // Get the project to retrieve SharePoint folder info
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

  // Check if project has SharePoint folder
  if (!project.sharepointDriveId || !project.sharepointFolderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Project has no SharePoint folder" }),
    };
  }

  // Delete file from SharePoint
  try {
    await deleteFileFromProjectFolder(project.sharepointDriveId, fileId);

    return {
      statusCode: 204,
      headers,
      body: "",
    };
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

/**
 * Return non-secret SharePoint configuration so the UI can show which
 * environment (tenant / site / library) it is connected to.
 * Secrets (clientId, clientSecret, tenantId) are intentionally omitted.
 */
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

/**
 * List available SharePoint folders so the user can pick one to link.
 * Returns all subfolders of SHAREPOINT_BASE_FOLDER plus driveId/siteId for linking.
 */
async function listSharepointFolders(id) {
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
    const data = await listFoldersInBaseDir();
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

/**
 * Link a SharePoint folder to a project.
 * Body options:
 *   { folderId, folderName, driveId, siteId, folderUrl } — link an existing folder
 *   { createNew: true, folderName }                      — create a new folder with the given name
 */
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
      // User wants a brand-new folder with their chosen name
      folderInfo = await createFolderWithName(data.folderName);
    } else if (data.folderId && data.driveId && data.siteId) {
      // User picked an existing folder from the browser list
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

// Category functions
async function getCategoriesByProject(projectId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: CATEGORIES_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: { ":projectId": projectId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getCategory(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: CATEGORIES_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Category not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createCategory(data) {
  const category = {
    id: randomUUID(),
    projectId: data.projectId,
    name: data.name,
    description: data.description,
    allowance: data.allowance || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: CATEGORIES_TABLE, Item: category }),
  );
  return { statusCode: 201, headers, body: JSON.stringify(category) };
}

async function updateCategory(id, data) {
  // First get the existing category to preserve fields
  const existingResult = await ddb.send(
    new GetCommand({ TableName: CATEGORIES_TABLE, Key: { id } }),
  );

  if (!existingResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Category not found" }),
    };
  }

  const category = {
    ...existingResult.Item,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: CATEGORIES_TABLE, Item: category }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(category) };
}

async function deleteCategory(id) {
  await ddb.send(
    new DeleteCommand({ TableName: CATEGORIES_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}

// LineItem functions
async function getLineItemsByCategory(categoryId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMS_TABLE,
      IndexName: "CategoryIdIndex",
      KeyConditionExpression: "categoryId = :categoryId",
      ExpressionAttributeValues: { ":categoryId": categoryId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getLineItemsByProject(projectId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMS_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: { ":projectId": projectId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getLineItem(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: LINEITEMS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "LineItem not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createLineItem(data) {
  const totalCost = data.quantity * data.unitCost;
  const lineItem = {
    id: randomUUID(),
    categoryId: data.categoryId,
    projectId: data.projectId,
    name: data.name,
    material: data.material,
    quantity: data.quantity,
    unit: data.unit,
    unitCost: data.unitCost,
    totalCost: totalCost,
    notes: data.notes || "",
    vendorId: data.vendorId || null,
    manufacturerId: data.manufacturerId || null,
    productId: data.productId || null,
    modelNumber: data.modelNumber || null,
    allowance: data.allowance || null,
    orderedDate: data.orderedDate || null,
    receivedDate: data.receivedDate || null,
    stagingLocation: data.stagingLocation || null,
    returnNotes: data.returnNotes || null,
    status: data.status || (data.productId ? "selected" : "pending"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: LINEITEMS_TABLE, Item: lineItem }),
  );
  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({ success: true, lineItem }),
  };
}

async function updateLineItem(id, data) {
  // Get existing item first
  const existing = await ddb.send(
    new GetCommand({ TableName: LINEITEMS_TABLE, Key: { id } }),
  );

  if (!existing.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Line item not found" }),
    };
  }

  // Build UpdateExpression for SET and REMOVE
  const setExpressions = [];
  const removeExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  // Always update timestamp
  setExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  // Fields that should never be updated (immutable, structural, computed, or virtual)
  const IMMUTABLE_FIELDS = [
    "id",
    "categoryId",
    "projectId",
    "createdAt",
    "updatedAt",
    "totalCost", // Computed from quantity * unitCost
    "vendorName", // Virtual field from join, not stored
    "manufacturerName", // Virtual field from join, not stored
  ];

  // Process each field
  Object.keys(data).forEach((key) => {
    // Skip immutable fields
    if (IMMUTABLE_FIELDS.includes(key)) {
      return;
    }

    const attrName = `#${key}`;
    const attrValue = `:${key}`;

    if (data[key] !== null && data[key] !== undefined) {
      // SET the value (including empty string and 0)
      setExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = data[key];
    } else if (data[key] === null) {
      // REMOVE the attribute when null
      removeExpressions.push(attrName);
      expressionAttributeNames[attrName] = key;
    }
    // If undefined, skip it (not present in JSON)
  });

  // Build the update expression
  let updateExpression = "";
  if (setExpressions.length > 0) {
    updateExpression += "SET " + setExpressions.join(", ");
  }
  if (removeExpressions.length > 0) {
    if (updateExpression) updateExpression += " ";
    updateExpression += "REMOVE " + removeExpressions.join(", ");
  }

  // Recalculate totalCost if quantity or unitCost are being updated
  if (data.quantity !== undefined || data.unitCost !== undefined) {
    const newQuantity =
      data.quantity !== undefined ? data.quantity : existing.Item.quantity;
    const newUnitCost =
      data.unitCost !== undefined ? data.unitCost : existing.Item.unitCost;
    if (newQuantity !== undefined && newUnitCost !== undefined) {
      setExpressions.push("#totalCost = :totalCost");
      expressionAttributeNames["#totalCost"] = "totalCost";
      expressionAttributeValues[":totalCost"] = newQuantity * newUnitCost;
      // Rebuild update expression with totalCost
      updateExpression = "SET " + setExpressions.join(", ");
      if (removeExpressions.length > 0) {
        updateExpression += " REMOVE " + removeExpressions.join(", ");
      }
    }
  }

  const result = await ddb.send(
    new UpdateCommand({
      TableName: LINEITEMS_TABLE,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }),
  );

  return { statusCode: 200, headers, body: JSON.stringify(result.Attributes) };
}

async function deleteLineItem(id) {
  await ddb.send(
    new DeleteCommand({ TableName: LINEITEMS_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}

// LineItemOptions functions
async function getLineItemOptions(lineItemId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      IndexName: "lineItemId-index",
      KeyConditionExpression: "lineItemId = :lineItemId",
      ExpressionAttributeValues: {
        ":lineItemId": lineItemId,
      },
    }),
  );
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Items || []),
  };
}

async function createLineItemOption(lineItemId, data) {
  const option = {
    id: randomUUID(),
    lineItemId: lineItemId,
    productId: data.productId,
    unitCost: data.unitCost,
    isSelected: data.isSelected || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: LINEITEMOPTIONS_TABLE, Item: option }),
  );
  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({ success: true, option }),
  };
}

async function updateLineItemOption(optionId, data) {
  // Build update expression dynamically
  const updateParts = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (data.unitCost !== undefined) {
    updateParts.push("#unitCost = :unitCost");
    expressionAttributeNames["#unitCost"] = "unitCost";
    expressionAttributeValues[":unitCost"] = data.unitCost;
  }
  if (data.isSelected !== undefined) {
    updateParts.push("#isSelected = :isSelected");
    expressionAttributeNames["#isSelected"] = "isSelected";
    expressionAttributeValues[":isSelected"] = data.isSelected;
  }

  // Always update updatedAt
  updateParts.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  const result = await ddb.send(
    new UpdateCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      Key: { id: optionId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }),
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Attributes),
  };
}

async function selectLineItemOption(lineItemId, data) {
  // data = { productId, unitCost }
  const { productId, unitCost } = data;

  // 1. Get all options for this line item
  const queryResult = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      IndexName: "lineItemId-index",
      KeyConditionExpression: "lineItemId = :lineItemId",
      ExpressionAttributeValues: {
        ":lineItemId": lineItemId,
      },
    }),
  );

  const existingOptions = queryResult.Items || [];
  const matchingOption = existingOptions.find(
    (opt) => opt.productId === productId,
  );

  let selectedOption;

  // 2. Create or update the option to be selected
  if (matchingOption) {
    // Update existing option to selected
    const updateResult = await ddb.send(
      new UpdateCommand({
        TableName: LINEITEMOPTIONS_TABLE,
        Key: { id: matchingOption.id },
        UpdateExpression:
          "SET #isSelected = :isSelected, #unitCost = :unitCost, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#isSelected": "isSelected",
          "#unitCost": "unitCost",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":isSelected": true,
          ":unitCost": unitCost,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    selectedOption = updateResult.Attributes;
  } else {
    // Create new option as selected
    selectedOption = {
      id: randomUUID(),
      lineItemId: lineItemId,
      productId: productId,
      unitCost: unitCost,
      isSelected: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({
        TableName: LINEITEMOPTIONS_TABLE,
        Item: selectedOption,
      }),
    );
  }

  // 3. Deselect all other options for this line item
  const deselectPromises = existingOptions
    .filter((opt) => opt.productId !== productId && opt.isSelected)
    .map((opt) =>
      ddb.send(
        new UpdateCommand({
          TableName: LINEITEMOPTIONS_TABLE,
          Key: { id: opt.id },
          UpdateExpression:
            "SET #isSelected = :isSelected, #updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#isSelected": "isSelected",
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":isSelected": false,
            ":updatedAt": new Date().toISOString(),
          },
        }),
      ),
    );

  await Promise.all(deselectPromises);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, option: selectedOption }),
  };
}

async function deleteLineItemOption(optionId) {
  await ddb.send(
    new DeleteCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      Key: { id: optionId },
    }),
  );
  return { statusCode: 204, headers, body: "" };
}

// Vendor functions
async function getAllVendors() {
  const result = await ddb.send(new ScanCommand({ TableName: VENDORS_TABLE }));
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getVendor(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: VENDORS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Vendor not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createVendor(data) {
  const vendor = {
    id: randomUUID(),
    name: data.name,
    contactInfo: data.contactInfo || "",
    website: data.website || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: VENDORS_TABLE, Item: vendor }));
  return { statusCode: 201, headers, body: JSON.stringify(vendor) };
}

async function updateVendor(id, data) {
  const vendor = {
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: VENDORS_TABLE, Item: vendor }));
  return { statusCode: 200, headers, body: JSON.stringify(vendor) };
}

async function deleteVendor(id) {
  await ddb.send(new DeleteCommand({ TableName: VENDORS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// Manufacturer functions
async function getAllManufacturers() {
  const result = await ddb.send(
    new ScanCommand({ TableName: MANUFACTURERS_TABLE }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getManufacturer(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: MANUFACTURERS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Manufacturer not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createManufacturer(data) {
  const manufacturer = {
    id: randomUUID(),
    name: data.name,
    website: data.website || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: MANUFACTURERS_TABLE, Item: manufacturer }),
  );
  return { statusCode: 201, headers, body: JSON.stringify(manufacturer) };
}

async function updateManufacturer(id, data) {
  const manufacturer = {
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({ TableName: MANUFACTURERS_TABLE, Item: manufacturer }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(manufacturer) };
}

async function deleteManufacturer(id) {
  await ddb.send(
    new DeleteCommand({ TableName: MANUFACTURERS_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}

// Product functions
async function getAllProducts() {
  const result = await ddb.send(new ScanCommand({ TableName: PRODUCTS_TABLE }));
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getProductsByManufacturer(manufacturerId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTS_TABLE,
      IndexName: "ManufacturerIdIndex",
      KeyConditionExpression: "manufacturerId = :manufacturerId",
      ExpressionAttributeValues: { ":manufacturerId": manufacturerId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getProduct(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Product not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createProduct(data) {
  const product = {
    id: randomUUID(),
    manufacturerId: data.manufacturerId,
    name: data.name,
    modelNumber: data.modelNumber || null,
    description: data.description || "",
    category: data.category || null,
    unit: data.unit || null,
    tier: data.tier || null,
    collection: data.collection || null,
    imageUrl: data.imageUrl || null,
    productUrl: data.productUrl || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));
  return { statusCode: 201, headers, body: JSON.stringify(product) };
}

async function updateProduct(id, data) {
  // Fetch existing product first
  const getResult = await ddb.send(
    new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id } }),
  );
  if (!getResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Product not found" }),
    };
  }

  const product = {
    ...getResult.Item,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));
  return { statusCode: 200, headers, body: JSON.stringify(product) };
}

async function deleteProduct(id) {
  await ddb.send(new DeleteCommand({ TableName: PRODUCTS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// Order functions
async function getOrdersByProject(projectId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      IndexName: "ProjectIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: { ":projectId": projectId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function createOrder(data) {
  const order = {
    id: randomUUID(),
    projectId: data.projectId,
    vendorId: data.vendorId,
    orderNumber: data.orderNumber,
    orderDate: data.orderDate,
    notes: data.notes || "",
    status: data.status || "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
  return { statusCode: 201, headers, body: JSON.stringify(order) };
}

async function updateOrder(id, data) {
  const order = {
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
  return { statusCode: 200, headers, body: JSON.stringify(order) };
}

async function deleteOrder(id) {
  // Delete associated order items first
  const orderItems = await ddb.send(
    new QueryCommand({
      TableName: ORDERITEMS_TABLE,
      IndexName: "OrderIndex",
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": id },
    }),
  );

  // Delete all receipts for each order item
  for (const item of orderItems.Items || []) {
    const receipts = await ddb.send(
      new QueryCommand({
        TableName: RECEIPTS_TABLE,
        IndexName: "OrderItemIndex",
        KeyConditionExpression: "orderItemId = :orderItemId",
        ExpressionAttributeValues: { ":orderItemId": item.id },
      }),
    );
    for (const receipt of receipts.Items || []) {
      await ddb.send(
        new DeleteCommand({
          TableName: RECEIPTS_TABLE,
          Key: { id: receipt.id },
        }),
      );
    }
    await ddb.send(
      new DeleteCommand({ TableName: ORDERITEMS_TABLE, Key: { id: item.id } }),
    );
  }

  // Delete the order
  await ddb.send(new DeleteCommand({ TableName: ORDERS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// OrderItem functions
async function getOrderItemsByOrder(orderId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: ORDERITEMS_TABLE,
      IndexName: "OrderIndex",
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": orderId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getOrderItemsByProject(projectId) {
  // Get all orders for project first
  const orders = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      IndexName: "ProjectIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: { ":projectId": projectId },
    }),
  );

  // Get all order items for these orders
  const allItems = [];
  for (const order of orders.Items || []) {
    const items = await ddb.send(
      new QueryCommand({
        TableName: ORDERITEMS_TABLE,
        IndexName: "OrderIndex",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: { ":orderId": order.id },
      }),
    );
    allItems.push(...(items.Items || []));
  }

  return { statusCode: 200, headers, body: JSON.stringify(allItems) };
}

// Receipt functions
async function getReceiptsByOrder(orderId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: RECEIPTS_TABLE,
      IndexName: "OrderIndex",
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": orderId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function createReceipts(receipts) {
  const createdReceipts = [];
  for (const receiptData of receipts) {
    const receipt = {
      id: randomUUID(),
      orderId: receiptData.orderId,
      orderItemId: receiptData.orderItemId,
      receivedQuantity: receiptData.receivedQuantity,
      receivedDate: receiptData.receivedDate,
      notes: receiptData.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({ TableName: RECEIPTS_TABLE, Item: receipt }),
    );
    createdReceipts.push(receipt);
  }
  return { statusCode: 201, headers, body: JSON.stringify(createdReceipts) };
}

async function deleteReceipt(id) {
  await ddb.send(new DeleteCommand({ TableName: RECEIPTS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// Order functions
async function getOrderItemsByOrder(orderId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: ORDERITEMS_TABLE,
      IndexName: "OrderIndex",
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": orderId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getOrderItemsByProject(projectId) {
  // Get all orders for the project first
  const ordersResult = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      IndexName: "ProjectIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: { ":projectId": projectId },
    }),
  );

  // Get order items for all orders
  const allOrderItems = [];
  for (const order of ordersResult.Items || []) {
    const itemsResult = await ddb.send(
      new QueryCommand({
        TableName: ORDERITEMS_TABLE,
        IndexName: "OrderIndex",
        KeyConditionExpression: "orderId = :orderId",
        ExpressionAttributeValues: { ":orderId": order.id },
      }),
    );
    allOrderItems.push(...(itemsResult.Items || []));
  }

  return { statusCode: 200, headers, body: JSON.stringify(allOrderItems) };
}

async function createOrderItems(items) {
  const createdItems = [];
  for (const data of items) {
    const orderItem = {
      id: randomUUID(),
      orderId: data.orderId,
      lineItemId: data.lineItemId,
      orderedQuantity: data.orderedQuantity,
      orderedPrice: data.orderedPrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({ TableName: ORDERITEMS_TABLE, Item: orderItem }),
    );
    createdItems.push(orderItem);
  }
  return { statusCode: 201, headers, body: JSON.stringify(createdItems) };
}

async function deleteOrderItem(id) {
  await ddb.send(
    new DeleteCommand({ TableName: ORDERITEMS_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}

// ProductVendor functions
async function getProductVendorsByProduct(productId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTVENDORS_TABLE,
      IndexName: "ProductIdIndex",
      KeyConditionExpression: "productId = :productId",
      ExpressionAttributeValues: {
        ":productId": productId,
      },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getProductVendor(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: PRODUCTVENDORS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "ProductVendor not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function createProductVendor(data) {
  // Check if this is the first vendor for this product
  const existing = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTVENDORS_TABLE,
      IndexName: "ProductIdIndex",
      KeyConditionExpression: "productId = :productId",
      ExpressionAttributeValues: {
        ":productId": data.productId,
      },
    }),
  );

  const isFirstVendor = !existing.Items || existing.Items.length === 0;
  const isPrimary =
    data.isPrimary !== undefined ? data.isPrimary : isFirstVendor;

  // If setting this as primary, unset all others
  if (isPrimary && existing.Items) {
    for (const item of existing.Items) {
      if (item.isPrimary) {
        await ddb.send(
          new PutCommand({
            TableName: PRODUCTVENDORS_TABLE,
            Item: {
              ...item,
              isPrimary: false,
              updatedAt: new Date().toISOString(),
            },
          }),
        );
      }
    }
  }

  const productVendor = {
    id: randomUUID(),
    productId: data.productId,
    vendorId: data.vendorId,
    cost: data.cost,
    sku: data.sku || null,
    isPrimary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({ TableName: PRODUCTVENDORS_TABLE, Item: productVendor }),
  );
  return { statusCode: 201, headers, body: JSON.stringify(productVendor) };
}

async function updateProductVendor(id, data) {
  const getResult = await ddb.send(
    new GetCommand({ TableName: PRODUCTVENDORS_TABLE, Key: { id } }),
  );
  if (!getResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "ProductVendor not found" }),
    };
  }

  // If setting as primary, unset all others for this product
  if (data.isPrimary) {
    const existing = await ddb.send(
      new QueryCommand({
        TableName: PRODUCTVENDORS_TABLE,
        IndexName: "ProductIdIndex",
        KeyConditionExpression: "productId = :productId",
        ExpressionAttributeValues: {
          ":productId": getResult.Item.productId,
        },
      }),
    );

    if (existing.Items) {
      for (const item of existing.Items) {
        if (item.id !== id && item.isPrimary) {
          await ddb.send(
            new PutCommand({
              TableName: PRODUCTVENDORS_TABLE,
              Item: {
                ...item,
                isPrimary: false,
                updatedAt: new Date().toISOString(),
              },
            }),
          );
        }
      }
    }
  }

  const productVendor = {
    ...getResult.Item,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({ TableName: PRODUCTVENDORS_TABLE, Item: productVendor }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(productVendor) };
}

// AI Functions
async function testBedrock() {
  try {
    const payload = {
      messages: [
        {
          role: "user",
          content: [
            {
              text: "Hello! Please respond with a brief greeting to confirm you're working.",
            },
          ],
        },
      ],
      inferenceConfig: {
        max_new_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      },
    };

    const command = new InvokeModelCommand({
      modelId: "us.amazon.nova-micro-v1:0",
      body: JSON.stringify(payload),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: responseBody.output.message.content[0].text,
        model: "us.amazon.nova-micro-v1:0",
      }),
    };
  } catch (error) {
    console.error("Bedrock error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to invoke Bedrock",
        details: error.message,
      }),
    };
  }
}

// Query Knowledge Base for document-based questions
async function queryKnowledgeBase(question) {
  try {
    const command = new RetrieveAndGenerateCommand({
      input: {
        text: question,
      },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          modelArn:
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
        },
      },
    });

    const response = await bedrockAgentClient.send(command);

    // Extract citations if available
    const citations =
      response.citations?.map((citation) => ({
        text: citation.generatedResponsePart?.textResponsePart?.text,
        sources: citation.retrievedReferences?.map((ref) => ({
          content: ref.content?.text,
          location: ref.location?.s3Location?.uri,
        })),
      })) || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: response.output?.text || "No response generated",
        citations: citations,
        sessionId: response.sessionId,
      }),
    };
  } catch (error) {
    console.error("Knowledge Base error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to query Knowledge Base",
        details: error.message,
      }),
    };
  }
}

// Helper function to load entities by ID and return as Map
async function loadEntitiesById(tableName, ids) {
  if (ids.length === 0) return new Map();

  const results = await Promise.all(
    ids.map((id) =>
      ddb
        .send(new GetCommand({ TableName: tableName, Key: { id } }))
        .then((result) => result.Item)
        .catch(() => null),
    ),
  );

  const entityMap = new Map();
  results.forEach((item, idx) => {
    if (item) {
      entityMap.set(ids[idx], item);
    }
  });

  return entityMap;
}

/**
 * Extract product suggestions from AI response text
 * Returns array of suggested actions for the UI
 */
function extractProductActions(
  aiText,
  products,
  vendors,
  manufacturers,
  categories,
) {
  const actions = [];

  // Find products mentioned in the AI response
  // Check for product name or model number matches
  products.forEach((product) => {
    let mentioned = false;

    // Check for model number (more specific)
    if (
      product.modelNumber &&
      aiText.toLowerCase().includes(product.modelNumber.toLowerCase())
    ) {
      mentioned = true;
    }

    // Check for product name (broader match)
    if (
      !mentioned &&
      product.name &&
      product.name.length > 5 && // Avoid matching very short names
      aiText.toLowerCase().includes(product.name.toLowerCase())
    ) {
      mentioned = true;
    }

    if (mentioned) {
      // Find the vendor for this product
      const vendor = vendors.find((v) => v.id === product.vendorId);

      // Find the manufacturer
      const manufacturer = manufacturers.find(
        (m) => m.id === product.manufacturerId,
      );

      // Create action suggestion
      const actionLabel = `Add ${product.name}`;
      const vendorInfo = vendor ? ` from ${vendor.name}` : "";
      const priceInfo = product.unitCost > 0 ? ` ($${product.unitCost})` : "";

      actions.push({
        type: "addLineItem",
        label: actionLabel,
        helpText: `Add to project${vendorInfo}${priceInfo}`,
        data: {
          productId: product.id,
          productName: product.name,
          modelNumber: product.modelNumber,
          vendorId: vendor?.id,
          vendorName: vendor?.name,
          manufacturerId: product.manufacturerId,
          manufacturerName: manufacturer?.name,
          unitCost: product.unitCost || 0,
          quantity: 1,
          unit: product.unit || "ea",
          material: product.description || "",
          // categoryId will be selected by user
        },
      });
    }
  });

  // Limit to top 3 suggestions to avoid overwhelming UI
  return actions.slice(0, 3);
}

async function chatWithProject(projectId, conversationMessages) {
  try {
    // Load project from DynamoDB
    const projectResult = await ddb.send(
      new GetCommand({ TableName: PROJECTS_TABLE, Key: { id: projectId } }),
    );

    if (!projectResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Project not found" }),
      };
    }

    const project = projectResult.Item;

    // Load categories for this project
    const categoriesResult = await ddb.send(
      new ScanCommand({
        TableName: CATEGORIES_TABLE,
        FilterExpression: "projectId = :projectId",
        ExpressionAttributeValues: { ":projectId": projectId },
      }),
    );

    const categories = categoriesResult.Items || [];

    // Load line items for this project
    const lineItemsResult = await ddb.send(
      new QueryCommand({
        TableName: LINEITEMS_TABLE,
        IndexName: "ProjectIdIndex",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: { ":projectId": projectId },
      }),
    );

    const lineItems = lineItemsResult.Items || [];

    // Collect unique IDs to fetch related entities
    const productIds = new Set();
    const manufacturerIds = new Set();
    const vendorIds = new Set();

    lineItems.forEach((item) => {
      if (item.productId) productIds.add(item.productId);
      if (item.manufacturerId) manufacturerIds.add(item.manufacturerId);
      if (item.vendorId) vendorIds.add(item.vendorId);
    });

    // Load related entities in parallel
    const [productsMap, manufacturersMap, vendorsMap] = await Promise.all([
      loadEntitiesById(PRODUCTS_TABLE, Array.from(productIds)),
      loadEntitiesById(MANUFACTURERS_TABLE, Array.from(manufacturerIds)),
      loadEntitiesById(VENDORS_TABLE, Array.from(vendorIds)),
    ]);

    // Calculate totals
    const totalProjectCost = lineItems.reduce(
      (sum, item) => sum + (item.totalCost || 0),
      0,
    );
    const totalCategoryAllowance = categories.reduce(
      (sum, cat) => sum + (cat.allowance || 0),
      0,
    );

    // Build context
    const contextParts = [
      `Project: ${project.name || "Unnamed Project"}`,
      `Customer: ${project.customerName || "Not specified"}`,
      `Address: ${project.address || "Not specified"}`,
      `Type: ${project.type || "Not specified"}`,
      `Status: ${project.status || "Not specified"}`,
      `Description: ${project.description || "No description"}`,
      `Start Date: ${project.estimatedStartDate || "Not set"}`,
      `Total Allowance: $${totalCategoryAllowance.toLocaleString()}`,
      `Total Cost (Line Items): $${totalProjectCost.toLocaleString()}`,
      `Allowance Remaining: $${(totalCategoryAllowance - totalProjectCost).toLocaleString()}`,
    ];

    if (categories.length > 0) {
      contextParts.push(`\nCategories (${categories.length}):`);
      categories.forEach((cat) => {
        const categoryLineItems = lineItems.filter(
          (li) => li.categoryId === cat.id,
        );
        const categoryCost = categoryLineItems.reduce(
          (sum, li) => sum + (li.totalCost || 0),
          0,
        );
        contextParts.push(
          `  - ${cat.categoryName || cat.name}: ${cat.description || "No description"}`,
          `    Allowance: $${(cat.allowance || 0).toLocaleString()}, Actual: $${categoryCost.toLocaleString()}, Remaining: $${((cat.allowance || 0) - categoryCost).toLocaleString()}`,
          `    Line Items: ${categoryLineItems.length}`,
        );
      });
    }

    if (lineItems.length > 0) {
      contextParts.push(`\nLine Items (${lineItems.length}):`);
      lineItems.forEach((item, idx) => {
        const product = productsMap.get(item.productId);
        const manufacturer = manufacturersMap.get(item.manufacturerId);
        const vendor = vendorsMap.get(item.vendorId);

        contextParts.push(`  ${idx + 1}. ${item.name || "Unnamed Item"}`);
        if (item.material) contextParts.push(`     Material: ${item.material}`);
        if (product) {
          contextParts.push(
            `     Product: ${product.name}${product.modelNumber ? ` (Model: ${product.modelNumber})` : ""}`,
          );
          if (product.description)
            contextParts.push(`     Description: ${product.description}`);
        }
        if (manufacturer)
          contextParts.push(`     Manufacturer: ${manufacturer.name}`);
        if (vendor) contextParts.push(`     Vendor: ${vendor.name}`);
        contextParts.push(
          `     Quantity: ${item.quantity || 0} ${item.unit || "units"}`,
          `     Unit Cost: $${(item.unitCost || 0).toLocaleString()}`,
          `     Total Cost: $${(item.totalCost || 0).toLocaleString()}`,
          `     Status: ${item.status || "pending"}`,
        );
        if (item.notes) contextParts.push(`     Notes: ${item.notes}`);
      });
    }

    if (vendorsMap.size > 0) {
      contextParts.push(`\nVendors (${vendorsMap.size}):`);
      vendorsMap.forEach((vendor) => {
        const vendorLineItems = lineItems.filter(
          (li) => li.vendorId === vendor.id,
        );
        contextParts.push(
          `  - ${vendor.name}${vendor.website ? ` (${vendor.website})` : ""}`,
          `    Contact: ${vendor.contactInfo || "Not specified"}`,
          `    Items: ${vendorLineItems.length}`,
        );
      });
    }

    if (manufacturersMap.size > 0) {
      contextParts.push(`\nManufacturers (${manufacturersMap.size}):`);
      manufacturersMap.forEach((mfr) => {
        const mfrProducts = Array.from(productsMap.values()).filter(
          (p) => p.manufacturerId === mfr.id,
        );
        contextParts.push(
          `  - ${mfr.name}${mfr.website ? ` (${mfr.website})` : ""}`,
          `    Products: ${mfrProducts.length}`,
        );
      });
    }

    const projectContext = contextParts.join("\n");

    // Load all products and vendors for action suggestions
    let allProducts = [];
    let allVendors = [];
    let allProductVendors = [];
    try {
      const [productsResult, vendorsResult, productVendorsResult] =
        await Promise.all([
          ddb.send(new ScanCommand({ TableName: PRODUCTS_TABLE })),
          ddb.send(new ScanCommand({ TableName: VENDORS_TABLE })),
          ddb.send(new ScanCommand({ TableName: PRODUCTVENDORS_TABLE })),
        ]);

      allProducts = productsResult.Items || [];
      allVendors = vendorsResult.Items || [];
      allProductVendors = productVendorsResult.Items || [];

      // Enrich products with primary vendor info
      allProducts = allProducts.map((product) => {
        const primaryPV = allProductVendors.find(
          (pv) => pv.productId === product.id && pv.isPrimary === true,
        );
        if (primaryPV) {
          return {
            ...product,
            vendorId: primaryPV.vendorId,
            unitCost: primaryPV.cost,
          };
        }
        return product;
      });
    } catch (error) {
      console.warn("Failed to load all products/vendors:", error);
    }

    // Build system message for Amazon Nova
    const systemMessage = `You are a construction materials expert assistant helping with the project "${project.name || "this construction project"}".

Project Details:
${projectContext}

When recommending products, please include specific details like:
- Product name and model number
- Manufacturer name
- Vendor name
- Approximate price

Format product recommendations clearly so they can be easily identified.

Provide helpful, accurate advice about this construction project. Use the project details to give contextual, specific answers. If asked about project specifics, refer to the actual data provided.`;

    // Build conversation history in Nova format
    const messages = [];

    // Add system context to first user message
    conversationMessages.forEach((msg, index) => {
      if (msg.role === "user") {
        const text =
          index === 0
            ? `${systemMessage}\n\nUser Question: ${msg.content}`
            : msg.content;
        messages.push({
          role: "user",
          content: [{ text }],
        });
      } else if (msg.role === "assistant") {
        messages.push({
          role: "assistant",
          content: [{ text: msg.content }],
        });
      }
    });

    // Call Bedrock with Amazon Nova
    const payload = {
      messages,
      inferenceConfig: {
        max_new_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
      },
    };

    const command = new InvokeModelCommand({
      modelId: "us.amazon.nova-micro-v1:0",
      body: JSON.stringify(payload),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiResponseText = responseBody.output.message.content[0].text;

    // Extract product suggestions from AI response
    const suggestedActions = extractProductActions(
      aiResponseText,
      allProducts,
      allVendors,
      Array.from(manufacturersMap.values()),
      categories,
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: aiResponseText,
        projectName: project.name,
        model: "us.amazon.nova-micro-v1:0",
        suggestedActions,
      }),
    };
  } catch (error) {
    console.error("Chat error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to process chat request",
        details: error.message,
      }),
    };
  }
}

async function deleteProductVendor(id) {
  await ddb.send(
    new DeleteCommand({ TableName: PRODUCTVENDORS_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}
