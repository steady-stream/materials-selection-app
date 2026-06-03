/**
 * Salesforce Integration Lambda Function
 *
 * Provides integration with Salesforce to fetch Opportunity, Account, and Contact data
 * for creating projects from Salesforce Opportunities.
 *
 * Environment Variables Required:
 * - SF_CLIENT_ID: Salesforce OAuth client ID
 * - SF_CLIENT_SECRET: Salesforce OAuth client secret
 * - SF_USERNAME: Salesforce username
 * - SF_PASSWORD: Salesforce password (includes security token)
 * - SF_AUTH_URL: Salesforce OAuth token endpoint
 * - SF_INSTANCE_URL: Salesforce instance URL
 */

const fetch = require("node-fetch");

// Cache for OAuth token
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get Salesforce OAuth access token using password grant flow
 */
async function getSalesforceToken() {
  // Return cached token if still valid
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const {
    SF_CLIENT_ID,
    SF_CLIENT_SECRET,
    SF_USERNAME,
    SF_PASSWORD,
    SF_AUTH_URL,
  } = process.env;

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password: SF_PASSWORD,
  });

  try {
    const response = await fetch(SF_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;

    // Set expiry to 5 minutes before actual expiration (default is 2 hours)
    tokenExpiry = now + ((data.expires_in || 7200) - 300) * 1000;

    return cachedToken;
  } catch (error) {
    console.error("Salesforce OAuth error:", error);
    throw error;
  }
}

/**
 * Execute a SOQL query against Salesforce
 */
async function querySalesforce(query) {
  const token = await getSalesforceToken();
  const instanceUrl = process.env.SF_INSTANCE_URL;

  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SOQL query failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.records;
  } catch (error) {
    console.error("Salesforce query error:", error);
    throw error;
  }
}

function escapeSoqlString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

/**
 * Get Opportunities using optional server-side filters.
 */
async function getOpportunities(filters = {}) {
  const whereClauses = [];

  if (filters.selectionCoordinatorNeeded === true) {
    whereClauses.push("Selection_Coordinator_Needed__c = true");
  }

  if (filters.stage) {
    whereClauses.push(
      `StageName LIKE '%${escapeSoqlString(filters.stage)}%'`,
    );
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    SELECT Id, Name, StageName, AccountId, OCR_LU_PrimaryContact__c, Selection_Coordinator_Needed__c
    FROM Opportunity
    ${whereSql}
    ORDER BY Name ASC
  `;

  const opportunities = await querySalesforce(query);
  return opportunities;
}

/**
 * Get detailed information for a specific Opportunity including Account and Contact
 */
async function getOpportunityDetails(opportunityId) {
  // First, get the Opportunity record
  const opportunityQuery = `
    SELECT Id, Name, StageName, AccountId, OCR_LU_PrimaryContact__c, Selection_Coordinator_Needed__c
    FROM Opportunity
    WHERE Id = '${opportunityId}'
  `;

  const opportunities = await querySalesforce(opportunityQuery);

  if (!opportunities || opportunities.length === 0) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  const opportunity = opportunities[0];

  // Get Account billing address
  const accountQuery = `
    SELECT Id, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry
    FROM Account
    WHERE Id = '${opportunity.AccountId}'
  `;

  const accounts = await querySalesforce(accountQuery);
  const account = accounts && accounts.length > 0 ? accounts[0] : {};

  // Get Contact information
  const contactQuery = `
    SELECT Id, Name, Email, Phone, MobilePhone, Preferred_Method_of_Contact__c
    FROM Contact
    WHERE Id = '${opportunity.OCR_LU_PrimaryContact__c}'
  `;

  const contacts = await querySalesforce(contactQuery);
  const contact = contacts && contacts.length > 0 ? contacts[0] : {};

  return {
    opportunity,
    account,
    contact,
  };
}

/**
 * CORS headers for API responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;

    // GET /salesforce/opportunities - List all opportunities
    if (httpMethod === "GET" && path === "/salesforce/opportunities") {
      const selectionCoordinatorNeededParam =
        queryStringParameters?.selectionCoordinatorNeeded;
      const opportunities = await getOpportunities({
        selectionCoordinatorNeeded:
          selectionCoordinatorNeededParam === undefined
            ? true
            : selectionCoordinatorNeededParam === "true",
        stage: queryStringParameters?.stage?.trim() || undefined,
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ opportunities }),
      };
    }

    // GET /salesforce/opportunities/:id - Get opportunity details
    if (
      httpMethod === "GET" &&
      path.startsWith("/salesforce/opportunities/") &&
      pathParameters?.id
    ) {
      const opportunityId = pathParameters.id;
      const details = await getOpportunityDetails(opportunityId);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(details),
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Route not found" }),
    };
  } catch (error) {
    console.error("Lambda error:", error);

    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
