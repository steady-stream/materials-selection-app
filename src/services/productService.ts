import type {
    CreateProductRequest,
    Product,
    ProductVariation,
    UpdateProductRequest,
} from "../types";
import api from "./api";

export const productService = {
  async getAllProducts(): Promise<Product[]> {
    const response = await api.get<Product[]>("/products");
    return response.data;
  },

  async getProductsByManufacturer(manufacturerId: string): Promise<Product[]> {
    const response = await api.get<Product[]>(
      `/manufacturers/${manufacturerId}/products`,
    );
    return response.data;
  },

  async getProduct(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getVariations(productId: string): Promise<ProductVariation[]> {
    const response = await api.get<ProductVariation[]>(
      `/products/${productId}/variations`,
    );
    return response.data;
  },

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const response = await api.post<Product>("/products", data);
    return response.data;
  },

  async updateProduct(
    id: string,
    data: UpdateProductRequest,
  ): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
  },

  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },
};
