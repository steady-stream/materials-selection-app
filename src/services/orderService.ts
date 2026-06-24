import type { Order, OrderItem, Receipt } from "../types";
import apiClient from "./api";

export const orderService = {
  getByProjectId: async (projectId: string): Promise<Order[]> => {
    const response = await apiClient.get<Order[]>(
      `/projects/${projectId}/orders`,
    );
    return response.data;
  },

  create: async (
    order: Omit<Order, "id" | "createdAt" | "updatedAt">,
  ): Promise<Order> => {
    const response = await apiClient.post<Order>("/orders", order);
    return response.data;
  },

  update: async (id: string, data: Partial<Order>): Promise<Order> => {
    const response = await apiClient.put<Order>(`/orders/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/orders/${id}`);
  },

  // OrderItems
  getOrderItems: async (orderId: string): Promise<OrderItem[]> => {
    const response = await apiClient.get<OrderItem[]>(
      `/orders/${orderId}/items`,
    );
    return response.data;
  },

  getOrderItemsByProject: async (projectId: string): Promise<OrderItem[]> => {
    const response = await apiClient.get<OrderItem[]>(
      `/projects/${projectId}/orderitems`,
    );
    return response.data;
  },

  createOrderItems: async (
    items: Omit<OrderItem, "id" | "createdAt" | "updatedAt">[],
  ): Promise<OrderItem[]> => {
    const response = await apiClient.post<OrderItem[]>("/orderitems", items);
    return response.data;
  },

  deleteOrderItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/orderitems/${id}`);
  },

  // Receipts
  getReceipts: async (orderId: string): Promise<Receipt[]> => {
    const response = await apiClient.get<Receipt[]>(
      `/orders/${orderId}/receipts`,
    );
    return response.data;
  },

  getReceiptsByProject: async (projectId: string): Promise<Receipt[]> => {
    const response = await apiClient.get<Receipt[]>(
      `/projects/${projectId}/receipts`,
    );
    return response.data;
  },

  createReceipts: async (
    receipts: Omit<Receipt, "id" | "createdAt" | "updatedAt">[],
  ): Promise<Receipt[]> => {
    const response = await apiClient.post<Receipt[]>("/receipts", receipts);
    return response.data;
  },

  deleteReceipt: async (receiptId: string): Promise<void> => {
    await apiClient.delete(`/receipts/${receiptId}`);
  },
};
