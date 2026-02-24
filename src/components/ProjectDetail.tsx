import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    categoryService,
    lineItemOptionService,
    lineItemService,
    manufacturerService,
    orderService,
    productService,
    productVendorService,
    projectService,
    vendorService,
} from "../services";
import { generateProjectPPTX } from "../services/pptxService";
import type {
    Category,
    CreateCategoryRequest,
    CreateLineItemRequest,
    LineItem,
    LineItemOption,
    Manufacturer,
    Order,
    OrderItem,
    Product,
    ProductVendor,
    Project,
    Receipt,
    Vendor,
} from "../types";
import { ChatAssistant } from "./ChatAssistant";
import { ChooseOptionsModal } from "./ChooseOptionsModal";
import DocumentManager from "./DocumentManager";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);

  /**
   * PRODUCT STATE - Critical for Vendor/Manufacturer/Product Coordination
   *
   * - products: Filtered display list (changes based on vendor/manufacturer selections)
   * - allProducts: Full unfiltered reference list (immutable, prevents circular filtering)
   *
   * Why two lists?
   * When user selects manufacturer, we filter products. But getFilteredManufacturers()
   * needs to see ALL products to determine which manufacturers are available for selected vendor.
   * Using filtered list would create circular dependency where selecting manufacturer
   * removes itself from the manufacturer dropdown.
   */
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Full unfiltered list

  const [loading, setLoading] = useState(true);
  const [showAddRow, setShowAddRow] = useState<string | null>(null); // categoryId
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editModalItemId, setEditModalItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [viewMode, setViewMode] = useState<"category" | "vendor">("category");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showOrderListModal, setShowOrderListModal] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCategoryLineItems, setExpandedCategoryLineItems] = useState<
    Set<string>
  >(new Set());
  const [receiveForm, setReceiveForm] = useState<{
    receivedDate: string;
    notes: string;
    items: Record<string, { qty: string; isPartial: boolean }>;
  }>({
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: {},
  });
  const [orderForm, setOrderForm] = useState<{
    orderNumber: string;
    orderDate: string;
    notes: string;
    items: { [lineItemId: string]: { qty: string; price: string } };
  }>({
    orderNumber: "",
    orderDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: {},
  });
  const [newCategory, setNewCategory] = useState<CreateCategoryRequest>({
    projectId: id || "",
    name: "",
    description: "",
    allowance: 0,
  });
  const [newItem, setNewItem] = useState<CreateLineItemRequest>({
    categoryId: "",
    projectId: id || "",
    name: "",
    material: "",
    quantity: 1,
    unit: "",
    unitCost: 0,
    notes: "",
    status: "pending",
  });
  const [showInsertProductModal, setShowInsertProductModal] = useState(false);
  const [selectingForLineItem, setSelectingForLineItem] =
    useState<LineItem | null>(null);
  const [productVendors, setProductVendors] = useState<ProductVendor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVendorId, setFilterVendorId] = useState<string>("");
  const [filterManufacturerId, setFilterManufacturerId] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterTier, setFilterTier] = useState({
    good: false,
    better: false,
    best: false,
  });
  const [filterCollection, setFilterCollection] = useState<string>("");
  const [selectedCategoryForInsert, setSelectedCategoryForInsert] =
    useState<string>("");
  const [insertQuantity, setInsertQuantity] = useState<number>(1);
  const [insertUnitCost, setInsertUnitCost] = useState<number>(0);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsForLineItem, setOptionsForLineItem] = useState<LineItem | null>(
    null,
  );
  const [allLineItemOptions, setAllLineItemOptions] = useState<
    LineItemOption[]
  >([]);

  useEffect(() => {
    if (id) {
      loadAllData(id);
    }
  }, [id]);

  const loadAllData = async (projectId: string) => {
    try {
      setLoading(true);
      const [
        projectData,
        categoriesData,
        lineItemsData,
        vendorsData,
        manufacturersData,
        productsData,
        ordersData,
        orderItemsData,
      ] = await Promise.all([
        projectService.getById(projectId),
        categoryService.getByProjectId(projectId),
        lineItemService.getByProjectId(projectId),
        vendorService.getAllVendors(),
        manufacturerService.getAllManufacturers(),
        productService.getAllProducts(),
        orderService.getByProjectId(projectId),
        orderService.getOrderItemsByProject(projectId),
      ]);

      // Load all product vendors
      const allProductVendors: ProductVendor[] = [];
      for (const product of productsData) {
        const pvs = await productVendorService.getAllByProduct(product.id);
        allProductVendors.push(...pvs);
      }
      setProductVendors(allProductVendors);

      // Load all line item options
      const allOptions: LineItemOption[] = [];
      for (const lineItem of lineItemsData) {
        const options = await lineItemOptionService.getByLineItemId(
          lineItem.id,
        );
        allOptions.push(...options);
      }
      setAllLineItemOptions(allOptions);
      setProject(projectData);
      setCategories(categoriesData);
      setLineItems(lineItemsData);
      setVendors(vendorsData);
      setManufacturers(manufacturersData);
      setProducts(productsData);
      setAllProducts(productsData); // Store full unfiltered list
      setOrders(ordersData);
      setOrderItems(orderItemsData);

      // Load receipts for all orders
      const allReceipts = await Promise.all(
        ordersData.map((order) => orderService.getReceipts(order.id)),
      );
      setReceipts(allReceipts.flat());

      // Auto-expand all sections
      const allIds = new Set<string>([
        ...categoriesData.map((c) => c.id),
        ...vendorsData
          .filter((v) => lineItemsData.some((item) => item.vendorId === v.id))
          .map((v) => v.id),
        "unassigned",
      ]);
      setExpandedSections(allIds);
    } catch (err) {
      console.error("Error loading project:", err);
      console.error("Project ID:", projectId);
      console.error(
        "Error details:",
        err instanceof Error ? err.message : String(err),
      );
      // Keep project as null to trigger "Project not found" message
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!editingProject) return;
    setSavingProject(true);
    try {
      const updated = await projectService.update(editingProject.id, {
        name: editingProject.name,
        description: editingProject.description,
        projectNumber: editingProject.projectNumber,
        customerName: editingProject.customerName,
        address: editingProject.address,
        email: editingProject.email,
        phone: editingProject.phone,
        mobilePhone: editingProject.mobilePhone,
        preferredContactMethod: editingProject.preferredContactMethod,
        estimatedStartDate: editingProject.estimatedStartDate,
        type: editingProject.type,
        status: editingProject.status,
      });
      setProject(updated);
      setShowProjectModal(false);
      setEditingProject(null);
    } catch (err) {
      alert("Failed to update project");
      console.error("Error updating project:", err);
    } finally {
      setSavingProject(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      alert("Please enter a section name");
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        const updated = await categoryService.update(
          editingCategory.id,
          newCategory,
        );
        setCategories(
          categories.map((c) => (c.id === editingCategory.id ? updated : c)),
        );
      } else {
        // Create new category
        const created = await categoryService.create(newCategory);
        setCategories([...categories, created]);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setNewCategory({
        projectId: id || "",
        name: "",
        description: "",
        allowance: 0,
      });
    } catch (err) {
      alert(`Failed to ${editingCategory ? "update" : "create"} section`);
      console.error(
        `Error ${editingCategory ? "updating" : "creating"} section:`,
        err,
      );
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;

    try {
      await categoryService.delete(categoryId);
      setCategories(categories.filter((c) => c.id !== categoryId));
      setLineItems(lineItems.filter((item) => item.categoryId !== categoryId));
    } catch (err) {
      alert("Failed to delete section");
      console.error("Error deleting section:", err);
    }
  };

  const handleAddLineItem = async (categoryId: string) => {
    if (!newItem.name) {
      alert("Please fill in item name");
      return;
    }

    try {
      const created = await lineItemService.create({
        ...newItem,
        categoryId,
        projectId: id!,
      });
      setLineItems([...lineItems, created]);
      setShowAddRow(null);
      setNewItem({
        categoryId: "",
        projectId: id || "",
        name: "",
        material: "",
        quantity: 1,
        unit: "",
        unitCost: 0,
        notes: "",
        status: "pending",
        vendorId: undefined,
        manufacturerId: undefined,
        productId: undefined,
        modelNumber: undefined,
      });
      // Reset products list to full list
      setProducts(allProducts);
    } catch (err) {
      alert("Failed to add line item");
      console.error("Error adding line item:", err);
    }
  };

  const handleDeleteLineItem = async (lineItemId: string) => {
    if (!confirm("Delete this line item?")) return;
    try {
      await lineItemService.delete(lineItemId);
      setLineItems(lineItems.filter((item) => item.id !== lineItemId));
    } catch (err) {
      alert("Failed to delete line item");
    }
  };

  const handleStartInlineEdit = (item: LineItem) => {
    setEditingItemId(item.id);
    setEditingItem({ ...item });
  };

  const handleCancelInlineEdit = () => {
    setEditingItemId(null);
    setEditingItem(null);
  };

  const handleSaveInlineEdit = async () => {
    if (!editingItem) return;
    try {
      const updated = await lineItemService.update(editingItem.id, editingItem);

      // Sync to LineItemOptions if product selected
      if (editingItem.productId) {
        await lineItemOptionService.selectOption(editingItem.id, {
          productId: editingItem.productId,
          unitCost: editingItem.unitCost,
        });
      }

      setLineItems(
        lineItems.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingItemId(null);
      setEditingItem(null);
    } catch (err) {
      alert("Failed to update line item");
      console.error("Error updating line item:", err);
    }
  };

  const handleStartModalEdit = (item: LineItem) => {
    setEditModalItemId(item.id);
    setEditingItem({ ...item });
  };

  const handleSaveModalEdit = async () => {
    if (!editingItem) return;
    try {
      const updated = await lineItemService.update(editingItem.id, editingItem);

      // Sync to LineItemOptions if product selected
      if (editingItem.productId) {
        await lineItemOptionService.selectOption(editingItem.id, {
          productId: editingItem.productId,
          unitCost: editingItem.unitCost,
        });
      }

      setLineItems(
        lineItems.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditModalItemId(null);
      setEditingItem(null);
    } catch (err) {
      alert("Failed to update line item");
      console.error("Error updating line item:", err);
    }
  };

  // =============================================================================
  // INLINE EDIT: VENDOR / MANUFACTURER / PRODUCT COORDINATION LOGIC
  // =============================================================================
  /**
   * Same cascading logic as Add Item, but for inline editing.
   * Only active when status is "pending" or "selected".
   * See detailed comments in Add Item section above for full explanation.
   */

  const handleEditItemVendorChange = async (vendorId: string) => {
    if (!editingItem) return;
    const vendor = vendorId || undefined;
    setEditingItem({ ...editingItem, vendorId: vendor });

    if (vendorId && editingItem.productId) {
      setProducts(allProducts);
      return;
    }

    if (vendorId) {
      const vendorProductIds = productVendors
        .filter((pv: ProductVendor) => pv.vendorId === vendorId)
        .map((pv: ProductVendor) => pv.productId);

      const allProductsList = await productService.getAllProducts();
      let filtered = allProductsList.filter((p) =>
        vendorProductIds.includes(p.id),
      );

      if (editingItem.manufacturerId) {
        filtered = filtered.filter(
          (p) => p.manufacturerId === editingItem.manufacturerId,
        );
      }

      setProducts(filtered);
    } else {
      if (editingItem.manufacturerId) {
        const filtered = await productService.getProductsByManufacturer(
          editingItem.manufacturerId,
        );
        setProducts(filtered);
      } else {
        const all = await productService.getAllProducts();
        setProducts(all);
      }
    }
  };

  const handleEditItemManufacturerChange = async (manufacturerId: string) => {
    if (!editingItem) return;
    const previousManufacturerId = editingItem.manufacturerId;
    const vendorAlreadySelected =
      editingItem.vendorId && !previousManufacturerId;

    if (vendorAlreadySelected && manufacturerId) {
      setEditingItem({
        ...editingItem,
        manufacturerId: manufacturerId || undefined,
      });

      const vendorProductIds = productVendors
        .filter((pv: ProductVendor) => pv.vendorId === editingItem.vendorId)
        .map((pv: ProductVendor) => pv.productId);

      const filtered = allProducts.filter(
        (p) =>
          p.manufacturerId === manufacturerId &&
          vendorProductIds.includes(p.id),
      );
      setProducts(filtered);
    } else {
      setEditingItem({
        ...editingItem,
        manufacturerId: manufacturerId || undefined,
        productId: undefined,
        vendorId: undefined,
        modelNumber: undefined,
        material: "",
        unit: "",
        unitCost: 0,
        name: "",
      });

      if (manufacturerId) {
        const allFiltered =
          await productService.getProductsByManufacturer(manufacturerId);
        setProducts(allFiltered);
      } else {
        const all = await productService.getAllProducts();
        setProducts(all);
      }
    }
  };

  const handleEditItemProductSelect = async (productId: string) => {
    if (!editingItem) return;
    const product = products.find((p) => p.id === productId);
    if (product) {
      const productVendorList = productVendors.filter(
        (pv: ProductVendor) => pv.productId === productId,
      );

      let selectedVendorId = editingItem.vendorId;
      let cost = 0;

      if (selectedVendorId) {
        const vendorCost = productVendors.find(
          (pv: ProductVendor) =>
            pv.productId === productId && pv.vendorId === selectedVendorId,
        );
        cost = vendorCost?.cost || 0;
      } else if (productVendorList.length >= 1) {
        const primaryVendor =
          productVendorList.find((pv) => pv.isPrimary) || productVendorList[0];
        selectedVendorId = primaryVendor.vendorId;
        cost = primaryVendor.cost;
      } else {
        selectedVendorId = undefined;
        cost = 0;
      }

      setEditingItem({
        ...editingItem,
        productId: product.id,
        manufacturerId: product.manufacturerId,
        modelNumber: product.modelNumber || undefined,
        material: product.description || "",
        unit: product.unit || "",
        vendorId: selectedVendorId,
        unitCost: cost,
        status: "selected",
      });

      setProducts(allProducts);
    }
  };

  const getEditFilteredManufacturers = () => {
    if (!editingItem) return manufacturers;

    if (editingItem.productId) {
      return manufacturers;
    }

    if (!editingItem.vendorId) {
      return manufacturers;
    }

    const vendorProductIds = productVendors
      .filter((pv: ProductVendor) => pv.vendorId === editingItem.vendorId)
      .map((pv: ProductVendor) => pv.productId);

    const manufacturerIds = new Set(
      allProducts
        .filter((p) => vendorProductIds.includes(p.id))
        .map((p) => p.manufacturerId)
        .filter((id) => id !== undefined),
    );

    return manufacturers.filter((m) => manufacturerIds.has(m.id));
  };

  const getEditFilteredVendors = () => {
    if (!editingItem) return vendors;

    if (editingItem.productId) {
      const vendorIds = new Set(
        productVendors
          .filter((pv: ProductVendor) => pv.productId === editingItem.productId)
          .map((pv: ProductVendor) => pv.vendorId),
      );
      return vendors.filter((v) => vendorIds.has(v.id));
    }

    if (editingItem.manufacturerId) {
      const manufacturerProductIds = allProducts
        .filter((p) => p.manufacturerId === editingItem.manufacturerId)
        .map((p) => p.id);

      const vendorIds = new Set(
        productVendors
          .filter((pv: ProductVendor) =>
            manufacturerProductIds.includes(pv.productId),
          )
          .map((pv: ProductVendor) => pv.vendorId),
      );

      return vendors.filter((v) => vendorIds.has(v.id));
    }

    return vendors;
  };

  // =============================================================================
  // VENDOR / MANUFACTURER / PRODUCT COORDINATION LOGIC
  // =============================================================================
  /**
   * Overview: Handles inline "Add Line Item" coordinated selection of Vendor,
   * Manufacturer, and Product fields. Supports three user workflows (scenarios)
   * while maintaining data integrity through product-vendor relationships.
   *
   * THREE SCENARIOS SUPPORTED:
   *
   * SCENARIO A: Product-First Selection
   *   - User selects Product first
   *   - Auto-populates: Manufacturer (from product), Vendor (primary or first)
   *   - Vendor list: Filtered to only vendors carrying this product
   *   - User can change vendor but only to valid options
   *
   * SCENARIO B: Manufacturer-First Selection
   *   - User selects Manufacturer first
   *   - Filters: Products to that manufacturer, Vendors to those carrying manufacturer's products
   *   - User selects Product → auto-selects primary vendor from filtered list
   *   - Changing manufacturer clears product/vendor (data integrity)
   *
   * SCENARIO C: Vendor-First Selection
   *   - User selects Vendor first
   *   - Filters: Manufacturers and Products to those carried by vendor
   *   - User selects Manufacturer → further filters products (KEEPS vendor)
   *   - User selects Product → all fields populated, vendor already set
   *
   * KEY ARCHITECTURAL DECISIONS:
   *
   * 1. Product-Vendor Relationship: 1-to-many
   *    - One product can be sold by multiple vendors at different prices
   *    - When product selected, vendor list ALWAYS filtered to valid vendors
   *
   * 2. Dual Product Lists (products vs allProducts):
   *    - products: Filtered display list (changes based on selections)
   *    - allProducts: Immutable full list (prevents circular filtering bugs)
   *
   * 3. Manufacturer Change Behavior:
   *    - If changing (one value → another): Clear all dependent fields
   *    - If selecting first time WITH vendor already set: Keep vendor (Scenario C)
   *
   * 4. Material Field: Read-only, populated from product.description
   *
   * 5. Reset on Save/Cancel: Clears all fields + resets products to allProducts
   *
   * TODO: Review Insert Product modal for similar coordination needs
   */

  /**
   * SCENARIO C: Vendor-First Selection Flow
   *
   * User selects Vendor → filters Manufacturer & Product lists → selects Manufacturer
   * → further filters Products → selects Product → all fields populated
   *
   * Key behaviors:
   * - Vendor selection filters products to those the vendor carries
   * - If manufacturer already selected, filters by BOTH vendor AND manufacturer
   * - If product already selected, expands to full list (allows changing vendor)
   * - Preserves vendor when manufacturer subsequently selected
   */
  const handleNewItemVendorChange = async (vendorId: string) => {
    const vendor = vendorId || undefined;
    setNewItem({ ...newItem, vendorId: vendor });

    // If product is already selected and we're now selecting a vendor, reset to full list
    if (vendorId && newItem.productId) {
      setProducts(allProducts);
      return;
    }

    // Filter products based on vendor selection
    if (vendorId) {
      // Get all products this vendor carries
      const vendorProductIds = productVendors
        .filter((pv: ProductVendor) => pv.vendorId === vendorId)
        .map((pv: ProductVendor) => pv.productId);

      const allProductsList = await productService.getAllProducts();
      let filtered = allProductsList.filter((p) =>
        vendorProductIds.includes(p.id),
      );

      // If manufacturer is also selected, filter further
      if (newItem.manufacturerId) {
        filtered = filtered.filter(
          (p) => p.manufacturerId === newItem.manufacturerId,
        );
      }

      setProducts(filtered);
    } else {
      // No vendor selected - show all products (or filter by manufacturer if selected)
      if (newItem.manufacturerId) {
        const filtered = await productService.getProductsByManufacturer(
          newItem.manufacturerId,
        );
        setProducts(filtered);
      } else {
        const all = await productService.getAllProducts();
        setProducts(all);
      }
    }
  };

  /**
   * SCENARIO B: Manufacturer-First Selection Flow
   * AND handles Scenario C when vendor was selected first
   *
   * Scenario B: User selects Manufacturer → filters Vendor & Product lists → selects Product
   * → auto-populates vendor (primary or first)
   *
   * Scenario C continuation: If vendor already selected (no prior manufacturer),
   * selecting manufacturer keeps vendor and filters products by BOTH.
   *
   * Key behaviors:
   * - Manufacturer change (one value to another) clears all dependent fields for data integrity
   * - Manufacturer first-time selection (with vendor already set) preserves vendor
   * - Manufacturer selection filters products to that manufacturer's products
   * - When manufacturer changed, clears product/vendor/material/unit/cost/name/modelNumber
   */
  const handleManufacturerChange = async (manufacturerId: string) => {
    const previousManufacturerId = newItem.manufacturerId;
    const vendorAlreadySelected = newItem.vendorId && !previousManufacturerId;

    if (vendorAlreadySelected && manufacturerId) {
      // Scenario C: Vendor selected first, now selecting manufacturer for first time
      // Keep vendor, just update manufacturer and filter products by BOTH
      setNewItem({
        ...newItem,
        manufacturerId: manufacturerId || undefined,
      });

      // Filter products by BOTH vendor AND manufacturer
      const vendorProductIds = productVendors
        .filter((pv: ProductVendor) => pv.vendorId === newItem.vendorId)
        .map((pv: ProductVendor) => pv.productId);

      const filtered = allProducts.filter(
        (p) =>
          p.manufacturerId === manufacturerId &&
          vendorProductIds.includes(p.id),
      );
      setProducts(filtered);
    } else {
      // Manufacturer being changed or selected without vendor - clear dependent fields
      setNewItem({
        ...newItem,
        manufacturerId: manufacturerId || undefined,
        productId: undefined,
        vendorId: undefined,
        modelNumber: undefined,
        material: "",
        unit: "",
        unitCost: 0,
        name: "",
      });

      // Filter products by manufacturer only
      if (manufacturerId) {
        const allFiltered =
          await productService.getProductsByManufacturer(manufacturerId);
        setProducts(allFiltered);
      } else {
        // No manufacturer - show all products
        const all = await productService.getAllProducts();
        setProducts(all);
      }
    }
  };

  /**
   * SCENARIO A: Product-First Selection Flow
   *
   * User selects Product → auto-populates Manufacturer & Vendor (primary)
   * → Vendor list filtered to product's vendors only
   *
   * Key behaviors:
   * - Auto-populates manufacturer from product
   * - If no vendor selected: auto-selects primary vendor (or first if no primary)
   * - If vendor already selected: uses that vendor's cost
   * - Always filters vendor list to only vendors carrying this product
   * - Populates material, unit, cost, name, modelNumber from product/vendor data
   * - Expands product list to full allProducts after selection
   *
   * Vendor count handling:
   * - 0 vendors: No vendor selected, cost = 0
   * - 1 vendor: Auto-select that vendor
   * - 2+ vendors: Auto-select primary (or first), keep list filtered to valid vendors
   */
  const handleProductSelect = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      // Get all vendors for this product
      const productVendorList = productVendors.filter(
        (pv: ProductVendor) => pv.productId === productId,
      );

      // Determine which vendor to use
      let selectedVendorId = newItem.vendorId;
      let cost = 0;

      if (selectedVendorId) {
        // Vendor already selected - get cost for that vendor
        const vendorCost = productVendors.find(
          (pv: ProductVendor) =>
            pv.productId === productId && pv.vendorId === selectedVendorId,
        );
        cost = vendorCost?.cost || 0;
      } else if (productVendorList.length >= 1) {
        // 1 or more vendors - auto-select primary vendor
        const primaryVendor =
          productVendorList.find((pv) => pv.isPrimary) || productVendorList[0];
        selectedVendorId = primaryVendor.vendorId;
        cost = primaryVendor.cost;
      } else {
        // No vendors - leave empty
        selectedVendorId = undefined;
        cost = 0;
      }

      setNewItem({
        ...newItem,
        productId: product.id,
        manufacturerId: product.manufacturerId,
        modelNumber: product.modelNumber || undefined,
        name: newItem.name.trim() ? newItem.name : product.name,
        material: product.description || "",
        unit: product.unit || "",
        vendorId: selectedVendorId,
        unitCost: cost,
      });

      // Reset products list to full (manufacturer list also goes to full via getFilteredManufacturers)
      setProducts(allProducts);
    }
  };

  const handleOpenSelectProduct = (item: LineItem) => {
    setSelectingForLineItem(item);
    setSelectedCategoryForInsert(item.categoryId);
    setInsertQuantity(item.quantity);
    setInsertUnitCost(0);
    setShowInsertProductModal(true);
  };

  const handleSelectProduct = async (product: Product) => {
    if (!selectingForLineItem) return;

    try {
      // Get primary vendor for this product
      const primaryVendor = await productVendorService.getPrimaryVendor(
        product.id,
      );

      const updatedItem = {
        ...selectingForLineItem,
        productId: product.id,
        manufacturerId: product.manufacturerId,
        modelNumber: product.modelNumber || undefined,
        material: product.description || "",
        unit: product.unit || "",
        vendorId: primaryVendor?.vendorId,
        unitCost:
          insertUnitCost > 0 ? insertUnitCost : primaryVendor?.cost || 0,
        quantity: insertQuantity,
        status: "selected" as const,
      };

      const updated = await lineItemService.update(
        selectingForLineItem.id,
        updatedItem,
      );

      // Sync to LineItemOptions
      await lineItemOptionService.selectOption(selectingForLineItem.id, {
        productId: product.id,
        unitCost:
          insertUnitCost > 0 ? insertUnitCost : primaryVendor?.cost || 0,
      });

      setLineItems(
        lineItems.map((item) => (item.id === updated.id ? updated : item)),
      );
      setShowInsertProductModal(false);
      setSelectingForLineItem(null);
      setSearchTerm("");
      setFilterVendorId("");
      setFilterManufacturerId("");
      setFilterCategory("");
      setFilterTier({ good: false, better: false, best: false });
      setFilterCollection("");
      setInsertQuantity(1);
      setInsertUnitCost(0);
    } catch (err) {
      alert("Failed to select product");
      console.error("Error selecting product:", err);
    }
  };

  const handleInsertProduct = async (product: Product) => {
    if (!selectedCategoryForInsert) {
      alert("Please select a category");
      return;
    }
    if (insertQuantity <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    try {
      // Get primary vendor for this product
      const primaryVendor = await productVendorService.getPrimaryVendor(
        product.id,
      );

      const newLineItem: CreateLineItemRequest = {
        categoryId: selectedCategoryForInsert,
        projectId: id!,
        name: product.name,
        material: product.description || "",
        quantity: insertQuantity,
        unit: product.unit || "ea",
        unitCost:
          insertUnitCost > 0 ? insertUnitCost : primaryVendor?.cost || 0,
        notes: product.modelNumber ? `Model: ${product.modelNumber}` : "",
        productId: product.id,
        manufacturerId: product.manufacturerId,
        vendorId: primaryVendor?.vendorId,
        modelNumber: product.modelNumber,
        status: "pending",
      };

      const created = await lineItemService.create(newLineItem);

      // Sync to LineItemOptions
      await lineItemOptionService.selectOption(created.id, {
        productId: product.id,
        unitCost:
          insertUnitCost > 0 ? insertUnitCost : primaryVendor?.cost || 0,
      });

      setLineItems([...lineItems, created]);
      setShowInsertProductModal(false);
      setSelectingForLineItem(null);
      setSearchTerm("");
      setFilterVendorId("");
      setFilterManufacturerId("");
      setFilterCategory("");
      setFilterTier({ good: false, better: false, best: false });
      setFilterCollection("");
      setInsertQuantity(1);
      setInsertUnitCost(0);
    } catch (err) {
      alert("Failed to insert product");
      console.error("Error inserting product:", err);
    }
  };

  const handleOpenOptionsModal = (lineItemId: string) => {
    const lineItem = lineItems.find((item) => item.id === lineItemId);
    if (lineItem) {
      setOptionsForLineItem(lineItem);
      setShowOptionsModal(true);
    }
  };

  const handleCloseOptionsModal = () => {
    setShowOptionsModal(false);
    setOptionsForLineItem(null);
  };

  // Check if a line item has unselected options
  const hasUnselectedOptions = (lineItemId: string): boolean => {
    const options = allLineItemOptions.filter(
      (opt) => opt.lineItemId === lineItemId,
    );
    return options.some((opt) => !opt.isSelected);
  };

  const handleOptionsChanged = async () => {
    // Reload line items to reflect any product selection changes
    if (id) {
      try {
        const updatedLineItems = await lineItemService.getByProjectId(id);
        setLineItems(updatedLineItems);

        // Reload all line item options
        const allOptions: LineItemOption[] = [];
        for (const lineItem of updatedLineItems) {
          const options = await lineItemOptionService.getByLineItemId(
            lineItem.id,
          );
          allOptions.push(...options);
        }
        setAllLineItemOptions(allOptions);
      } catch (error) {
        console.error("Error reloading line items:", error);
      }
    }
  };

  const getCategoryLineItems = (categoryId: string) => {
    return lineItems.filter((item) => item.categoryId === categoryId);
  };

  const getCategoryTotal = (categoryId: string) => {
    return getCategoryLineItems(categoryId).reduce(
      (sum, item) => sum + item.totalCost,
      0,
    );
  };

  const getCategoryActualTotal = (categoryId: string) => {
    const categoryLineItemIds = getCategoryLineItems(categoryId).map(
      (item) => item.id,
    );
    return orderItems
      .filter((oi) => categoryLineItemIds.includes(oi.lineItemId))
      .reduce((sum, oi) => sum + oi.orderedQuantity * oi.orderedPrice, 0);
  };

  const getVendorLineItems = (vendorId: string) => {
    return lineItems.filter((item) => item.vendorId === vendorId);
  };

  const getUnassignedLineItems = () => {
    return lineItems.filter((item) => !item.vendorId);
  };

  const getVendorTotal = (vendorId: string) => {
    return getVendorLineItems(vendorId).reduce(
      (sum, item) => sum + item.totalCost,
      0,
    );
  };

  const getActiveVendors = () => {
    const vendorIds = new Set(
      lineItems.filter((item) => item.vendorId).map((item) => item.vendorId),
    );
    return vendors.filter((v) => vendorIds.has(v.id));
  };

  /**
   * Filters manufacturer dropdown based on current selection state
   *
   * Priority rules:
   * 1. If product selected: Show ALL manufacturers (selection locked, allow exploration)
   * 2. If vendor selected (no product): Show only manufacturers whose products this vendor carries
   * 3. If neither selected: Show all manufacturers
   *
   * CRITICAL: Uses allProducts (not filtered products) to prevent circular filtering
   * where selecting a manufacturer would remove itself from the list.
   */
  /**
   * Filters manufacturer dropdown based on current selection state
   *
   * Priority rules:
   * 1. If product selected: Show ALL manufacturers (selection locked, allow exploration)
   * 2. If vendor selected (no product): Show only manufacturers whose products this vendor carries
   * 3. If neither selected: Show all manufacturers
   *
   * CRITICAL: Uses allProducts (not filtered products) to prevent circular filtering
   * where selecting a manufacturer would remove itself from the list.
   */
  const getFilteredManufacturers = () => {
    // If product is selected, show all manufacturers (selection is locked in)
    if (newItem.productId) {
      return manufacturers;
    }

    if (!newItem.vendorId) {
      // No vendor selected - show all manufacturers
      return manufacturers;
    }

    // Get all products this vendor carries
    const vendorProductIds = productVendors
      .filter((pv: ProductVendor) => pv.vendorId === newItem.vendorId)
      .map((pv: ProductVendor) => pv.productId);

    // Get unique manufacturer IDs from those products (use full product list)
    const manufacturerIds = new Set(
      allProducts
        .filter((p) => vendorProductIds.includes(p.id))
        .map((p) => p.manufacturerId)
        .filter((id) => id !== undefined),
    );

    // Return manufacturers that have products with this vendor
    return manufacturers.filter((m) => manufacturerIds.has(m.id));
  };

  /**
   * Filters vendor dropdown based on current selection state
   *
   * Priority rules:
   * 1. If product selected: ALWAYS show only vendors carrying this specific product
   *    - Ensures valid product-vendor relationship (product can have multiple vendors)
   *    - Even if vendor already selected, list stays filtered to valid options
   * 2. If manufacturer selected (no product): Show vendors carrying that manufacturer's products
   * 3. If neither selected: Show all vendors
   *
   * Product-Vendor Relationship:
   * - 1-to-many: One product can be sold by multiple vendors at different prices
   * - Must maintain data integrity by only showing valid vendor options
   */
  const getFilteredVendors = () => {
    // If product is selected - ALWAYS filter to vendors carrying this specific product
    // (regardless of whether vendor is selected or not)
    if (newItem.productId) {
      const vendorIds = new Set(
        productVendors
          .filter((pv: ProductVendor) => pv.productId === newItem.productId)
          .map((pv: ProductVendor) => pv.vendorId),
      );
      return vendors.filter((v) => vendorIds.has(v.id));
    }

    // If manufacturer selected (no product) - filter to vendors carrying that manufacturer's products
    if (newItem.manufacturerId) {
      const manufacturerProductIds = allProducts
        .filter((p) => p.manufacturerId === newItem.manufacturerId)
        .map((p) => p.id);

      const vendorIds = new Set(
        productVendors
          .filter((pv: ProductVendor) =>
            manufacturerProductIds.includes(pv.productId),
          )
          .map((pv: ProductVendor) => pv.vendorId),
      );

      return vendors.filter((v) => vendorIds.has(v.id));
    }

    // No manufacturer or product selected - show all vendors
    return vendors;
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleLineItemDetails = (lineItemId: string) => {
    const newExpanded = new Set(expandedLineItems);
    if (newExpanded.has(lineItemId)) {
      newExpanded.delete(lineItemId);
    } else {
      newExpanded.add(lineItemId);
    }
    setExpandedLineItems(newExpanded);
  };

  const toggleCategoryLineItemDetails = (lineItemId: string) => {
    const newExpanded = new Set(expandedCategoryLineItems);
    if (newExpanded.has(lineItemId)) {
      newExpanded.delete(lineItemId);
    } else {
      newExpanded.add(lineItemId);
    }
    setExpandedCategoryLineItems(newExpanded);
  };

  const handleOpenOrderModal = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setOrderForm({
      orderNumber: "",
      orderDate: new Date().toISOString().split("T")[0],
      notes: "",
      items: {},
    });
    setShowOrderModal(true);
  };

  const handleCreateOrder = async () => {
    if (!selectedVendorId || !id) return;
    if (!orderForm.orderNumber.trim()) {
      alert("Please enter an order number");
      return;
    }

    try {
      if (editingOrderId) {
        // Edit mode - update existing order
        const existingOrder = orders.find((o) => o.id === editingOrderId);
        if (!existingOrder) return;

        // Update order
        const updatedOrder = await orderService.update(editingOrderId, {
          ...existingOrder,
          orderNumber: orderForm.orderNumber,
          orderDate: orderForm.orderDate,
          notes: orderForm.notes,
        });

        // Delete existing order items
        const existingItems = orderItems.filter(
          (oi) => oi.orderId === editingOrderId,
        );
        await Promise.all(
          existingItems.map((item) => orderService.deleteOrderItem(item.id)),
        );

        // Create new order items
        const itemsToCreate: Omit<
          OrderItem,
          "id" | "createdAt" | "updatedAt"
        >[] = [];
        Object.entries(orderForm.items).forEach(([lineItemId, data]) => {
          if (data.qty && parseFloat(data.qty) > 0) {
            const lineItem = lineItems.find((li) => li.id === lineItemId);
            itemsToCreate.push({
              orderId: editingOrderId,
              lineItemId: lineItemId,
              orderedQuantity: parseFloat(data.qty),
              orderedPrice: parseFloat(
                data.price || lineItem?.unitCost.toString() || "0",
              ),
            });
          }
        });

        if (itemsToCreate.length === 0) {
          alert("Please enter order quantities for at least one item");
          return;
        }

        const newOrderItems =
          await orderService.createOrderItems(itemsToCreate);

        // Update state
        setOrders(
          orders.map((o) => (o.id === editingOrderId ? updatedOrder : o)),
        );
        setOrderItems([
          ...orderItems.filter((oi) => oi.orderId !== editingOrderId),
          ...newOrderItems,
        ]);

        setShowOrderModal(false);
        setSelectedVendorId(null);
        setEditingOrderId(null);
      } else {
        // Create mode - new order
        const newOrder = await orderService.create({
          projectId: id,
          vendorId: selectedVendorId,
          orderNumber: orderForm.orderNumber,
          orderDate: orderForm.orderDate,
          notes: orderForm.notes,
          status: "placed",
        });

        // Create order items for filled entries
        const itemsToCreate: Omit<
          OrderItem,
          "id" | "createdAt" | "updatedAt"
        >[] = [];
        Object.entries(orderForm.items).forEach(([lineItemId, data]) => {
          if (data.qty && parseFloat(data.qty) > 0) {
            const lineItem = lineItems.find((li) => li.id === lineItemId);
            itemsToCreate.push({
              orderId: newOrder.id,
              lineItemId: lineItemId,
              orderedQuantity: parseFloat(data.qty),
              orderedPrice: parseFloat(
                data.price || lineItem?.unitCost.toString() || "0",
              ),
            });
          }
        });

        if (itemsToCreate.length === 0) {
          alert("Please enter order quantities for at least one item");
          await orderService.delete(newOrder.id);
          return;
        }

        // Save order items to database
        const newOrderItems =
          await orderService.createOrderItems(itemsToCreate);

        // Update line item statuses to "ordered"
        const lineItemUpdates = itemsToCreate.map(async (item) => {
          const lineItem = lineItems.find((li) => li.id === item.lineItemId);
          if (lineItem) {
            return await lineItemService.update(item.lineItemId, {
              status: "ordered",
            });
          }
        });
        const updatedLineItems = await Promise.all(
          lineItemUpdates.filter(Boolean),
        );

        // Update line items in state
        setLineItems(
          lineItems.map((li) => {
            const updated = updatedLineItems.find((u) => u?.id === li.id);
            return updated || li;
          }),
        );

        // Update state
        setOrders([...orders, newOrder]);
        setOrderItems([...orderItems, ...newOrderItems]);

        // Close modal
        setShowOrderModal(false);
        setSelectedVendorId(null);
      }
    } catch (err) {
      console.error("Failed to save order:", err);
      alert("Failed to save order. Please try again.");
    }
  };

  const handleClearAllOrders = async () => {
    if (!id) return;
    if (
      !confirm(
        "Are you sure you want to delete all orders for this project? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      // Delete all orders (this will cascade delete order items and receipts)
      await Promise.all(orders.map((order) => orderService.delete(order.id)));

      // Clear state
      setOrders([]);
      setOrderItems([]);
    } catch (err) {
      console.error("Failed to clear orders:", err);
      alert("Failed to clear orders. Please try again.");
    }
  };

  const handleRecordReceipt = async () => {
    if (!selectedOrderId) return;

    try {
      const receiptsToCreate = Object.entries(receiveForm.items)
        .filter(([, data]) => data.qty && parseFloat(data.qty) > 0)
        .map(([orderItemId, data]) => ({
          orderId: selectedOrderId,
          orderItemId,
          receivedQuantity: parseFloat(data.qty),
          receivedDate: receiveForm.receivedDate,
          notes: receiveForm.notes,
        }));

      const newReceipts = await orderService.createReceipts(receiptsToCreate);

      setReceipts([...receipts, ...newReceipts]);

      const updatedLineItems = [...lineItems];
      const statusUpdates = [];
      for (const [orderItemId, data] of Object.entries(receiveForm.items)) {
        if (data.qty && parseFloat(data.qty) > 0) {
          const orderItem = orderItems.find((oi) => oi.id === orderItemId);
          if (orderItem) {
            const lineItem = updatedLineItems.find(
              (li) => li.id === orderItem.lineItemId,
            );
            if (lineItem) {
              const newStatus = data.isPartial ? "part recvd" : "received";
              lineItem.status = newStatus;
              statusUpdates.push(
                lineItemService.update(lineItem.id, { status: newStatus }),
              );
            }
          }
        }
      }
      await Promise.all(statusUpdates);
      setLineItems(updatedLineItems);

      setShowReceiveModal(false);
      setSelectedVendorId(null);
      setSelectedOrderId(null);
      setReceiveForm({
        receivedDate: new Date().toISOString().split("T")[0],
        notes: "",
        items: {},
      });
    } catch (err) {
      console.error("Failed to record receipt:", err);
      alert("Failed to record receipt. Please try again.");
    }
  };

  const handleClearAllReceipts = async () => {
    if (!id) return;
    if (
      !confirm(
        "Are you sure you want to delete all receipts for this project? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await Promise.all(
        receipts.map((receipt) => orderService.deleteReceipt(receipt.id)),
      );
      const updatedLineItems = lineItems.filter(
        (item) => item.status === "received" || item.status === "part recvd",
      );
      await Promise.all(
        updatedLineItems.map((item) =>
          lineItemService.update(item.id, { status: "ordered" }),
        ),
      );
      setReceipts([]);
      setLineItems(
        lineItems.map((item) =>
          item.status === "received" || item.status === "part recvd"
            ? { ...item, status: "ordered" }
            : item,
        ),
      );
    } catch (err) {
      console.error("Failed to clear receipts:", err);
      alert("Failed to clear receipts. Please try again.");
    }
  };

  const handleOpenReceiveModal = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setShowReceiveModal(true);
  };

  const handleShowOrderList = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setShowOrderListModal(true);
  };

  const handleEditOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Get order items for this order
    const items = orderItems.filter((oi) => oi.orderId === orderId);

    // Populate form
    setOrderForm({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      notes: order.notes || "",
      items: items.reduce(
        (acc, item) => {
          acc[item.lineItemId] = {
            qty: item.orderedQuantity.toString(),
            price: item.orderedPrice.toString(),
          };
          return acc;
        },
        {} as Record<string, { qty: string; price: string }>,
      ),
    });

    setEditingOrderId(orderId);
    setSelectedVendorId(order.vendorId);
    setShowOrderListModal(false);
    setShowOrderModal(true);
  };

  const getVendorOrders = (vendorId: string) => {
    return orders.filter((order) => order.vendorId === vendorId);
  };

  const getLineItemOrders = (lineItemId: string) => {
    const itemOrders = orderItems.filter((oi) => oi.lineItemId === lineItemId);
    return orders.filter((o) => itemOrders.some((oi) => oi.orderId === o.id));
  };

  const getOrderItemReceipts = (orderItemId: string) => {
    return receipts.filter((r) => r.orderItemId === orderItemId);
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!project)
    return <div className="text-center py-8">Project not found</div>;

  return (
    <div className="space-y-4">
      {/* Compact Project Header */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">
                {project.name}
              </h1>
              {project.estimatedStartDate && (
                <span className="text-xs text-gray-500">
                  Est. Start:{" "}
                  {new Date(project.estimatedStartDate).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {project.status && (
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full self-start ${
                    project.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : project.status === "in-progress"
                        ? "bg-blue-100 text-blue-800"
                        : project.status === "on-hold"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {project.status}
                </span>
              )}
              {project.type && (
                <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded self-start">
                  {project.type}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">{project.description}</p>
          </div>
          <div className="flex-1 min-w-0 px-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-gray-600">
              {project.customerName && (
                <div className="truncate">
                  <span className="font-medium">Customer:</span>{" "}
                  {project.customerName}
                </div>
              )}
              {project.address && (
                <div className="truncate">
                  <span className="font-medium">Address:</span>{" "}
                  {project.address}
                </div>
              )}
              {project.phone && (
                <div className="truncate">
                  <span className="font-medium">Phone:</span> {project.phone}
                </div>
              )}
              {project.email && (
                <div className="truncate">
                  <span className="font-medium">Email:</span> {project.email}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateProjectPPTX(project.id)}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                📊 Export PowerPoint
              </button>
              {project.sharepointFolderId && project.sharepointDriveId && (
                <button
                  onClick={() => setShowDocumentsModal(true)}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                >
                  📄 Documents
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowProjectModal(true);
                  setEditingProject(project);
                }}
                className="text-indigo-600 hover:text-indigo-900 text-xs"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
              >
                ➕ Section
              </button>
              <button
                onClick={() => {
                  setShowInsertProductModal(true);
                  setFilterVendorId("");
                  setFilterManufacturerId("");
                  setFilterCategory("");
                  setFilterTier({ good: false, better: false, best: false });
                  setFilterCollection("");
                  setSearchTerm("");
                  setSelectedCategoryForInsert(categories[0]?.id || "");
                  setInsertQuantity(1);
                  setInsertUnitCost(0);
                }}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                📦 Insert Product
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4 justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("category")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "category"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            By Section
          </button>
          <button
            onClick={() => setViewMode("vendor")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "vendor"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            By Vendor
          </button>
        </div>
        {orders.length > 0 && (
          <button
            onClick={handleClearAllOrders}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-900 border border-red-300 rounded hover:bg-red-50"
            title="Delete all orders for this project"
          >
            🗑️ Clear All Orders ({orders.length})
          </button>
        )}
        <button
          onClick={handleClearAllReceipts}
          disabled={receipts.length === 0}
          className={`px-3 py-1 text-sm border rounded ${
            receipts.length > 0
              ? "text-orange-600 hover:text-orange-900 border-orange-300 hover:bg-orange-50"
              : "text-gray-400 border-gray-200 cursor-not-allowed"
          }`}
          title={
            receipts.length > 0
              ? "Delete all receipts for this project"
              : "No receipts to delete"
          }
        >
          🗑️ Clear All Receipts ({receipts.length})
        </button>
      </div>

      {/* Spreadsheet-like Categories and Line Items */}
      {viewMode === "category" && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {categories.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No sections yet. Add one to get started!
            </p>
          ) : (
            categories.map((category) => {
              const isExpanded = expandedSections.has(category.id);
              return (
                <div key={category.id} className="border-b last:border-b-0">
                  {/* Category Header */}
                  <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSection(category.id)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                      <h3 className="text-sm font-semibold text-gray-700">
                        {category.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {category.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium text-gray-600">
                        Allowance: ${(category.allowance || 0).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded">
                        <span className="text-xs font-medium text-gray-600">
                          Est. Total: $
                          {getCategoryTotal(category.id).toFixed(2)}
                        </span>
                        <span className="text-xs font-medium text-gray-600">
                          Est. Variance:{" "}
                          <span
                            className={
                              getCategoryTotal(category.id) <=
                              (category.allowance || 0)
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {getCategoryTotal(category.id) <=
                            (category.allowance || 0)
                              ? "$"
                              : "-$"}
                            {Math.abs(
                              (category.allowance || 0) -
                                getCategoryTotal(category.id),
                            ).toFixed(2)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded">
                        <span className="text-xs font-medium text-gray-600">
                          Actual Total: $
                          {getCategoryActualTotal(category.id).toFixed(2)}
                        </span>
                        <span className="text-xs font-medium text-gray-600">
                          Actual Variance:{" "}
                          <span
                            className={
                              getCategoryActualTotal(category.id) <=
                              (category.allowance || 0)
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {getCategoryActualTotal(category.id) <=
                            (category.allowance || 0)
                              ? "$"
                              : "-$"}
                            {Math.abs(
                              (category.allowance || 0) -
                                getCategoryActualTotal(category.id),
                            ).toFixed(2)}
                          </span>
                        </span>
                      </div>
                      <div className="h-6 w-px bg-gray-300 mx-2"></div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setNewCategory({
                              projectId: category.projectId,
                              name: category.name,
                              description: category.description,
                              allowance: category.allowance || 0,
                            });
                            setShowCategoryModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-600 hover:text-red-900 text-xs"
                        >
                          Delete
                        </button>
                        {showAddRow !== category.id ? (
                          <button
                            onClick={() => setShowAddRow(category.id)}
                            className="text-purple-600 hover:text-purple-900 text-xs font-medium"
                          >
                            + Add Item
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowAddRow(null)}
                            className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                          >
                            Cancel Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  {isExpanded && (
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                            Item
                          </th>
                          <th className="px-2 py-1 text-right font-medium text-gray-600 w-12">
                            Qty
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-12">
                            Unit
                          </th>
                          <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                            Unit Cost
                          </th>
                          <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                            Allowance
                          </th>
                          <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                            Total
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-28 border-l-2 border-gray-300">
                            Vendor
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                            Mfr
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                            Product
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                            Model
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                            Material
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                            Status
                          </th>
                          <th className="px-2 py-1 text-center font-medium text-gray-600 w-12 bg-gray-100"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCategoryLineItems(category.id).map((item) => {
                          const isEditing = editingItemId === item.id;
                          if (isEditing && editingItem) {
                            const canEditProduct =
                              editingItem.status === "pending" ||
                              editingItem.status === "selected";
                            return (
                              <tr
                                key={item.id}
                                className="bg-blue-50 border-2 border-indigo-300"
                              >
                                <td className="px-2 py-1">
                                  {canEditProduct ? (
                                    <input
                                      type="text"
                                      value={editingItem.name}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          name: e.target.value,
                                        })
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                    />
                                  ) : (
                                    <span className="text-gray-600">
                                      {editingItem.name}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number"
                                    value={editingItem.quantity}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        quantity:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                  />
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {editingItem.unit}
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingItem.unitCost}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        unitCost:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingItem.allowance || 0}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        allowance:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                  />
                                </td>
                                <td className="px-2 py-1 text-right font-medium">
                                  $
                                  {(
                                    editingItem.quantity * editingItem.unitCost
                                  ).toFixed(2)}
                                </td>
                                <td className="px-2 py-1 border-l-2 border-gray-300">
                                  {canEditProduct ? (
                                    <select
                                      value={editingItem.vendorId || ""}
                                      onChange={(e) =>
                                        handleEditItemVendorChange(
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                    >
                                      <option value="">-</option>
                                      {getEditFilteredVendors().map((v) => (
                                        <option key={v.id} value={v.id}>
                                          {v.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-gray-600">
                                      {editingItem.vendorId
                                        ? vendors.find(
                                            (v) =>
                                              v.id === editingItem.vendorId,
                                          )?.name
                                        : "-"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  {canEditProduct ? (
                                    <select
                                      value={editingItem.manufacturerId || ""}
                                      onChange={(e) =>
                                        handleEditItemManufacturerChange(
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                    >
                                      <option value="">-</option>
                                      {getEditFilteredManufacturers().map(
                                        (m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.name}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  ) : (
                                    <span className="text-gray-600">
                                      {editingItem.manufacturerId
                                        ? manufacturers.find(
                                            (m) =>
                                              m.id ===
                                              editingItem.manufacturerId,
                                          )?.name
                                        : "-"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  {canEditProduct ? (
                                    <select
                                      value={editingItem.productId || ""}
                                      onChange={(e) =>
                                        handleEditItemProductSelect(
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                    >
                                      <option value="">-</option>
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}{" "}
                                          {p.modelNumber
                                            ? `(${p.modelNumber})`
                                            : ""}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-gray-600">
                                      {editingItem.productId
                                        ? products.find(
                                            (p) =>
                                              p.id === editingItem.productId,
                                          )?.name
                                        : "-"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {editingItem.modelNumber || "-"}
                                </td>
                                <td className="px-2 py-1 text-gray-600 bg-gray-50">
                                  {editingItem.material}
                                </td>
                                <td className="px-2 py-1">
                                  <select
                                    value={editingItem.status || "pending"}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        status: e.target.value as any,
                                      })
                                    }
                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="selected">Selected</option>
                                    <option value="final">Final</option>
                                    <option value="ordered">Ordered</option>
                                    <option value="received">Received</option>
                                    <option value="installed">Installed</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1 text-right space-x-1">
                                  <button
                                    onClick={handleSaveInlineEdit}
                                    className="text-green-600 hover:text-green-900 font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelInlineEdit}
                                    className="text-gray-600 hover:text-gray-900"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <>
                              <tr
                                key={item.id}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="px-2 py-1">{item.name}</td>
                                <td className="px-2 py-1 text-right">
                                  {item.quantity}
                                </td>
                                <td className="px-2 py-1">{item.unit}</td>
                                <td className="px-2 py-1 text-right">
                                  ${item.unitCost.toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-right">
                                  ${(item.allowance || 0).toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-right font-medium">
                                  ${item.totalCost.toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-gray-600 border-l-2 border-gray-300">
                                  {item.vendorId
                                    ? vendors.find(
                                        (v) => v.id === item.vendorId,
                                      )?.name
                                    : "-"}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {item.manufacturerId
                                    ? manufacturers.find(
                                        (m) => m.id === item.manufacturerId,
                                      )?.name
                                    : "-"}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {item.productId
                                    ? (() => {
                                        const product = products.find(
                                          (p) => p.id === item.productId,
                                        );
                                        if (!product) return "-";
                                        if (product.productUrl) {
                                          return (
                                            <a
                                              href={product.productUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-indigo-600 hover:text-indigo-900 underline"
                                            >
                                              {product.name}
                                            </a>
                                          );
                                        }
                                        return product.name;
                                      })()
                                    : "-"}
                                </td>
                                <td className="px-2 py-1 text-gray-600">
                                  {item.modelNumber || "-"}
                                </td>
                                <td
                                  className="px-2 py-1 text-gray-600 truncate max-w-[6rem]"
                                  title={item.material}
                                >
                                  {item.material}
                                </td>
                                <td className="px-2 py-1">
                                  <span
                                    className={`px-1 py-0.5 rounded text-xs ${
                                      item.status === "installed"
                                        ? "bg-green-100 text-green-700"
                                        : item.status === "ordered"
                                          ? "bg-blue-100 text-blue-700"
                                          : item.status === "received"
                                            ? "bg-purple-100 text-purple-700"
                                            : item.status === "final"
                                              ? "bg-teal-100 text-teal-700"
                                              : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {item.status || "pending"}
                                  </span>
                                  {getLineItemOrders(item.id).length > 0 && (
                                    <button
                                      onClick={() =>
                                        toggleCategoryLineItemDetails(item.id)
                                      }
                                      className="ml-1 text-blue-600 hover:text-blue-900"
                                      title="View order details"
                                    >
                                      {expandedCategoryLineItems.has(item.id)
                                        ? "🔽"
                                        : "📋"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleOpenOptionsModal(item.id)
                                    }
                                    className="ml-1 text-purple-600 hover:text-purple-900"
                                    title="Choose options (Good/Better/Best)"
                                  >
                                    {hasUnselectedOptions(item.id)
                                      ? "❓"
                                      : "⚙️"}
                                  </button>
                                  {(item.status === "pending" ||
                                    item.status === "selected") && (
                                    <button
                                      onClick={() =>
                                        handleOpenSelectProduct(item)
                                      }
                                      className="ml-1 text-green-600 hover:text-green-900"
                                      title="Select product"
                                    >
                                      📦
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleStartInlineEdit(item)}
                                    className="ml-1 text-indigo-600 hover:text-indigo-900"
                                    title="Edit inline"
                                  >
                                    ✏️
                                  </button>
                                </td>
                                <td className="px-2 py-1 text-center relative bg-gray-100">
                                  <button
                                    onClick={() =>
                                      setOpenActionMenu(
                                        openActionMenu === item.id
                                          ? null
                                          : item.id,
                                      )
                                    }
                                    className="text-lg font-bold text-gray-700 hover:text-gray-900"
                                  >
                                    ⋮
                                  </button>
                                  {openActionMenu === item.id && (
                                    <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                      <button
                                        onClick={() => {
                                          handleStartModalEdit(item);
                                          setOpenActionMenu(null);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-gray-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleOpenOptionsModal(item.id);
                                          setOpenActionMenu(null);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-xs text-purple-600 hover:bg-gray-50"
                                      >
                                        Options
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteLineItem(item.id);
                                          setOpenActionMenu(null);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {expandedCategoryLineItems.has(item.id) &&
                                getLineItemOrders(item.id).length > 0 && (
                                  <>
                                    {getLineItemOrders(item.id).map(
                                      (order, orderIndex, ordersArray) => {
                                        const orderItem = orderItems.find(
                                          (oi) =>
                                            oi.orderId === order.id &&
                                            oi.lineItemId === item.id,
                                        );
                                        const itemReceipts = orderItem
                                          ? getOrderItemReceipts(orderItem.id)
                                          : [];
                                        const orderTotal = orderItem
                                          ? orderItem.orderedQuantity *
                                            orderItem.orderedPrice
                                          : 0;

                                        // Calculate cumulative variance only for last order
                                        const isLastOrder =
                                          orderIndex === ordersArray.length - 1;
                                        const allOrderTotals =
                                          ordersArray.reduce((sum, o) => {
                                            const oi = orderItems.find(
                                              (oiItem) =>
                                                oiItem.orderId === o.id &&
                                                oiItem.lineItemId === item.id,
                                            );
                                            return (
                                              sum +
                                              (oi
                                                ? oi.orderedQuantity *
                                                  oi.orderedPrice
                                                : 0)
                                            );
                                          }, 0);
                                        const variance = isLastOrder
                                          ? (item.allowance || 0) -
                                            allOrderTotals
                                          : null;

                                        return (
                                          <React.Fragment
                                            key={`${item.id}-order-${order.id}`}
                                          >
                                            <tr className="text-xs">
                                              <td className="px-2 py-1"></td>
                                              <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                {orderItem?.orderedQuantity ||
                                                  ""}
                                              </td>
                                              <td className="px-2 py-1 text-left text-gray-600 bg-blue-50">
                                                {orderItem
                                                  ? item.unit || "-"
                                                  : ""}
                                              </td>
                                              <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                {orderItem
                                                  ? `$${orderItem.orderedPrice.toFixed(2)}`
                                                  : ""}
                                              </td>
                                              <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                {orderItem &&
                                                  variance !== null && (
                                                    <span
                                                      className={
                                                        variance >= 0
                                                          ? "text-green-600"
                                                          : "text-red-600"
                                                      }
                                                    >
                                                      {variance >= 0
                                                        ? "$"
                                                        : "-$"}
                                                      {Math.abs(
                                                        variance,
                                                      ).toFixed(2)}
                                                    </span>
                                                  )}
                                              </td>
                                              <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                {orderItem
                                                  ? `$${orderTotal.toFixed(2)}`
                                                  : ""}
                                              </td>
                                              <td
                                                colSpan={5}
                                                className="px-2 py-1 text-gray-700 bg-blue-50"
                                              >
                                                <span className="font-medium text-gray-600">
                                                  Order #{order.orderNumber} -{" "}
                                                  {new Date(
                                                    order.orderDate,
                                                  ).toLocaleDateString()}
                                                </span>
                                              </td>
                                              <td className="px-2 py-1 text-left text-gray-600 bg-blue-50"></td>
                                              <td className="px-2 py-1 bg-blue-50"></td>
                                            </tr>
                                            {itemReceipts.map((receipt) => (
                                              <tr
                                                key={`receipt-${receipt.id}`}
                                                className="text-xs"
                                              >
                                                <td className="px-2 py-1"></td>
                                                <td className="px-2 py-1 text-right text-gray-600 bg-green-50">
                                                  {receipt.receivedQuantity}
                                                </td>
                                                <td className="px-2 py-1 text-left text-gray-600 bg-green-50">
                                                  {item.unit || "-"}
                                                </td>
                                                <td className="px-2 py-1 bg-green-50"></td>
                                                <td className="px-2 py-1 bg-green-50"></td>
                                                <td className="px-2 py-1 bg-green-50"></td>
                                                <td
                                                  colSpan={5}
                                                  className="px-2 py-1 text-gray-700 bg-green-50"
                                                >
                                                  <span className="font-medium text-gray-600">
                                                    Received -{" "}
                                                    {new Date(
                                                      receipt.receivedDate,
                                                    ).toLocaleDateString()}
                                                  </span>
                                                </td>
                                                <td className="px-2 py-1 text-left text-gray-600 bg-green-50">
                                                  {receipt.notes || ""}
                                                </td>
                                                <td className="px-2 py-1 bg-green-50"></td>
                                              </tr>
                                            ))}
                                          </React.Fragment>
                                        );
                                      },
                                    )}
                                  </>
                                )}
                            </>
                          );
                        })}

                        {/* Inline Add Row */}
                        {showAddRow === category.id && (
                          <tr className="bg-yellow-50 border-2 border-purple-300">
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={newItem.name}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Item name"
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={newItem.quantity}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    quantity: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-gray-600">
                              {newItem.unit || "-"}
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                value={newItem.unitCost}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    unitCost: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                value={newItem.allowance || 0}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    allowance: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-right font-medium">
                              $
                              {(newItem.quantity * newItem.unitCost).toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-l-2 border-gray-300">
                              <select
                                value={newItem.vendorId || ""}
                                onChange={(e) =>
                                  handleNewItemVendorChange(e.target.value)
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                              >
                                <option value="">-</option>
                                {getFilteredVendors().map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={newItem.manufacturerId || ""}
                                onChange={(e) =>
                                  handleManufacturerChange(e.target.value)
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                              >
                                <option value="">-</option>
                                {getFilteredManufacturers().map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={newItem.productId || ""}
                                onChange={(e) =>
                                  handleProductSelect(e.target.value)
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                              >
                                <option value="">-</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}{" "}
                                    {p.modelNumber ? `(${p.modelNumber})` : ""}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-gray-600">
                              {newItem.modelNumber || "-"}
                            </td>
                            <td className="px-2 py-1 text-gray-600">
                              {newItem.material || "-"}
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={newItem.status}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    status: e.target.value as any,
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="selected">Selected</option>
                                <option value="final">Final</option>
                                <option value="ordered">Ordered</option>
                              </select>
                            </td>
                            <td className="px-2 py-1 text-right space-x-1">
                              <button
                                onClick={() => handleAddLineItem(category.id)}
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setShowAddRow(null);
                                  setNewItem({
                                    categoryId: "",
                                    projectId: id || "",
                                    name: "",
                                    material: "",
                                    quantity: 1,
                                    unit: "",
                                    unitCost: 0,
                                    notes: "",
                                    status: "pending",
                                    vendorId: undefined,
                                    manufacturerId: undefined,
                                    productId: undefined,
                                    modelNumber: undefined,
                                  });
                                  // Reset products list to full list
                                  setProducts(allProducts);
                                }}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        )}

                        {getCategoryLineItems(category.id).length === 0 &&
                          showAddRow !== category.id && (
                            <tr>
                              <td
                                colSpan={11}
                                className="px-2 py-4 text-center text-gray-400 text-xs"
                              >
                                No items yet. Click "+ Add Item" to create one.
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Vendor View */}
      {viewMode === "vendor" && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {lineItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No line items yet.</p>
          ) : (
            <>
              {/* No Vendor Selected Section - Always First */}
              {getUnassignedLineItems().length > 0 &&
                (() => {
                  const isExpanded = expandedSections.has("unassigned");
                  return (
                    <div className="border-b last:border-b-0">
                      <div className="bg-yellow-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleSection("unassigned")}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                          <h3 className="text-sm font-semibold text-gray-700">
                            No Vendor Selected
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">
                            Total: $
                            {getUnassignedLineItems()
                              .reduce((sum, item) => sum + item.totalCost, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {isExpanded && (
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                                Item
                              </th>
                              <th className="px-2 py-1 text-right font-medium text-gray-600 w-12">
                                Qty
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-12">
                                Unit
                              </th>
                              <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                                Unit Cost
                              </th>
                              <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                                Total
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-24 border-l-2 border-gray-300">
                                Mfr
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                                Product
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                                Model
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                                Material
                              </th>
                              <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                                Status
                              </th>
                              <th className="px-2 py-1 text-center font-medium text-gray-600 w-8 bg-gray-100"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {getUnassignedLineItems().map((item) => {
                              const isEditing = editingItemId === item.id;

                              if (isEditing && editingItem) {
                                const canEditProduct =
                                  editingItem.status === "pending" ||
                                  editingItem.status === "selected";
                                return (
                                  <tr
                                    key={item.id}
                                    className="bg-blue-50 border-2 border-indigo-300"
                                  >
                                    <td className="px-2 py-1">
                                      {canEditProduct ? (
                                        <input
                                          type="text"
                                          value={editingItem.name}
                                          onChange={(e) =>
                                            setEditingItem({
                                              ...editingItem,
                                              name: e.target.value,
                                            })
                                          }
                                          className="w-full px-1 py-0.5 border rounded text-xs"
                                        />
                                      ) : (
                                        <span className="text-gray-600">
                                          {editingItem.name}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={editingItem.quantity}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            quantity:
                                              parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-16 px-1 py-0.5 border rounded text-xs text-right"
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-gray-600">
                                      {editingItem.unit}
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={editingItem.unitCost}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            unitCost:
                                              parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-20 px-1 py-0.5 border rounded text-xs text-right"
                                        step="0.01"
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-right font-medium">
                                      $
                                      {(
                                        editingItem.quantity *
                                        editingItem.unitCost
                                      ).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 border-l-2 border-gray-300">
                                      {canEditProduct ? (
                                        <select
                                          value={
                                            editingItem.manufacturerId || ""
                                          }
                                          onChange={(e) =>
                                            handleEditItemManufacturerChange(
                                              e.target.value,
                                            )
                                          }
                                          className="w-full px-1 py-0.5 border rounded text-xs"
                                        >
                                          <option value="">-</option>
                                          {getEditFilteredManufacturers().map(
                                            (m) => (
                                              <option key={m.id} value={m.id}>
                                                {m.name}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      ) : (
                                        <span className="text-gray-600">
                                          {editingItem.manufacturerId
                                            ? manufacturers.find(
                                                (m) =>
                                                  m.id ===
                                                  editingItem.manufacturerId,
                                              )?.name
                                            : "-"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1">
                                      {canEditProduct ? (
                                        <select
                                          value={editingItem.productId || ""}
                                          onChange={(e) =>
                                            handleEditItemProductSelect(
                                              e.target.value,
                                            )
                                          }
                                          className="w-full px-1 py-0.5 border rounded text-xs"
                                        >
                                          <option value="">-</option>
                                          {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.name}{" "}
                                              {p.modelNumber
                                                ? `(${p.modelNumber})`
                                                : ""}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-gray-600">
                                          {editingItem.productId
                                            ? products.find(
                                                (p) =>
                                                  p.id ===
                                                  editingItem.productId,
                                              )?.name
                                            : "-"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-gray-600">
                                      {editingItem.modelNumber || "-"}
                                    </td>
                                    <td className="px-2 py-1 text-gray-600 bg-gray-50">
                                      {editingItem.material}
                                    </td>
                                    <td className="px-2 py-1">
                                      <select
                                        value={editingItem.status || "pending"}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            status: e.target.value as any,
                                          })
                                        }
                                        className="px-1 py-0.5 border rounded text-xs"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="selected">
                                          Selected
                                        </option>
                                        <option value="final">Final</option>
                                        <option value="ordered">Ordered</option>
                                        <option value="received">
                                          Received
                                        </option>
                                        <option value="part recvd">
                                          Part Recvd
                                        </option>
                                        <option value="installed">
                                          Installed
                                        </option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1 text-right space-x-1">
                                      <button
                                        onClick={handleSaveInlineEdit}
                                        className="text-green-600 hover:text-green-900 font-medium"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelInlineEdit}
                                        className="text-gray-600 hover:text-gray-900"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr
                                  key={item.id}
                                  className="border-b border-gray-100 hover:bg-gray-50"
                                >
                                  <td className="px-2 py-1">{item.name}</td>
                                  <td className="px-2 py-1 text-right">
                                    {item.quantity}
                                  </td>
                                  <td className="px-2 py-1">{item.unit}</td>
                                  <td className="px-2 py-1 text-right">
                                    ${item.unitCost.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-medium">
                                    ${item.totalCost.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600 border-l-2 border-gray-300">
                                    {item.manufacturerId
                                      ? manufacturers.find(
                                          (m) => m.id === item.manufacturerId,
                                        )?.name
                                      : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {item.productId
                                      ? products.find(
                                          (p) => p.id === item.productId,
                                        )?.name
                                      : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {item.modelNumber || "-"}
                                  </td>
                                  <td
                                    className="px-2 py-1 text-gray-600 truncate max-w-[6rem]"
                                    title={item.material}
                                  >
                                    {item.material}
                                  </td>
                                  <td className="px-2 py-1">
                                    <span
                                      className={`px-1 py-0.5 rounded text-xs ${
                                        item.status === "installed"
                                          ? "bg-green-100 text-green-700"
                                          : item.status === "ordered"
                                            ? "bg-blue-100 text-blue-700"
                                            : item.status === "received"
                                              ? "bg-purple-100 text-purple-700"
                                              : item.status === "final"
                                                ? "bg-teal-100 text-teal-700"
                                                : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {item.status || "pending"}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleStartInlineEdit(item)
                                      }
                                      className="ml-1 text-indigo-600 hover:text-indigo-900"
                                      title="Edit inline"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleOpenOptionsModal(item.id)
                                      }
                                      className="ml-1 text-purple-600 hover:text-purple-900"
                                      title="Choose options (Good/Better/Best)"
                                    >
                                      {hasUnselectedOptions(item.id)
                                        ? "❓"
                                        : "⚙️"}
                                    </button>
                                  </td>
                                  <td className="px-2 py-1 text-center relative bg-gray-100">
                                    <button
                                      onClick={() =>
                                        setOpenActionMenu(
                                          openActionMenu === item.id
                                            ? null
                                            : item.id,
                                        )
                                      }
                                      className="text-lg font-bold text-gray-700 hover:text-gray-900"
                                    >
                                      ⋮
                                    </button>
                                    {openActionMenu === item.id && (
                                      <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                        <button
                                          onClick={() => {
                                            handleStartModalEdit(item);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-gray-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleOpenOptionsModal(item.id);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-purple-600 hover:bg-gray-50"
                                        >
                                          Options
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleDeleteLineItem(item.id);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}

              {/* Vendors with Line Items */}
              {getActiveVendors().map((vendor) => {
                const isExpanded = expandedSections.has(vendor.id);
                return (
                  <div key={vendor.id} className="border-b last:border-b-0">
                    {/* Vendor Header */}
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSection(vendor.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                        <h3 className="text-sm font-semibold text-gray-700">
                          {vendor.name}
                        </h3>
                        {getVendorOrders(vendor.id).length > 0 && (
                          <button
                            onClick={() => handleShowOrderList(vendor.id)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200 transition-colors cursor-pointer"
                            title="View orders for this vendor"
                          >
                            {getVendorOrders(vendor.id).length} order
                            {getVendorOrders(vendor.id).length > 1 ? "s" : ""}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-600">
                          Total: ${getVendorTotal(vendor.id).toFixed(2)}
                        </span>
                        <div className="h-6 w-px bg-gray-300 mx-2"></div>
                        <button
                          onClick={() => handleOpenOrderModal(vendor.id)}
                          className="text-indigo-600 hover:text-indigo-900 px-2 py-1 text-xs font-medium"
                          title="Create Order"
                        >
                          📦 Order
                        </button>
                        <button
                          onClick={() => handleOpenReceiveModal(vendor.id)}
                          className="text-green-600 hover:text-green-900 px-2 py-1 text-xs font-medium"
                          title="Receive Items"
                        >
                          ✓ Receive
                        </button>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    {isExpanded && (
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                              Item
                            </th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 w-12">
                              Qty
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-12">
                              Unit
                            </th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                              Unit Cost
                            </th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                              Allowance
                            </th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 w-20">
                              Total
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-24 border-l-2 border-gray-300">
                              Mfr
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                              Product
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                              Model
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-24">
                              Material
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 w-32">
                              Status
                            </th>
                            <th className="px-2 py-1 text-center font-medium text-gray-600 w-12 bg-gray-100"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {getVendorLineItems(vendor.id).map((item) => {
                            const isEditing = editingItemId === item.id;

                            if (isEditing && editingItem) {
                              const canEditProduct =
                                editingItem.status === "pending" ||
                                editingItem.status === "selected";
                              return (
                                <tr
                                  key={item.id}
                                  className="bg-blue-50 border-2 border-indigo-300"
                                >
                                  <td className="px-2 py-1">
                                    {canEditProduct ? (
                                      <input
                                        type="text"
                                        value={editingItem.name}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            name: e.target.value,
                                          })
                                        }
                                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                      />
                                    ) : (
                                      <span className="text-gray-600">
                                        {editingItem.name}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="number"
                                      value={editingItem.quantity}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          quantity:
                                            parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {editingItem.unit}
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingItem.unitCost}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          unitCost:
                                            parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingItem.allowance || 0}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          allowance:
                                            parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-right font-medium">
                                    $
                                    {(
                                      editingItem.quantity *
                                      editingItem.unitCost
                                    ).toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 border-l-2 border-gray-300">
                                    {canEditProduct ? (
                                      <select
                                        value={editingItem.manufacturerId || ""}
                                        onChange={(e) =>
                                          handleEditItemManufacturerChange(
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                      >
                                        <option value="">-</option>
                                        {getEditFilteredManufacturers().map(
                                          (m) => (
                                            <option key={m.id} value={m.id}>
                                              {m.name}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    ) : (
                                      <span className="text-gray-600">
                                        {editingItem.manufacturerId
                                          ? manufacturers.find(
                                              (m) =>
                                                m.id ===
                                                editingItem.manufacturerId,
                                            )?.name
                                          : "-"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    {canEditProduct ? (
                                      <select
                                        value={editingItem.productId || ""}
                                        onChange={(e) =>
                                          handleEditItemProductSelect(
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                      >
                                        <option value="">-</option>
                                        {products.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}{" "}
                                            {p.modelNumber
                                              ? `(${p.modelNumber})`
                                              : ""}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-gray-600">
                                        {editingItem.productId
                                          ? products.find(
                                              (p) =>
                                                p.id === editingItem.productId,
                                            )?.name
                                          : "-"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {editingItem.modelNumber || "-"}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600 bg-gray-50">
                                    {editingItem.material}
                                  </td>
                                  <td className="px-2 py-1">
                                    <select
                                      value={editingItem.status || "pending"}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          status: e.target.value as any,
                                        })
                                      }
                                      className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="selected">Selected</option>
                                      <option value="final">Final</option>
                                      <option value="ordered">Ordered</option>
                                      <option value="received">Received</option>
                                      <option value="installed">
                                        Installed
                                      </option>
                                    </select>
                                  </td>
                                  <td className="px-2 py-1 text-right space-x-1">
                                    <button
                                      onClick={handleSaveInlineEdit}
                                      className="text-green-600 hover:text-green-900 font-medium"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelInlineEdit}
                                      className="text-gray-600 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <>
                                <tr
                                  key={item.id}
                                  className="border-b border-gray-100 hover:bg-gray-50"
                                >
                                  <td className="px-2 py-1">{item.name}</td>
                                  <td className="px-2 py-1 text-right">
                                    {item.quantity}
                                  </td>
                                  <td className="px-2 py-1">{item.unit}</td>
                                  <td className="px-2 py-1 text-right">
                                    ${item.unitCost.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    ${(item.allowance || 0).toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-medium">
                                    ${item.totalCost.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600 border-l-2 border-gray-300">
                                    {item.manufacturerId
                                      ? manufacturers.find(
                                          (m) => m.id === item.manufacturerId,
                                        )?.name
                                      : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {item.productId
                                      ? (() => {
                                          const product = products.find(
                                            (p) => p.id === item.productId,
                                          );
                                          if (!product) return "-";
                                          if (product.productUrl) {
                                            return (
                                              <a
                                                href={product.productUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:text-indigo-900 underline"
                                              >
                                                {product.name}
                                              </a>
                                            );
                                          }
                                          return product.name;
                                        })()
                                      : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-gray-600">
                                    {item.modelNumber || "-"}
                                  </td>
                                  <td
                                    className="px-2 py-1 text-gray-600 truncate max-w-[6rem]"
                                    title={item.material}
                                  >
                                    {item.material}
                                  </td>
                                  <td className="px-2 py-1">
                                    <span
                                      className={`px-1 py-0.5 rounded text-xs ${
                                        item.status === "installed"
                                          ? "bg-green-100 text-green-700"
                                          : item.status === "ordered"
                                            ? "bg-blue-100 text-blue-700"
                                            : item.status === "received"
                                              ? "bg-purple-100 text-purple-700"
                                              : item.status === "final"
                                                ? "bg-teal-100 text-teal-700"
                                                : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {item.status || "pending"}
                                    </span>
                                    {getLineItemOrders(item.id).length > 0 && (
                                      <button
                                        onClick={() =>
                                          toggleLineItemDetails(item.id)
                                        }
                                        className="ml-1 text-blue-600 hover:text-blue-900"
                                        title="View order details"
                                      >
                                        {expandedLineItems.has(item.id)
                                          ? "🔽"
                                          : "📋"}
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        handleStartInlineEdit(item)
                                      }
                                      className="ml-1 text-indigo-600 hover:text-indigo-900"
                                      title="Edit inline"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleOpenOptionsModal(item.id)
                                      }
                                      className="ml-1 text-purple-600 hover:text-purple-900"
                                      title="Choose options (Good/Better/Best)"
                                    >
                                      {hasUnselectedOptions(item.id)
                                        ? "❓"
                                        : "⚙️"}
                                    </button>
                                  </td>
                                  <td className="px-2 py-1 text-center relative bg-gray-100">
                                    <button
                                      onClick={() =>
                                        setOpenActionMenu(
                                          openActionMenu === item.id
                                            ? null
                                            : item.id,
                                        )
                                      }
                                      className="text-lg font-bold text-gray-700 hover:text-gray-900"
                                    >
                                      ⋮
                                    </button>
                                    {openActionMenu === item.id && (
                                      <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                        <button
                                          onClick={() => {
                                            handleStartModalEdit(item);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-gray-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleOpenOptionsModal(item.id);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-purple-600 hover:bg-gray-50"
                                        >
                                          Options
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleDeleteLineItem(item.id);
                                            setOpenActionMenu(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {expandedLineItems.has(item.id) &&
                                  getLineItemOrders(item.id).length > 0 && (
                                    <>
                                      {getLineItemOrders(item.id).map(
                                        (order, orderIndex, ordersArray) => {
                                          const orderItem = orderItems.find(
                                            (oi) =>
                                              oi.orderId === order.id &&
                                              oi.lineItemId === item.id,
                                          );
                                          const itemReceipts = orderItem
                                            ? getOrderItemReceipts(orderItem.id)
                                            : [];
                                          const orderTotal = orderItem
                                            ? orderItem.orderedQuantity *
                                              orderItem.orderedPrice
                                            : 0;

                                          // Calculate cumulative variance only for last order
                                          const isLastOrder =
                                            orderIndex ===
                                            ordersArray.length - 1;
                                          const allOrderTotals =
                                            ordersArray.reduce((sum, o) => {
                                              const oi = orderItems.find(
                                                (oiItem) =>
                                                  oiItem.orderId === o.id &&
                                                  oiItem.lineItemId === item.id,
                                              );
                                              return (
                                                sum +
                                                (oi
                                                  ? oi.orderedQuantity *
                                                    oi.orderedPrice
                                                  : 0)
                                              );
                                            }, 0);
                                          const variance = isLastOrder
                                            ? (item.allowance || 0) -
                                              allOrderTotals
                                            : null;

                                          return (
                                            <React.Fragment
                                              key={`${item.id}-order-${order.id}`}
                                            >
                                              <tr className="text-xs">
                                                <td className="px-2 py-1"></td>
                                                <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                  {orderItem?.orderedQuantity ||
                                                    ""}
                                                </td>
                                                <td className="px-2 py-1 text-left text-gray-600 bg-blue-50">
                                                  {orderItem
                                                    ? item.unit || "-"
                                                    : ""}
                                                </td>
                                                <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                  {orderItem
                                                    ? `$${orderItem.orderedPrice.toFixed(2)}`
                                                    : ""}
                                                </td>
                                                <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                  {orderItem &&
                                                    variance !== null && (
                                                      <span
                                                        className={
                                                          variance >= 0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                        }
                                                      >
                                                        {variance >= 0
                                                          ? "$"
                                                          : "-$"}
                                                        {Math.abs(
                                                          variance,
                                                        ).toFixed(2)}
                                                      </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-right text-gray-600 bg-blue-50">
                                                  {orderItem
                                                    ? `$${orderTotal.toFixed(2)}`
                                                    : ""}
                                                </td>
                                                <td
                                                  colSpan={4}
                                                  className="px-2 py-1 text-gray-700 bg-blue-50"
                                                >
                                                  <span className="font-medium text-gray-600">
                                                    Order #{order.orderNumber} -{" "}
                                                    {new Date(
                                                      order.orderDate,
                                                    ).toLocaleDateString()}
                                                  </span>
                                                </td>
                                                <td className="px-2 py-1 text-left text-gray-600 bg-blue-50"></td>
                                                <td className="px-2 py-1 bg-blue-50"></td>
                                              </tr>
                                              {itemReceipts.map((receipt) => (
                                                <tr
                                                  key={`receipt-${receipt.id}`}
                                                  className="text-xs"
                                                >
                                                  <td className="px-2 py-1"></td>
                                                  <td className="px-2 py-1 text-right text-gray-600 bg-green-50">
                                                    {receipt.receivedQuantity}
                                                  </td>
                                                  <td className="px-2 py-1 text-left text-gray-600 bg-green-50">
                                                    {item.unit || "-"}
                                                  </td>
                                                  <td className="px-2 py-1 bg-green-50"></td>
                                                  <td className="px-2 py-1 bg-green-50"></td>
                                                  <td className="px-2 py-1 bg-green-50"></td>
                                                  <td
                                                    colSpan={4}
                                                    className="px-2 py-1 text-gray-700 bg-green-50"
                                                  >
                                                    <span className="font-medium text-gray-600">
                                                      Received -{" "}
                                                      {new Date(
                                                        receipt.receivedDate,
                                                      ).toLocaleDateString()}
                                                    </span>
                                                  </td>
                                                  <td className="px-2 py-1 text-left text-gray-600 bg-green-50">
                                                    {receipt.notes || ""}
                                                  </td>
                                                  <td className="px-2 py-1 bg-green-50"></td>
                                                </tr>
                                              ))}
                                            </React.Fragment>
                                          );
                                        },
                                      )}
                                    </>
                                  )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Add Section Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {editingCategory ? "Edit Section" : "Add New Section"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  list="section-names"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Select or type a section name"
                  autoFocus
                />
                <datalist id="section-names">
                  <option value="Kitchen" />
                  <option value="Master Bathroom" />
                  <option value="Master Bedroom" />
                  <option value="Bathroom" />
                  <option value="Guest Bathroom" />
                  <option value="Living Room" />
                  <option value="Dining Room" />
                  <option value="Family Room" />
                  <option value="Bedroom" />
                  <option value="Laundry Room" />
                  <option value="Garage" />
                  <option value="Basement" />
                  <option value="Attic" />
                  <option value="Office" />
                  <option value="Entryway" />
                  <option value="Mudroom" />
                  <option value="Powder Room" />
                  <option value="Pantry" />
                  <option value="Great Room" />
                  <option value="Sunroom" />
                  <option value="Patio" />
                  <option value="Deck" />
                  <option value="Exterior" />
                  <option value="Fixtures" />
                  <option value="Lighting" />
                  <option value="Plumbing" />
                  <option value="Electrical" />
                  <option value="Flooring" />
                  <option value="Cabinetry" />
                  <option value="Appliances" />
                  <option value="Hardware" />
                  <option value="Trim" />
                  <option value="Paint & Finishes" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newCategory.allowance}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      allowance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setNewCategory({
                    projectId: id || "",
                    name: "",
                    description: "",
                    allowance: 0,
                  });
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                {editingCategory ? "Update Section" : "Add Section"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Line Item Modal */}
      {editModalItemId && editingItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Edit Line Item
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Material
                </label>
                <div className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                  {editingItem.material || "-"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Vendor
                </label>
                <select
                  value={editingItem.vendorId || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      vendorId: e.target.value || undefined,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {(() => {
                    // Filter vendors to only show those that carry this product
                    if (editingItem.productId) {
                      const productVendorList = productVendors.filter(
                        (pv) => pv.productId === editingItem.productId,
                      );
                      const vendorIds = productVendorList.map(
                        (pv) => pv.vendorId,
                      );

                      // Include the current vendor if it's not in the list
                      if (
                        editingItem.vendorId &&
                        !vendorIds.includes(editingItem.vendorId)
                      ) {
                        vendorIds.push(editingItem.vendorId);
                      }

                      return vendors
                        .filter((v) => vendorIds.includes(v.id))
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ));
                    }
                    return vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ));
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Manufacturer
                </label>
                <div className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                  {editingItem.manufacturerId
                    ? manufacturers.find(
                        (m) => m.id === editingItem.manufacturerId,
                      )?.name || "-"
                    : "-"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Product
                </label>
                <div className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                  {editingItem.productId
                    ? products.find((p) => p.id === editingItem.productId)
                        ?.name || "-"
                    : "-"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editingItem.status || "pending"}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="selected">Selected</option>
                  <option value="final">Final</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                  <option value="installed">Installed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={editingItem.quantity}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <div className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                  {editingItem.unit || "-"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unit Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.unitCost}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      unitCost: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <div className="px-2 py-1 text-xs bg-gray-100 rounded-md font-medium">
                  ${(editingItem.quantity * editingItem.unitCost).toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.allowance || 0}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      allowance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingItem.notes || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setEditModalItemId(null);
                  setEditingItem(null);
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalEdit}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showProjectModal && editingProject && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Edit Project
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProject.name}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editingProject.description}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Project Number
                  </label>
                  <input
                    type="text"
                    value={editingProject.projectNumber || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        projectNumber: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={editingProject.customerName || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        customerName: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editingProject.address || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingProject.email || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editingProject.phone || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={editingProject.mobilePhone || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        mobilePhone: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Preferred Contact Method
                  </label>
                  <input
                    type="text"
                    value={editingProject.preferredContactMethod || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        preferredContactMethod: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estimated Start Date
                  </label>
                  <input
                    type="date"
                    value={editingProject.estimatedStartDate || ""}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        estimatedStartDate: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={editingProject.type || "other"}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="bath">Bath</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="shower">Shower</option>
                    <option value="roof">Roof</option>
                    <option value="addition">Addition</option>
                    <option value="renovation">Renovation</option>
                    <option value="flooring">Flooring</option>
                    <option value="deck">Deck</option>
                    <option value="basement">Basement</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingProject.status || "planning"}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="in-progress">In Progress</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <button
                onClick={() => {
                  setShowProjectModal(false);
                  setEditingProject(null);
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProject}
                disabled={savingProject}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingProject ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Product Modal */}
      {showInsertProductModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {selectingForLineItem
                  ? "Select Product for Line Item"
                  : "Insert Product into Project"}
              </h3>
              <button
                onClick={() => {
                  setShowInsertProductModal(false);
                  setSelectingForLineItem(null);
                  setSearchTerm("");
                  setFilterVendorId("");
                  setFilterManufacturerId("");
                  setFilterCategory("");
                  setFilterTier({ good: false, better: false, best: false });
                  setFilterCollection("");
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Filter Section */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 space-y-3">
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search products..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Vendor
                  </label>
                  <select
                    value={filterVendorId}
                    onChange={(e) => setFilterVendorId(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Vendors</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <select
                    value={filterManufacturerId}
                    onChange={(e) => setFilterManufacturerId(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Manufacturers</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product Category
                  </label>
                  <input
                    type="text"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    placeholder="Filter by category..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Collection
                  </label>
                  <input
                    type="text"
                    value={filterCollection}
                    onChange={(e) => setFilterCollection(e.target.value)}
                    placeholder="Filter by collection..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Tier Filters */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-gray-700">Tier:</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterTier.good}
                    onChange={(e) =>
                      setFilterTier({ ...filterTier, good: e.target.checked })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Good</span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterTier.better}
                    onChange={(e) =>
                      setFilterTier({ ...filterTier, better: e.target.checked })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Better</span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterTier.best}
                    onChange={(e) =>
                      setFilterTier({ ...filterTier, best: e.target.checked })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Best</span>
                </label>
              </div>
            </div>

            {/* Insert into Section & Quantity */}
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {selectingForLineItem ? "Section" : "Insert into Section *"}
                  </label>
                  <select
                    value={selectedCategoryForInsert}
                    onChange={(e) =>
                      setSelectedCategoryForInsert(e.target.value)
                    }
                    disabled={!!selectingForLineItem}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={insertQuantity}
                    onChange={(e) => setInsertQuantity(Number(e.target.value))}
                    min="1"
                    step="1"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Cost (optional)
                  </label>
                  <input
                    type="number"
                    value={insertUnitCost}
                    onChange={(e) => setInsertUnitCost(Number(e.target.value))}
                    min="0"
                    step="0.01"
                    placeholder="Uses vendor cost if empty"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Product
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Model
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Manufacturer
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Category
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Vendor(s)
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Cost
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Filter products based on all criteria
                      let filtered = products;

                      // Search term filter
                      if (searchTerm) {
                        const search = searchTerm.toLowerCase();
                        filtered = filtered.filter((p) => {
                          // Search in product fields
                          if (
                            p.name.toLowerCase().includes(search) ||
                            p.description?.toLowerCase().includes(search) ||
                            p.modelNumber?.toLowerCase().includes(search)
                          ) {
                            return true;
                          }
                          // Search in vendor SKUs
                          const productVendorList = productVendors.filter(
                            (pv) => pv.productId === p.id,
                          );
                          return productVendorList.some((pv) =>
                            pv.sku?.toLowerCase().includes(search),
                          );
                        });
                      }

                      // Manufacturer filter
                      if (filterManufacturerId) {
                        filtered = filtered.filter(
                          (p) => p.manufacturerId === filterManufacturerId,
                        );
                      }

                      // Category filter
                      if (filterCategory) {
                        const catSearch = filterCategory.toLowerCase();
                        filtered = filtered.filter((p) =>
                          p.category?.toLowerCase().includes(catSearch),
                        );
                      }

                      // Tier filter
                      const anyTierFilterActive =
                        filterTier.good || filterTier.better || filterTier.best;
                      if (anyTierFilterActive) {
                        filtered = filtered.filter((p) => {
                          if (!p.tier) return false;
                          if (p.tier === "good" && !filterTier.good)
                            return false;
                          if (p.tier === "better" && !filterTier.better)
                            return false;
                          if (p.tier === "best" && !filterTier.best)
                            return false;
                          return true;
                        });
                      }

                      // Collection filter
                      if (filterCollection) {
                        const collectionSearch = filterCollection.toLowerCase();
                        filtered = filtered.filter((p) =>
                          p.collection
                            ?.toLowerCase()
                            .includes(collectionSearch),
                        );
                      }

                      // Vendor filter - only show products that have this vendor
                      if (filterVendorId) {
                        const productIdsForVendor = productVendors
                          .filter((pv) => pv.vendorId === filterVendorId)
                          .map((pv) => pv.productId);
                        filtered = filtered.filter((p) =>
                          productIdsForVendor.includes(p.id),
                        );

                        // If manufacturer filter is also set, ensure vendor has that manufacturer
                        if (filterManufacturerId) {
                          // This is already handled by the manufacturer filter above
                          // The combination naturally gives us products from that manufacturer
                          // that are sold by that vendor
                        }
                      }

                      // If manufacturer filter is set and vendor filter is set,
                      // ensure the vendor sells products from that manufacturer
                      if (filterManufacturerId && filterVendorId) {
                        const validProductIds = productVendors
                          .filter((pv) => pv.vendorId === filterVendorId)
                          .map((pv) => pv.productId);
                        filtered = filtered.filter((p) =>
                          validProductIds.includes(p.id),
                        );
                      }

                      return filtered.length > 0 ? (
                        filtered.map((product) => {
                          const manufacturer = manufacturers.find(
                            (m) => m.id === product.manufacturerId,
                          );
                          const productVendorList = productVendors.filter(
                            (pv) => pv.productId === product.id,
                          );
                          const primaryPV =
                            productVendorList.find((pv) => pv.isPrimary) ||
                            productVendorList[0];

                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs text-gray-900">
                                <div className="font-medium">
                                  {product.name}
                                </div>
                                {product.description && (
                                  <div className="text-gray-500 truncate max-w-xs">
                                    {product.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {product.modelNumber || "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {manufacturer?.name || "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {product.category || "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {productVendorList.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {productVendorList.map((pv) => {
                                      const vendor = vendors.find(
                                        (v) => v.id === pv.vendorId,
                                      );
                                      return (
                                        <div
                                          key={pv.id}
                                          className="flex items-center gap-1"
                                        >
                                          <span>
                                            {vendor?.name}
                                            {pv.sku && (
                                              <span className="text-gray-500">
                                                {" "}
                                                ({pv.sku})
                                              </span>
                                            )}
                                          </span>
                                          {pv.isPrimary && (
                                            <span className="text-yellow-600">
                                              ★
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {primaryPV
                                  ? `$${primaryPV.cost.toFixed(2)}`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                <button
                                  onClick={() =>
                                    selectingForLineItem
                                      ? handleSelectProduct(product)
                                      : handleInsertProduct(product)
                                  }
                                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                >
                                  {selectingForLineItem ? "Select" : "Insert"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-8 text-center text-xs text-gray-500"
                          >
                            No products found matching your filters
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <button
                onClick={() => {
                  setShowInsertProductModal(false);
                  setSelectingForLineItem(null);
                  setSearchTerm("");
                  setFilterVendorId("");
                  setFilterManufacturerId("");
                  setFilterCategory("");
                  setFilterTier({ good: false, better: false, best: false });
                  setFilterCollection("");
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && selectedVendorId && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {editingOrderId ? "Edit Order" : "Create Order"} -{" "}
              {vendors.find((v) => v.id === selectedVendorId)?.name}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 p-3 rounded">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Order Number *
                </label>
                <input
                  type="text"
                  value={orderForm.orderNumber}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, orderNumber: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="PO-12345"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Order Date *
                </label>
                <input
                  type="date"
                  value={orderForm.orderDate}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, orderDate: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, notes: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Optional order notes"
                />
              </div>
            </div>

            <div className="mb-3">
              <h4 className="font-medium text-xs text-gray-900 mb-2">
                Line Items
              </h4>
              <table className="min-w-full text-xs bg-white shadow rounded-lg overflow-hidden">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1 text-center font-medium text-gray-600 w-8">
                      ✓
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Product
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      Line Qty
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Unit
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      Unit Cost
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      Order Qty
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      Order Price
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getVendorLineItems(selectedVendorId).map((item) => {
                    const product = item.productId
                      ? products.find((p) => p.id === item.productId)
                      : null;
                    const itemData = orderForm.items[item.id] || {
                      qty: "",
                      price: "",
                    };
                    const total =
                      itemData.qty && itemData.price
                        ? (
                            parseFloat(itemData.qty) *
                            parseFloat(itemData.price)
                          ).toFixed(2)
                        : "-";
                    const isSelected =
                      itemData.qty !== "" || itemData.price !== "";
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => {
                              if (isSelected) {
                                // Unselect - clear values
                                setOrderForm({
                                  ...orderForm,
                                  items: {
                                    ...orderForm.items,
                                    [item.id]: { qty: "", price: "" },
                                  },
                                });
                              } else {
                                // Select - populate with defaults
                                setOrderForm({
                                  ...orderForm,
                                  items: {
                                    ...orderForm.items,
                                    [item.id]: {
                                      qty: item.quantity.toString(),
                                      price: item.unitCost.toString(),
                                    },
                                  },
                                });
                              }
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-gray-300 hover:border-indigo-400"
                            }`}
                            title={
                              isSelected ? "Remove from order" : "Add to order"
                            }
                          >
                            {isSelected && "✓"}
                          </button>
                        </td>
                        <td className="px-2 py-1">
                          {product?.name || item.name}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          {item.quantity}
                        </td>
                        <td className="px-2 py-1 text-gray-600">{item.unit}</td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          ${item.unitCost.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            value={itemData.qty}
                            onChange={(e) =>
                              setOrderForm({
                                ...orderForm,
                                items: {
                                  ...orderForm.items,
                                  [item.id]: {
                                    ...itemData,
                                    qty: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-xs"
                            placeholder="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            value={itemData.price}
                            onChange={(e) =>
                              setOrderForm({
                                ...orderForm,
                                items: {
                                  ...orderForm.items,
                                  [item.id]: {
                                    ...itemData,
                                    price: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-xs"
                            placeholder="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-medium">
                          {total !== "-" ? `$${total}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">
                * Click the ✓ button to add an item to the order with default
                quantities, or manually enter values
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setSelectedVendorId(null);
                  setEditingOrderId(null);
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                {editingOrderId ? "Update Order" : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order List Modal */}
      {showOrderListModal && selectedVendorId && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-2xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Orders for {vendors.find((v) => v.id === selectedVendorId)?.name}
            </h3>

            <div className="space-y-2 mb-4">
              {getVendorOrders(selectedVendorId).map((order) => {
                const itemCount = orderItems.filter(
                  (oi) => oi.orderId === order.id,
                ).length;
                return (
                  <button
                    key={order.id}
                    onClick={() => handleEditOrder(order.id)}
                    className="w-full text-left p-2 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-xs text-gray-900">
                          Order #{order.orderNumber}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {new Date(order.orderDate).toLocaleDateString()} •{" "}
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </div>
                        {order.notes && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {order.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-indigo-600 text-xs">Edit →</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowOrderListModal(false);
                  setSelectedVendorId(null);
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && selectedVendorId && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Receive Items -{" "}
              {vendors.find((v) => v.id === selectedVendorId)?.name}
            </h3>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Select Order
              </label>
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                onChange={(e) => setSelectedOrderId(e.target.value)}
                value={selectedOrderId || ""}
              >
                <option value="">Choose an order...</option>
                {getVendorOrders(selectedVendorId).map((order) => (
                  <option key={order.id} value={order.id}>
                    Order #{order.orderNumber} -{" "}
                    {new Date(order.orderDate).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedOrderId && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 p-3 rounded">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Received Date *
                    </label>
                    <input
                      type="date"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      value={receiveForm.receivedDate}
                      onChange={(e) => {
                        setReceiveForm({
                          ...receiveForm,
                          receivedDate: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      rows={2}
                      placeholder="Optional receiving notes"
                      value={receiveForm.notes}
                      onChange={(e) => {
                        setReceiveForm({
                          ...receiveForm,
                          notes: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-xs text-gray-900 mb-2">
                    Order Items
                  </h4>
                  <table className="min-w-full text-xs border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-center font-medium text-gray-600 border-b w-8">
                          ✓
                        </th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600 border-b">
                          Product
                        </th>
                        <th className="px-2 py-1 text-right font-medium text-gray-600 border-b">
                          Item Qty
                        </th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600 border-b">
                          Unit
                        </th>
                        <th className="px-2 py-1 text-right font-medium text-gray-600 border-b">
                          Ordered
                        </th>
                        <th className="px-2 py-1 text-right font-medium text-gray-600 border-b">
                          Previously Received
                        </th>
                        <th className="px-2 py-1 text-right font-medium text-gray-600 border-b">
                          Receive Now
                        </th>
                        <th className="px-2 py-1 text-center font-medium text-gray-600 border-b">
                          Partial
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems
                        .filter((oi) => oi.orderId === selectedOrderId)
                        .map((orderItem) => {
                          const item = lineItems.find(
                            (li) => li.id === orderItem.lineItemId,
                          );
                          if (!item) return null;
                          const product = item.productId
                            ? products.find((p) => p.id === item.productId)
                            : null;
                          const previouslyReceived = getOrderItemReceipts(
                            orderItem.id,
                          ).reduce((sum, r) => sum + r.receivedQuantity, 0);
                          const formData = receiveForm.items[orderItem.id] || {
                            qty: "",
                            isPartial: false,
                          };
                          const isSelected = formData.qty !== "";
                          return (
                            <tr
                              key={orderItem.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="px-2 py-1 text-center">
                                <button
                                  onClick={() => {
                                    setReceiveForm({
                                      ...receiveForm,
                                      items: {
                                        ...receiveForm.items,
                                        [orderItem.id]: isSelected
                                          ? { qty: "", isPartial: false }
                                          : {
                                              qty: (
                                                orderItem.orderedQuantity -
                                                previouslyReceived
                                              ).toString(),
                                              isPartial: false,
                                            },
                                      },
                                    });
                                  }}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-green-600 border-green-600 text-white"
                                      : "border-gray-300 hover:border-green-400"
                                  }`}
                                  title={
                                    isSelected
                                      ? "Remove from receipt"
                                      : "Add to receipt"
                                  }
                                >
                                  {isSelected && "✓"}
                                </button>
                              </td>
                              <td className="px-2 py-1">
                                {product?.name || item.name}
                              </td>
                              <td className="px-2 py-1 text-right text-gray-600">
                                {orderItem.orderedQuantity}
                              </td>
                              <td className="px-2 py-1 text-gray-600">
                                {item.unit || ""}
                              </td>
                              <td className="px-2 py-1 text-right text-gray-600">
                                {orderItem.orderedQuantity}
                              </td>
                              <td className="px-2 py-1 text-right text-gray-600">
                                {previouslyReceived}
                              </td>
                              <td className="px-2 py-1 text-right">
                                <input
                                  type="number"
                                  className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                                  placeholder="0"
                                  step="0.01"
                                  value={formData.qty}
                                  onChange={(e) =>
                                    setReceiveForm({
                                      ...receiveForm,
                                      items: {
                                        ...receiveForm.items,
                                        [orderItem.id]: {
                                          ...formData,
                                          qty: e.target.value,
                                        },
                                      },
                                    })
                                  }
                                  max={
                                    orderItem.orderedQuantity -
                                    previouslyReceived
                                  }
                                />
                              </td>
                              <td className="px-2 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={formData.isPartial}
                                  onChange={(e) =>
                                    setReceiveForm({
                                      ...receiveForm,
                                      items: {
                                        ...receiveForm.items,
                                        [orderItem.id]: {
                                          ...formData,
                                          isPartial: e.target.checked,
                                        },
                                      },
                                    })
                                  }
                                  className="w-4 h-4"
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowReceiveModal(false);
                  setSelectedVendorId(null);
                  setSelectedOrderId(null);
                }}
                className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordReceipt}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                disabled={!selectedOrderId}
              >
                Record Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choose Options Modal */}
      {showOptionsModal && optionsForLineItem && (
        <ChooseOptionsModal
          lineItem={optionsForLineItem}
          products={allProducts}
          manufacturers={manufacturers}
          vendors={vendors}
          productVendors={productVendors}
          onClose={handleCloseOptionsModal}
          onOptionsChanged={handleOptionsChanged}
        />
      )}

      {/* Documents Modal */}
      {showDocumentsModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Project Documents
              </h2>
              <button
                onClick={() => setShowDocumentsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              {project.sharepointFolderId && project.sharepointDriveId && (
                <DocumentManager
                  projectId={project.id}
                  sharepointFolderId={project.sharepointFolderId}
                  sharepointDriveId={project.sharepointDriveId}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Assistant */}
      {project && project.id && (
        <ChatAssistant
          projectId={project.id}
          projectName={project.name}
          onLineItemAdded={(lineItem) =>
            setLineItems((prev) => [...prev, lineItem])
          }
        />
      )}
    </div>
  );
};

export default ProjectDetail;
