const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
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

// Knowledge Base ID for document queries
const KNOWLEDGE_BASE_ID = "WWMDUQTZJZ";

const PROJECTS_TABLE = "MaterialsSelection-Projects";
const CATEGORIES_TABLE = "MaterialsSelection-Categories";
const LINEITEMS_TABLE = "MaterialsSelection-LineItems";
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
  const method = event.httpMethod;
  const path = event.path;

  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
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

// --- AI Functions ---

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
        citations,
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

// Helper: batch-load entities by ID from DynamoDB, returns a Map keyed by ID
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
 * Scan AI response text for product name/model matches and return
 * suggested "addLineItem" actions for the UI (capped at 3).
 */
function extractProductActions(
  aiText,
  products,
  vendors,
  manufacturers,
  categories,
) {
  const actions = [];

  products.forEach((product) => {
    let mentioned = false;

    // Model number is more specific — check it first
    if (
      product.modelNumber &&
      aiText.toLowerCase().includes(product.modelNumber.toLowerCase())
    ) {
      mentioned = true;
    }

    // Fall back to product name, but skip very short names to avoid false positives
    if (
      !mentioned &&
      product.name &&
      product.name.length > 5 &&
      aiText.toLowerCase().includes(product.name.toLowerCase())
    ) {
      mentioned = true;
    }

    if (mentioned) {
      const vendor = vendors.find((v) => v.id === product.vendorId);
      const manufacturer = manufacturers.find(
        (m) => m.id === product.manufacturerId,
      );

      const vendorInfo = vendor ? ` from ${vendor.name}` : "";
      const priceInfo = product.unitCost > 0 ? ` ($${product.unitCost})` : "";

      actions.push({
        type: "addLineItem",
        label: `Add ${product.name}`,
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
          // categoryId will be selected by the user in the UI
        },
      });
    }
  });

  return actions.slice(0, 3);
}

async function chatWithProject(projectId, conversationMessages) {
  try {
    // Load project
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

    // Load categories and line items for this project
    const categoriesResult = await ddb.send(
      new ScanCommand({
        TableName: CATEGORIES_TABLE,
        FilterExpression: "projectId = :projectId",
        ExpressionAttributeValues: { ":projectId": projectId },
      }),
    );
    const categories = categoriesResult.Items || [];

    const lineItemsResult = await ddb.send(
      new QueryCommand({
        TableName: LINEITEMS_TABLE,
        IndexName: "ProjectIdIndex",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: { ":projectId": projectId },
      }),
    );
    const lineItems = lineItemsResult.Items || [];

    // Collect unique IDs referenced by line items
    const productIds = new Set();
    const manufacturerIds = new Set();
    const vendorIds = new Set();

    lineItems.forEach((item) => {
      if (item.productId) productIds.add(item.productId);
      if (item.manufacturerId) manufacturerIds.add(item.manufacturerId);
      if (item.vendorId) vendorIds.add(item.vendorId);
    });

    // Parallel load of referenced entities
    const [productsMap, manufacturersMap, vendorsMap] = await Promise.all([
      loadEntitiesById(PRODUCTS_TABLE, Array.from(productIds)),
      loadEntitiesById(MANUFACTURERS_TABLE, Array.from(manufacturerIds)),
      loadEntitiesById(VENDORS_TABLE, Array.from(vendorIds)),
    ]);

    // Calculate project-level rollup totals
    const totalProjectCost = lineItems.reduce(
      (sum, item) => sum + (item.totalCost || 0),
      0,
    );
    const totalCategoryAllowance = categories.reduce(
      (sum, cat) => sum + (cat.allowance || 0),
      0,
    );

    // Build rich context string for the system prompt
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

    // Load full product catalog + vendor data for action suggestion extraction
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

      // Enrich each product with its primary vendor's ID and cost
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
      // Non-fatal — action suggestions will just be empty
      console.warn("Failed to load all products/vendors:", error);
    }

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

    // Build conversation in Amazon Nova message format.
    // Inject the system prompt into the first user turn — Nova doesn't have a
    // dedicated system role at the message level.
    const messages = conversationMessages.map((msg, index) => {
      if (msg.role === "user") {
        const text =
          index === 0
            ? `${systemMessage}\n\nUser Question: ${msg.content}`
            : msg.content;
        return { role: "user", content: [{ text }] };
      }
      return { role: "assistant", content: [{ text: msg.content }] };
    });

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
