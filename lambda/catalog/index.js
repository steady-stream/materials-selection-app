const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID } = require("crypto");

const s3 = new S3Client({ region: "us-east-1" });
// Bucket name encodes the account ID so test and prod never share images
const IMAGES_BUCKET =
  process.env.PRODUCT_IMAGES_BUCKET || "materials-product-images-634752426026";
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — enforced via presigned URL conditions

const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const VENDORS_TABLE = "MaterialsSelection-Vendors";
const MANUFACTURERS_TABLE = "MaterialsSelection-Manufacturers";
const PRODUCTS_TABLE = "MaterialsSelection-Products";
const PRODUCTVENDORS_TABLE = "MaterialsSelection-ProductVendors";

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
    // Vendors routes
    if (path === "/vendors" && method === "GET") {
      return await getAllVendors();
    }
    if (path.match(/^\/vendors\/[^/]+$/) && method === "GET") {
      return await getVendor(path.split("/")[2]);
    }
    if (path === "/vendors" && method === "POST") {
      return await createVendor(JSON.parse(event.body));
    }
    if (path.match(/^\/vendors\/[^/]+$/) && method === "PUT") {
      return await updateVendor(path.split("/")[2], JSON.parse(event.body));
    }
    if (path.match(/^\/vendors\/[^/]+$/) && method === "DELETE") {
      return await deleteVendor(path.split("/")[2]);
    }

    // Manufacturers routes
    if (path === "/manufacturers" && method === "GET") {
      return await getAllManufacturers();
    }
    if (path.match(/^\/manufacturers\/[^/]+$/) && method === "GET") {
      return await getManufacturer(path.split("/")[2]);
    }
    if (path === "/manufacturers" && method === "POST") {
      return await createManufacturer(JSON.parse(event.body));
    }
    if (path.match(/^\/manufacturers\/[^/]+$/) && method === "PUT") {
      return await updateManufacturer(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path.match(/^\/manufacturers\/[^/]+$/) && method === "DELETE") {
      return await deleteManufacturer(path.split("/")[2]);
    }

    // Products routes
    // Upload-url must be matched before the generic /products/{id} GET pattern
    if (path === "/products/upload-url" && method === "GET") {
      return await getProductImageUploadUrl(event.queryStringParameters || {});
    }
    if (path === "/products" && method === "GET") {
      return await getAllProducts();
    }
    if (path.match(/^\/manufacturers\/[^/]+\/products$/) && method === "GET") {
      return await getProductsByManufacturer(path.split("/")[2]);
    }
    if (path.match(/^\/products\/[^/]+$/) && method === "GET") {
      return await getProduct(path.split("/")[2]);
    }
    if (path === "/products" && method === "POST") {
      return await createProduct(JSON.parse(event.body));
    }
    if (path.match(/^\/products\/[^/]+$/) && method === "PUT") {
      return await updateProduct(path.split("/")[2], JSON.parse(event.body));
    }
    if (path.match(/^\/products\/[^/]+$/) && method === "DELETE") {
      return await deleteProduct(path.split("/")[2]);
    }

    // ProductVendor routes
    if (path === "/product-vendors" && method === "GET") {
      return await getAllProductVendors();
    }
    if (path.match(/^\/products\/[^/]+\/vendors$/) && method === "GET") {
      return await getProductVendorsByProduct(path.split("/")[2]);
    }
    if (path === "/product-vendors" && method === "POST") {
      return await createProductVendor(JSON.parse(event.body));
    }
    if (path.match(/^\/product-vendors\/[^/]+$/) && method === "GET") {
      return await getProductVendor(path.split("/")[2]);
    }
    if (path.match(/^\/product-vendors\/[^/]+$/) && method === "PUT") {
      return await updateProductVendor(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path.match(/^\/product-vendors\/[^/]+$/) && method === "DELETE") {
      return await deleteProductVendor(path.split("/")[2]);
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

// ── Vendor functions ──────────────────────────────────────────────────────────

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
  const vendor = { ...data, id, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: VENDORS_TABLE, Item: vendor }));
  return { statusCode: 200, headers, body: JSON.stringify(vendor) };
}

async function deleteVendor(id) {
  await ddb.send(new DeleteCommand({ TableName: VENDORS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// ── Manufacturer functions ────────────────────────────────────────────────────

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
  const manufacturer = { ...data, id, updatedAt: new Date().toISOString() };
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

// ── Product functions ─────────────────────────────────────────────────────────

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

async function getProductImageUploadUrl({ filename, contentType }) {
  // Validate content type to block non-image uploads
  if (!contentType || !ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "contentType must be one of: " + ALLOWED_IMAGE_TYPES.join(", "),
      }),
    };
  }

  // Derive file extension from contentType (safer than trusting the filename extension)
  const extMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[contentType];
  const key = `product-images/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLengthRange: [1, MAX_IMAGE_BYTES], // rejects uploads > 5 MB at S3 level
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min TTL
  const imageUrl = `https://${IMAGES_BUCKET}.s3.amazonaws.com/${key}`;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ uploadUrl, imageUrl }),
  };
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
    color: data.color || null,
    finish: data.finish || null,
    imageUrl: data.imageUrl || null,
    productUrl: data.productUrl || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));
  return { statusCode: 201, headers, body: JSON.stringify(product) };
}

async function updateProduct(id, data) {
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

// ── ProductVendor functions ───────────────────────────────────────────────────

async function getAllProductVendors() {
  const result = await ddb.send(
    new ScanCommand({ TableName: PRODUCTVENDORS_TABLE }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getProductVendorsByProduct(productId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTVENDORS_TABLE,
      IndexName: "ProductIdIndex",
      KeyConditionExpression: "productId = :productId",
      ExpressionAttributeValues: { ":productId": productId },
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
  const existing = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTVENDORS_TABLE,
      IndexName: "ProductIdIndex",
      KeyConditionExpression: "productId = :productId",
      ExpressionAttributeValues: { ":productId": data.productId },
    }),
  );
  const isFirstVendor = !existing.Items || existing.Items.length === 0;
  const isPrimary =
    data.isPrimary !== undefined ? data.isPrimary : isFirstVendor;

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

  if (data.isPrimary) {
    const existing = await ddb.send(
      new QueryCommand({
        TableName: PRODUCTVENDORS_TABLE,
        IndexName: "ProductIdIndex",
        KeyConditionExpression: "productId = :productId",
        ExpressionAttributeValues: { ":productId": getResult.Item.productId },
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

async function deleteProductVendor(id) {
  await ddb.send(
    new DeleteCommand({ TableName: PRODUCTVENDORS_TABLE, Key: { id } }),
  );
  return { statusCode: 204, headers, body: "" };
}
