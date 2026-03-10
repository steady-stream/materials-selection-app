const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = "MaterialsSelection-Orders";
const ORDERITEMS_TABLE = "MaterialsSelection-OrderItems";
const RECEIPTS_TABLE = "MaterialsSelection-Receipts";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Orders routes
    if (path.match(/^\/projects\/[^/]+\/orders$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getOrdersByProject(projectId);
    }

    if (path === "/orders" && method === "POST") {
      return await createOrder(JSON.parse(event.body));
    }

    if (path.match(/^\/orders\/[^/]+$/) && method === "PUT") {
      const id = path.split("/")[2];
      return await updateOrder(id, JSON.parse(event.body));
    }

    if (path.match(/^\/orders\/[^/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteOrder(id);
    }

    // OrderItems routes
    if (path.match(/^\/orders\/[^/]+\/items$/) && method === "GET") {
      const orderId = path.split("/")[2];
      return await getOrderItemsByOrder(orderId);
    }

    if (path.match(/^\/projects\/[^/]+\/orderitems$/) && method === "GET") {
      const projectId = path.split("/")[2];
      return await getOrderItemsByProject(projectId);
    }

    if (path === "/orderitems" && method === "POST") {
      return await createOrderItems(JSON.parse(event.body));
    }

    if (path.match(/^\/orderitems\/[^/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteOrderItem(id);
    }

    // Receipts routes
    if (path.match(/^\/orders\/[^/]+\/receipts$/) && method === "GET") {
      const orderId = path.split("/")[2];
      return await getReceiptsByOrder(orderId);
    }

    if (path === "/receipts" && method === "POST") {
      return await createReceipts(JSON.parse(event.body));
    }

    if (path.match(/^\/receipts\/[^/]+$/) && method === "DELETE") {
      const id = path.split("/")[2];
      return await deleteReceipt(id);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Route not found" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};

// --- Orders ---

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
  // Cascade: delete all order items (and their receipts) before deleting the order
  const orderItems = await ddb.send(
    new QueryCommand({
      TableName: ORDERITEMS_TABLE,
      IndexName: "OrderIndex",
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": id },
    }),
  );

  for (const item of orderItems.Items || []) {
    // Delete receipts associated with this order item
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

  await ddb.send(new DeleteCommand({ TableName: ORDERS_TABLE, Key: { id } }));
  return { statusCode: 204, headers, body: "" };
}

// --- Order Items ---

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

// --- Receipts ---

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
