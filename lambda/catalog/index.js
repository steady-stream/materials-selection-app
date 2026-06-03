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
const PRODUCT_VARIATIONS_TABLE = "MaterialsSelection-ProductVariations";
const PRODUCTVENDORS_TABLE = "MaterialsSelection-ProductVendors";

const MODEL_STEM_VARIATION_TOKENS = new Set([
  "CP",
  "BL",
  "BN",
  "SN",
  "MB",
  "PB",
  "ORB",
  "NI",
  "CHROME",
  "BLACK",
  "MATTE",
  "POLISHED",
  "BRUSHED",
  "SATIN",
  "NICKEL",
  "BRONZE",
]);

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
    if (path.match(/^\/products\/[^/]+\/variations$/) && method === "GET") {
      return await getProductVariations(path.split("/")[2]);
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

function normalizeTaxRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

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
    taxRate: normalizeTaxRate(data.taxRate),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: VENDORS_TABLE, Item: vendor }));
  return { statusCode: 201, headers, body: JSON.stringify(vendor) };
}

async function updateVendor(id, data) {
  const existing = await ddb.send(
    new GetCommand({ TableName: VENDORS_TABLE, Key: { id } }),
  );
  if (!existing.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Vendor not found" }),
    };
  }

  const vendor = {
    ...existing.Item,
    ...data,
    id,
    taxRate:
      data.taxRate !== undefined
        ? normalizeTaxRate(data.taxRate)
        : normalizeTaxRate(existing.Item.taxRate),
    updatedAt: new Date().toISOString(),
  };
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

function isMissingTableError(error) {
  return (
    error?.name === "ResourceNotFoundException" ||
    String(error?.message || "").includes("Requested resource not found")
  );
}

function normalizeModelStem(rawModelNumber) {
  const raw = String(rawModelNumber || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";

  const tokens = raw
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((token) => !MODEL_STEM_VARIATION_TOKENS.has(token));

  const stem = tokens.join("");
  return stem || raw.replace(/[^A-Z0-9]/g, "");
}

function normalizeTextForKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildSyntheticVariation(product) {
  const modelNumber = (product.modelNumber || "").trim();
  return {
    id: `synthetic-${product.id}`,
    productId: product.id,
    modelNumber: modelNumber || null,
    effectiveModelNumber: modelNumber,
    color: product.color || null,
    finish: product.finish || null,
    imageUrl: product.imageUrl || null,
    sortOrder: 1,
    isDefault: true,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function ensureVariationConstraints(variations) {
  if (!variations.length) {
    throw new Error("At least one variation is required");
  }

  if (variations.length > 1) {
    for (const variation of variations) {
      if (!variation.color && !variation.finish) {
        throw new Error(
          "When multiple variations exist, each variation must have color and/or finish",
        );
      }
    }
  }

  const modelSet = new Set();
  const comboSet = new Set();

  for (const variation of variations) {
    const effectiveModel = String(variation.effectiveModelNumber || "")
      .trim()
      .toUpperCase();
    if (effectiveModel) {
      if (modelSet.has(effectiveModel)) {
        throw new Error(
          `Duplicate variation model number within product: ${effectiveModel}`,
        );
      }
      modelSet.add(effectiveModel);
    }

    const comboKey = `${normalizeTextForKey(variation.color)}|${normalizeTextForKey(variation.finish)}`;
    if (comboSet.has(comboKey)) {
      throw new Error("Duplicate color/finish variation within product");
    }
    comboSet.add(comboKey);
  }
}

function normalizeVariationPayloads(product, variationInputs) {
  const baseModel = String(product.modelNumber || "").trim();
  const source =
    Array.isArray(variationInputs) && variationInputs.length > 0
      ? variationInputs
      : [
          {
            modelNumber: baseModel,
            color: product.color || null,
            finish: product.finish || null,
            imageUrl: product.imageUrl || null,
          },
        ];

  const normalized = source.map((variation, index) => {
    const explicitModel = String(variation.modelNumber || "").trim();
    const effectiveModelNumber = explicitModel || baseModel;
    return {
      id: variation.id,
      productId: product.id,
      modelNumber: explicitModel || null,
      effectiveModelNumber,
      color: variation.color ? String(variation.color).trim() : null,
      finish: variation.finish ? String(variation.finish).trim() : null,
      imageUrl: variation.imageUrl ? String(variation.imageUrl).trim() : null,
      sortOrder: index + 1,
      isDefault: index === 0,
    };
  });

  ensureVariationConstraints(normalized);
  return normalized;
}

async function getProductVariationsByProductId(productId) {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: PRODUCT_VARIATIONS_TABLE,
        IndexName: "ProductIdIndex",
        KeyConditionExpression: "productId = :productId",
        ExpressionAttributeValues: { ":productId": productId },
      }),
    );
    return (result.Items || []).sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
}

async function saveProductVariations(product, variationInputs) {
  const existing = await getProductVariationsByProductId(product.id);
  const existingById = new Map(
    existing.map((variation) => [variation.id, variation]),
  );
  const now = new Date().toISOString();

  const normalized = normalizeVariationPayloads(product, variationInputs);
  const saved = normalized.map((variation) => {
    const existingVariation = variation.id
      ? existingById.get(variation.id)
      : null;
    const id = variation.id || randomUUID();
    return {
      ...variation,
      id,
      createdAt: existingVariation?.createdAt || now,
      updatedAt: now,
    };
  });

  for (const variation of existing) {
    await ddb.send(
      new DeleteCommand({
        TableName: PRODUCT_VARIATIONS_TABLE,
        Key: { id: variation.id },
      }),
    );
  }

  for (const variation of saved) {
    await ddb.send(
      new PutCommand({
        TableName: PRODUCT_VARIATIONS_TABLE,
        Item: variation,
      }),
    );
  }

  return saved;
}

async function hydrateProduct(product) {
  const variations = await getProductVariationsByProductId(product.id);
  const variationList =
    variations.length > 0 ? variations : [buildSyntheticVariation(product)];
  const defaultVariation =
    variationList.find((variation) => variation.isDefault) || variationList[0];

  return {
    ...product,
    // Keep the base model authoritative; variation effective models are carried on each variation row.
    modelNumber: product.modelNumber || null,
    color: defaultVariation?.color || null,
    finish: defaultVariation?.finish || null,
    imageUrl: defaultVariation?.imageUrl || null,
    variations: variationList,
  };
}

async function hydrateProducts(products) {
  return await Promise.all(
    (products || []).map((product) => hydrateProduct(product)),
  );
}

async function findDuplicateProductsByStem(
  manufacturerId,
  modelStem,
  excludeId,
) {
  if (!manufacturerId || !modelStem) return [];

  const result = await ddb.send(
    new QueryCommand({
      TableName: PRODUCTS_TABLE,
      IndexName: "ManufacturerIdIndex",
      KeyConditionExpression: "manufacturerId = :manufacturerId",
      ExpressionAttributeValues: { ":manufacturerId": manufacturerId },
    }),
  );

  return (result.Items || []).filter(
    (product) =>
      product.id !== excludeId &&
      String(product.modelStem || "") === String(modelStem),
  );
}

function duplicateWarningResponse(modelStem, duplicates) {
  return {
    statusCode: 409,
    headers,
    body: JSON.stringify({
      code: "DUPLICATE_PRODUCT_WARNING",
      message:
        "Possible duplicate product detected for this manufacturer. Override to continue.",
      modelStem,
      duplicates: duplicates.map((product) => ({
        id: product.id,
        name: product.name,
        modelNumber: product.modelNumber || null,
      })),
    }),
  };
}

async function getAllProducts() {
  const result = await ddb.send(new ScanCommand({ TableName: PRODUCTS_TABLE }));
  const hydrated = await hydrateProducts(result.Items || []);
  return { statusCode: 200, headers, body: JSON.stringify(hydrated) };
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
  const hydrated = await hydrateProducts(result.Items || []);
  return { statusCode: 200, headers, body: JSON.stringify(hydrated) };
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
  const hydrated = await hydrateProduct(result.Item);
  return { statusCode: 200, headers, body: JSON.stringify(hydrated) };
}

async function getProductVariations(productId) {
  const productResult = await ddb.send(
    new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id: productId } }),
  );
  if (!productResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Product not found" }),
    };
  }

  const variations = await getProductVariationsByProductId(productId);
  const payload =
    variations.length > 0
      ? variations
      : [buildSyntheticVariation(productResult.Item)];
  return { statusCode: 200, headers, body: JSON.stringify(payload) };
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
  const baseModelForStem =
    String(data.modelNumber || "").trim() ||
    String(data?.variations?.[0]?.modelNumber || "").trim();
  const modelStem = normalizeModelStem(baseModelForStem);

  if (!data.overrideDuplicate && modelStem) {
    const duplicates = await findDuplicateProductsByStem(
      data.manufacturerId,
      modelStem,
      undefined,
    );
    if (duplicates.length > 0) {
      return duplicateWarningResponse(modelStem, duplicates);
    }
  }

  const product = {
    id: randomUUID(),
    manufacturerId: data.manufacturerId,
    name: data.name,
    modelNumber: data.modelNumber || null,
    modelStem: modelStem || null,
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

  const savedVariations = await saveProductVariations(product, data.variations);
  const responseProduct = await hydrateProduct({
    ...product,
    variations: savedVariations,
  });
  return { statusCode: 201, headers, body: JSON.stringify(responseProduct) };
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

  const nextModelNumber =
    data.modelNumber !== undefined
      ? data.modelNumber
      : getResult.Item.modelNumber || "";
  const baseModelForStem =
    String(nextModelNumber || "").trim() ||
    String(data?.variations?.[0]?.modelNumber || "").trim();
  const modelStem = normalizeModelStem(baseModelForStem);

  if (!data.overrideDuplicate && modelStem) {
    const duplicates = await findDuplicateProductsByStem(
      data.manufacturerId || getResult.Item.manufacturerId,
      modelStem,
      id,
    );
    if (duplicates.length > 0) {
      return duplicateWarningResponse(modelStem, duplicates);
    }
  }

  const product = {
    ...getResult.Item,
    ...data,
    id,
    modelStem: modelStem || null,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));

  const savedVariations = await saveProductVariations(product, data.variations);
  const responseProduct = await hydrateProduct({
    ...product,
    variations: savedVariations,
  });
  return { statusCode: 200, headers, body: JSON.stringify(responseProduct) };
}

async function deleteProduct(id) {
  const variations = await getProductVariationsByProductId(id);
  for (const variation of variations) {
    await ddb.send(
      new DeleteCommand({
        TableName: PRODUCT_VARIATIONS_TABLE,
        Key: { id: variation.id },
      }),
    );
  }
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

  const variationSkus =
    data.variationSkus && typeof data.variationSkus === "object"
      ? Object.fromEntries(
          Object.entries(data.variationSkus).filter(
            ([variationId, sku]) => variationId && String(sku || "").trim(),
          ),
        )
      : undefined;

  const productVendor = {
    id: randomUUID(),
    productId: data.productId,
    vendorId: data.vendorId,
    cost: data.cost,
    sku: data.sku || null,
    variationSkus:
      variationSkus && Object.keys(variationSkus).length > 0
        ? variationSkus
        : undefined,
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

  const variationSkus =
    data.variationSkus && typeof data.variationSkus === "object"
      ? Object.fromEntries(
          Object.entries(data.variationSkus).filter(
            ([variationId, sku]) => variationId && String(sku || "").trim(),
          ),
        )
      : undefined;

  const productVendor = {
    ...getResult.Item,
    ...data,
    ...(data.variationSkus !== undefined && {
      variationSkus:
        variationSkus && Object.keys(variationSkus).length > 0
          ? variationSkus
          : undefined,
    }),
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
