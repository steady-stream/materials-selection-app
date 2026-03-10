const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = "MaterialsSelection-Categories";
const LINEITEMS_TABLE = "MaterialsSelection-LineItems";
const LINEITEMOPTIONS_TABLE = "MaterialsSelection-LineItemOptions";

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
    // Categories routes
    if (path.match(/^\/projects\/[^/]+\/categories$/) && method === "GET") {
      return await getCategoriesByProject(path.split("/")[2]);
    }
    if (path.match(/^\/categories\/[^/]+$/) && method === "GET") {
      return await getCategory(path.split("/")[2]);
    }
    if (path === "/categories" && method === "POST") {
      return await createCategory(JSON.parse(event.body));
    }
    if (path.match(/^\/categories\/[^/]+$/) && method === "PUT") {
      return await updateCategory(path.split("/")[2], JSON.parse(event.body));
    }
    if (path.match(/^\/categories\/[^/]+$/) && method === "DELETE") {
      return await deleteCategory(path.split("/")[2]);
    }

    // LineItems routes
    if (path.match(/^\/categories\/[^/]+\/lineitems$/) && method === "GET") {
      return await getLineItemsByCategory(path.split("/")[2]);
    }
    if (path.match(/^\/categories\/[^/]+\/lineitems$/) && method === "POST") {
      const categoryId = path.split("/")[2];
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
        categoryId,
        projectId: categoryResult.Item.projectId,
      };
      return await createLineItem(lineItemData);
    }
    if (path.match(/^\/projects\/[^/]+\/lineitems$/) && method === "GET") {
      return await getLineItemsByProject(path.split("/")[2]);
    }
    if (path.match(/^\/lineitems\/[^/]+$/) && method === "GET") {
      return await getLineItem(path.split("/")[2]);
    }
    if (path === "/lineitems" && method === "POST") {
      return await createLineItem(JSON.parse(event.body));
    }
    if (path.match(/^\/lineitems\/[^/]+$/) && method === "PUT") {
      return await updateLineItem(path.split("/")[2], JSON.parse(event.body));
    }
    if (path.match(/^\/lineitems\/[^/]+$/) && method === "DELETE") {
      return await deleteLineItem(path.split("/")[2]);
    }

    // LineItemOptions routes
    if (path === "/lineitem-options" && method === "GET") {
      return await getAllLineItemOptions();
    }
    if (path.match(/^\/lineitem-options\/[^/]+$/) && method === "GET") {
      return await getLineItemOption(path.split("/")[2]);
    }
    if (path.match(/^\/lineitems\/[^/]+\/options$/) && method === "GET") {
      return await getLineItemOptions(path.split("/")[2]);
    }
    if (path.match(/^\/lineitems\/[^/]+\/options$/) && method === "POST") {
      return await createLineItemOption(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path.match(/^\/lineitems\/[^/]+\/select-option$/) && method === "PUT") {
      return await selectLineItemOption(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path.match(/^\/lineitem-options\/[^/]+$/) && method === "PUT") {
      return await updateLineItemOption(
        path.split("/")[2],
        JSON.parse(event.body),
      );
    }
    if (path.match(/^\/lineitem-options\/[^/]+$/) && method === "DELETE") {
      return await deleteLineItemOption(path.split("/")[2]);
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

// ── Category functions ────────────────────────────────────────────────────────

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

// ── LineItem functions ────────────────────────────────────────────────────────

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
    totalCost,
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

  const setExpressions = [];
  const removeExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  setExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  const IMMUTABLE_FIELDS = [
    "id",
    "categoryId",
    "projectId",
    "createdAt",
    "updatedAt",
    "totalCost",
    "vendorName",
    "manufacturerName",
  ];

  Object.keys(data).forEach((key) => {
    if (IMMUTABLE_FIELDS.includes(key)) return;
    const attrName = `#${key}`;
    const attrValue = `:${key}`;
    if (data[key] !== null && data[key] !== undefined) {
      setExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = data[key];
    } else if (data[key] === null) {
      removeExpressions.push(attrName);
      expressionAttributeNames[attrName] = key;
    }
  });

  let updateExpression = "SET " + setExpressions.join(", ");
  if (removeExpressions.length > 0) {
    updateExpression += " REMOVE " + removeExpressions.join(", ");
  }

  // Recalculate totalCost if quantity or unitCost changed
  if (data.quantity !== undefined || data.unitCost !== undefined) {
    const newQuantity =
      data.quantity !== undefined ? data.quantity : existing.Item.quantity;
    const newUnitCost =
      data.unitCost !== undefined ? data.unitCost : existing.Item.unitCost;
    if (newQuantity !== undefined && newUnitCost !== undefined) {
      setExpressions.push("#totalCost = :totalCost");
      expressionAttributeNames["#totalCost"] = "totalCost";
      expressionAttributeValues[":totalCost"] = newQuantity * newUnitCost;
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

// ── LineItemOptions functions ─────────────────────────────────────────────────

async function getAllLineItemOptions() {
  const result = await ddb.send(
    new ScanCommand({ TableName: LINEITEMOPTIONS_TABLE }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function getLineItemOption(id) {
  const result = await ddb.send(
    new GetCommand({ TableName: LINEITEMOPTIONS_TABLE, Key: { id } }),
  );
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "LineItemOption not found" }),
    };
  }
  return { statusCode: 200, headers, body: JSON.stringify(result.Item) };
}

async function getLineItemOptions(lineItemId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      IndexName: "lineItemId-index",
      KeyConditionExpression: "lineItemId = :lineItemId",
      ExpressionAttributeValues: { ":lineItemId": lineItemId },
    }),
  );
  return { statusCode: 200, headers, body: JSON.stringify(result.Items || []) };
}

async function createLineItemOption(lineItemId, data) {
  const option = {
    id: randomUUID(),
    lineItemId,
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
  return { statusCode: 200, headers, body: JSON.stringify(result.Attributes) };
}

async function selectLineItemOption(lineItemId, data) {
  const { productId, unitCost } = data;

  const queryResult = await ddb.send(
    new QueryCommand({
      TableName: LINEITEMOPTIONS_TABLE,
      IndexName: "lineItemId-index",
      KeyConditionExpression: "lineItemId = :lineItemId",
      ExpressionAttributeValues: { ":lineItemId": lineItemId },
    }),
  );
  const existingOptions = queryResult.Items || [];
  const matchingOption = existingOptions.find(
    (opt) => opt.productId === productId,
  );

  let selectedOption;
  if (matchingOption) {
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
    selectedOption = {
      id: randomUUID(),
      lineItemId,
      productId,
      unitCost,
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

  // Deselect all other options
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
