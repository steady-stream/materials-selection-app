export interface Project {
  id: string;
  name: string;
  description: string;
  projectNumber?: string;
  customerName?: string;
  address?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;
  estimatedStartDate?: string;
  type?:
    | "bath"
    | "kitchen"
    | "shower"
    | "roof"
    | "addition"
    | "renovation"
    | "flooring"
    | "deck"
    | "basement"
    | "other";
  status?: "planning" | "in-progress" | "on-hold" | "completed";
  createdAt: string;
  updatedAt: string;
  // SharePoint integration fields
  sharepointFolderId?: string;
  sharepointFolderName?: string;
  sharepointFolderUrl?: string;
  sharepointDriveId?: string;
  sharepointSiteId?: string;
  // Salesforce integration fields
  opportunityId?: string;
}

export interface Category {
  id: string;
  projectId: string;
  name: string;
  description: string;
  allowance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactInfo?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  manufacturerId: string;
  name: string;
  modelNumber?: string;
  description?: string;
  category?: string;
  unit?: string;
  tier?: "good" | "better" | "best";
  collection?: string;
  color?: string;
  finish?: string;
  imageUrl?: string;
  productUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  categoryId: string;
  projectId: string;
  name: string;
  material: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes?: string;
  // Enhanced tracking fields
  vendorId?: string;
  vendorName?: string;
  manufacturerId?: string;
  manufacturerName?: string;
  productId?: string;
  modelNumber?: string;
  allowance?: number;
  orderedDate?: string;
  receivedDate?: string;
  stagingLocation?: string;
  returnNotes?: string;
  status?:
    | "pending"
    | "selected"
    | "final"
    | "ordered"
    | "received"
    | "part recvd"
    | "installed";
  createdAt: string;
  updatedAt: string;
}

export interface LineItemOption {
  id: string;
  lineItemId: string;
  productId: string;
  unitCost: number;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLineItemOptionRequest {
  productId: string;
  unitCost: number;
  isSelected?: boolean;
}

export interface UpdateLineItemOptionRequest {
  unitCost?: number;
  isSelected?: boolean;
}

export interface SelectLineItemOptionRequest {
  productId: string;
  unitCost: number;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  projectNumber?: string;
  customerName?: string;
  address?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;
  estimatedStartDate?: string;
  type?:
    | "bath"
    | "kitchen"
    | "shower"
    | "roof"
    | "addition"
    | "renovation"
    | "flooring"
    | "deck"
    | "basement"
    | "other";
  status?: "planning" | "in-progress" | "on-hold" | "completed";
  opportunityId?: string; // Salesforce Opportunity ID
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  projectNumber?: string;
  customerName?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;
  address?: string;
  email?: string;
  phone?: string;
  estimatedStartDate?: string;
  type?:
    | "bath"
    | "kitchen"
    | "shower"
    | "roof"
    | "addition"
    | "renovation"
    | "flooring"
    | "deck"
    | "basement"
    | "other";
  status?: "planning" | "in-progress" | "on-hold" | "completed";
}

export interface CreateCategoryRequest {
  projectId: string;
  name: string;
  description: string;
  allowance?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  allowance?: number;
}

export interface CreateLineItemRequest {
  categoryId: string;
  projectId: string;
  name: string;
  material: string;
  quantity: number;
  unit: string;
  unitCost: number;
  notes?: string;
  vendorId?: string;
  manufacturerId?: string;
  productId?: string;
  modelNumber?: string;
  allowance?: number;
  orderedDate?: string;
  receivedDate?: string;
  stagingLocation?: string;
  returnNotes?: string;
  status?:
    | "pending"
    | "selected"
    | "final"
    | "ordered"
    | "received"
    | "part recvd"
    | "installed";
}

export interface UpdateLineItemRequest {
  name?: string;
  material?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  notes?: string;
  vendorId?: string | null;
  manufacturerId?: string | null;
  productId?: string | null;
  modelNumber?: string | null;
  allowance?: number;
  orderedDate?: string;
  receivedDate?: string;
  stagingLocation?: string;
  returnNotes?: string;
  status?:
    | "pending"
    | "selected"
    | "final"
    | "ordered"
    | "received"
    | "part recvd"
    | "installed";
}

export interface CreateVendorRequest {
  name: string;
  contactInfo?: string;
  website?: string;
}

export interface UpdateVendorRequest {
  name?: string;
  contactInfo?: string;
  website?: string;
}

export interface CreateManufacturerRequest {
  name: string;
  website?: string;
}

export interface UpdateManufacturerRequest {
  name?: string;
  website?: string;
}

export interface CreateProductRequest {
  manufacturerId: string;
  name: string;
  modelNumber?: string;
  description?: string;
  category?: string;
  unit?: string;
  tier?: "good" | "better" | "best";
  collection?: string;
  color?: string;
  finish?: string;
  imageUrl?: string;
  productUrl?: string;
}

export interface UpdateProductRequest {
  manufacturerId?: string;
  name?: string;
  modelNumber?: string;
  description?: string;
  category?: string;
  unit?: string;
  tier?: "good" | "better" | "best";
  collection?: string;
  color?: string;
  finish?: string;
  imageUrl?: string;
  productUrl?: string;
}

// Order tracking interfaces
export interface Order {
  id: string;
  projectId: string;
  vendorId: string;
  orderNumber: string;
  orderDate: string;
  notes?: string;
  status: "pending" | "placed" | "received" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  lineItemId: string;
  orderedQuantity: number;
  orderedPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  orderId: string;
  orderItemId: string;
  receivedQuantity: number;
  receivedDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVendor {
  id: string;
  productId: string;
  vendorId: string;
  cost: number;
  sku?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductVendorRequest {
  productId: string;
  vendorId: string;
  cost: number;
  sku?: string;
  isPrimary?: boolean;
}

export interface UpdateProductVendorRequest {
  cost?: number;
  sku?: string;
  isPrimary?: boolean;
}

// Salesforce integration types
export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  AccountId: string;
  OCR_LU_PrimaryContact__c: string;
  Selection_Coordinator_Needed__c: boolean;
}

export interface SalesforceAccount {
  Id: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
}

export interface SalesforceContact {
  Id: string;
  Name: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Preferred_Method_of_Contact__c?: string;
}

export interface OpportunityDetails {
  opportunity: SalesforceOpportunity;
  account: SalesforceAccount;
  contact: SalesforceContact;
}

// ---------------------------------------------------------------------------
// Project share / review
// ---------------------------------------------------------------------------

export interface ProjectShareStatus {
  active: boolean;
  expiresAt?: string;
  shareUrl?: string | null;
}

export interface ProjectShareCreated {
  shareUrl: string;
  pin?: string; // only present on first-time creation
  expiresAt: string;
  alreadyActive?: boolean;
}

// Aggregated review payload returned by GET /review/{token}?pin=...
export interface ReviewLineItem extends LineItem {
  category: Category | null;
  product: Product | null;
  manufacturer: Manufacturer | null;
  vendor: Vendor | null;
  options: Array<{
    option: LineItemOption;
    product: Product;
    manufacturer: Manufacturer | null;
    vendor: Vendor | null;
  }>;
}

export interface ReviewData {
  project: Project;
  categories: Category[];
  lineItems: ReviewLineItem[];
  expiresAt: string;
}
