import type {
    CreateProductVendorRequest,
    ProductVendor,
    UpdateProductVendorRequest,
} from "../types";
import api from "./api";

export const productVendorService = {
  async getAll(): Promise<ProductVendor[]> {
    const response = await api.get<ProductVendor[]>("/product-vendors");
    return response.data;
  },

  async getAllByProduct(productId: string): Promise<ProductVendor[]> {
    const response = await api.get<ProductVendor[]>(
      `/products/${productId}/vendors`,
    );
    return response.data;
  },

  async getById(id: string): Promise<ProductVendor> {
    const response = await api.get<ProductVendor>(`/product-vendors/${id}`);
    return response.data;
  },

  async getPrimaryVendor(productId: string): Promise<ProductVendor | null> {
    const vendors = await this.getAllByProduct(productId);
    return vendors.find((pv) => pv.isPrimary) || vendors[0] || null;
  },

  async create(data: CreateProductVendorRequest): Promise<ProductVendor> {
    const response = await api.post<ProductVendor>("/product-vendors", data);
    return response.data;
  },

  async update(
    id: string,
    data: UpdateProductVendorRequest,
  ): Promise<ProductVendor> {
    const response = await api.put<ProductVendor>(
      `/product-vendors/${id}`,
      data,
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/product-vendors/${id}`);
  },
};
