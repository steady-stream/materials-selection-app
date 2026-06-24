import type {
    CreateLineItemOptionRequest,
    LineItemOption,
    SelectLineItemOptionRequest,
    UpdateLineItemOptionRequest,
} from "../types";
import apiClient from "./api";

export const lineItemOptionService = {
  // Get all options for all line items in a project
  getByProjectId: async (projectId: string): Promise<LineItemOption[]> => {
    const response = await apiClient.get<LineItemOption[]>(
      `/projects/${projectId}/lineitem-options`,
    );
    return response.data;
  },

  // Get all options for a line item
  getByLineItemId: async (lineItemId: string): Promise<LineItemOption[]> => {
    const response = await apiClient.get<LineItemOption[]>(
      `/lineitems/${lineItemId}/options`,
    );
    return response.data;
  },

  // Create a new option for a line item
  create: async (
    lineItemId: string,
    data: CreateLineItemOptionRequest,
  ): Promise<LineItemOption> => {
    const response = await apiClient.post<{
      success: boolean;
      option: LineItemOption;
    }>(`/lineitems/${lineItemId}/options`, data);
    return response.data.option;
  },

  // Update an existing option
  update: async (
    optionId: string,
    data: UpdateLineItemOptionRequest,
  ): Promise<LineItemOption> => {
    const response = await apiClient.put<LineItemOption>(
      `/lineitem-options/${optionId}`,
      data,
    );
    return response.data;
  },

  // Select an option (marks it as selected, deselects others, syncs to LineItem)
  selectOption: async (
    lineItemId: string,
    data: SelectLineItemOptionRequest,
  ): Promise<LineItemOption> => {
    const response = await apiClient.put<{
      success: boolean;
      option: LineItemOption;
    }>(`/lineitems/${lineItemId}/select-option`, data);
    return response.data.option;
  },

  // Delete an option
  delete: async (optionId: string): Promise<void> => {
    await apiClient.delete(`/lineitem-options/${optionId}`);
  },
};
