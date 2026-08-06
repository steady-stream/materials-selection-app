/**
 * Batch service for bulk fetching data from Lambda
 * Reduces API Gateway load by fetching multiple items in single requests
 */
import type { LineItemOption, Manufacturer, Product, Vendor } from "../types";
import apiClient from "./api";

/**
 * Fetch multiple manufacturers in one API call
 * @param ids - Array of manufacturer IDs
 * @returns Array of manufacturers (nulls where not found)
 */
export async function batchGetManufacturers(
  ids: string[],
): Promise<(Manufacturer | null)[]> {
  if (ids.length === 0) return [];

  try {
    const response = await apiClient.post("/batch/manufacturers", { ids });
    return response.data;
  } catch (error) {
    console.error("Batch get manufacturers failed:", error);
    throw error;
  }
}

/**
 * Fetch multiple vendors in one API call
 * @param ids - Array of vendor IDs
 * @returns Array of vendors (nulls where not found)
 */
export async function batchGetVendors(
  ids: string[],
): Promise<(Vendor | null)[]> {
  if (ids.length === 0) return [];

  try {
    const response = await apiClient.post("/batch/vendors", { ids });
    return response.data;
  } catch (error) {
    console.error("Batch get vendors failed:", error);
    throw error;
  }
}

/**
 * Fetch multiple products in one API call
 * @param ids - Array of product IDs
 * @returns Array of products (nulls where not found)
 */
export async function batchGetProducts(
  ids: string[],
): Promise<(Product | null)[]> {
  if (ids.length === 0) return [];

  try {
    const response = await apiClient.post("/batch/products", { ids });
    return response.data;
  } catch (error) {
    console.error("Batch get products failed:", error);
    throw error;
  }
}

/**
 * Fetch multiple line item options in one API call
 * @param ids - Array of line item option IDs
 * @returns Array of options (nulls where not found)
 */
export async function batchGetLineItemOptions(
  ids: string[],
): Promise<(LineItemOption | null)[]> {
  if (ids.length === 0) return [];

  try {
    const response = await apiClient.post("/batch/lineitem-options", { ids });
    return response.data;
  } catch (error) {
    console.error("Batch get lineitem options failed:", error);
    throw error;
  }
}

/**
 * Fetch line item options for multiple line items in one API call
 * Dramatically reduces concurrency by grouping all option queries
 * @param lineItemIds - Array of line item IDs
 * @returns Object with lineItemId as key and array of options as value
 */
export async function batchGetLineItemOptionsByLineItemIds(
  lineItemIds: string[],
): Promise<Record<string, LineItemOption[]>> {
  if (lineItemIds.length === 0) return {};

  try {
    const response = await apiClient.post(
      "/batch/lineitem-options/by-lineitem-ids",
      { lineItemIds },
    );
    return response.data;
  } catch (error) {
    console.error("Batch get lineitem options by lineitem ids failed:", error);
    throw error;
  }
}
