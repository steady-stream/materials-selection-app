import type {
  OpportunityDetails,
  SalesforceOpportunity,
  SalesforceOpportunityFilters,
} from "../types";

// TODO: Update this to point to the new Salesforce Lambda API (separate from MaterialSelection-API)
// This will be a dedicated Lambda function for Salesforce integration
const SF_API_BASE_URL =
  import.meta.env.VITE_SF_API_URL ||
  "https://your-sf-api-url.execute-api.us-east-1.amazonaws.com/prod";

export const salesforceService = {
  /**
   * Fetch Salesforce Opportunities using server-side filters.
   */
  getOpportunities: async (
    filters: SalesforceOpportunityFilters = {},
  ): Promise<SalesforceOpportunity[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.selectionCoordinatorNeeded !== undefined) {
        queryParams.set(
          "selectionCoordinatorNeeded",
          String(filters.selectionCoordinatorNeeded),
        );
      }
      if (filters.stage?.trim()) {
        queryParams.set("stage", filters.stage.trim());
      }

      const opportunitiesUrl = `${SF_API_BASE_URL}/salesforce/opportunities${
        queryParams.toString() ? `?${queryParams.toString()}` : ""
      }`;

      console.log(
        "Fetching from:",
        opportunitiesUrl,
      );
      const response = await fetch(opportunitiesUrl);

      console.log("Response status:", response.status);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch opportunities: ${response.statusText}`,
        );
      }

      const data = await response.json();
      console.log("API response data:", data);
      console.log("Opportunities array:", data.opportunities);

      const opportunities = data.opportunities || [];
      if (!Array.isArray(opportunities)) {
        console.error("Opportunities is not an array:", opportunities);
        return [];
      }

      return opportunities;
    } catch (error) {
      console.error("Error fetching Salesforce opportunities:", error);
      throw error;
    }
  },

  /**
   * Fetch detailed information for a specific Opportunity
   * Includes Account (BillingAddress) and Contact information
   */
  getOpportunityDetails: async (
    opportunityId: string,
  ): Promise<OpportunityDetails> => {
    try {
      const response = await fetch(
        `${SF_API_BASE_URL}/salesforce/opportunities/${opportunityId}`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch opportunity details: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching Salesforce opportunity details:", error);
      throw error;
    }
  },
};
