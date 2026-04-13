import { useEffect, useRef, useState } from "react";
import {
    manufacturerService,
    productService,
    productVendorService,
    vendorService,
} from "../services";
import type { Manufacturer, Product, ProductVendor, Vendor } from "../types";

type FilterView = "all" | "vendor" | "manufacturer" | "category";

const ProductList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterView, setFilterView] = useState<FilterView>("all");
  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [tierFilters, setTierFilters] = useState({
    good: false,
    better: false,
    best: false,
  });
  const [colorFilter, setColorFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [managingProduct, setManagingProduct] = useState<Product | null>(null);
  const [productVendors, setProductVendors] = useState<ProductVendor[]>([]);
  const [allProductVendors, setAllProductVendors] = useState<
    Map<string, ProductVendor[]>
  >(new Map());
  const [newVendor, setNewVendor] = useState({
    vendorId: "",
    cost: 0,
    sku: "",
  });
  const [openProductMenu, setOpenProductMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  }>({ right: 0 });
  const [hoverProduct, setHoverProduct] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  }>({});
  const [showQuickAddMfr, setShowQuickAddMfr] = useState(false);
  const [quickAddMfrName, setQuickAddMfrName] = useState("");
  const [quickAddMfrSaving, setQuickAddMfrSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    manufacturerId: "",
    name: "",
    modelNumber: "",
    description: "",
    category: "",
    unit: "ea",
    tier: "" as "" | "good" | "better" | "best",
    collection: "",
    color: "",
    imageUrl: "",
    productUrl: "",
  });
  const [primaryVendorId, setPrimaryVendorId] = useState("");
  const [primaryVendorSku, setPrimaryVendorSku] = useState("");
  const [primaryVendorCost, setPrimaryVendorCost] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, manufacturersData, vendorsData] = await Promise.all([
        productService.getAllProducts(),
        manufacturerService.getAllManufacturers(),
        vendorService.getAllVendors(),
      ]);
      setProducts(productsData);
      setManufacturers(manufacturersData);
      setVendors(vendorsData);

      // Load product vendors for all products
      const vendorsMap = new Map<string, ProductVendor[]>();
      await Promise.all(
        productsData.map(async (product) => {
          try {
            const pvs = await productVendorService.getAllByProduct(product.id);
            vendorsMap.set(product.id, pvs);
          } catch (err) {
            console.error(
              `Failed to load vendors for product ${product.id}:`,
              err,
            );
            vendorsMap.set(product.id, []);
          }
        }),
      );
      setAllProductVendors(vendorsMap);
    } catch (err) {
      setError("Failed to load data");
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        manufacturerId: product.manufacturerId,
        name: product.name,
        modelNumber: product.modelNumber || "",
        description: product.description || "",
        category: product.category || "",
        unit: product.unit || "ea",
        tier: (product.tier || "") as "" | "good" | "better" | "best",
        collection: product.collection || "",
        color: product.color || "",
        imageUrl: product.imageUrl || "",
        productUrl: product.productUrl || "",
      });
      setPrimaryVendorId("");
      setPrimaryVendorSku("");
      setPrimaryVendorCost("");
    } else {
      setEditingProduct(null);
      setFormData({
        manufacturerId: selectedManufacturerId || "",
        name: "",
        modelNumber: "",
        description: "",
        category: "",
        unit: "ea",
        tier: "" as "" | "good" | "better" | "best",
        collection: "",
        color: "",
        imageUrl: "",
        productUrl: "",
      });
      setPrimaryVendorId("");
      setPrimaryVendorSku("");
      setPrimaryVendorCost("");
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setShowQuickAddMfr(false);
    setQuickAddMfrName("");
    setFormData({
      manufacturerId: "",
      name: "",
      modelNumber: "",
      description: "",
      category: "",
      unit: "ea",
      tier: "" as "" | "good" | "better" | "best",
      collection: "",
      color: "",
      imageUrl: "",
      productUrl: "",
    });
    setPrimaryVendorId("");
    setPrimaryVendorSku("");
    setPrimaryVendorCost("");
  };

  // Clone opens the Add modal pre-populated with the source product's fields
  const handleClone = (product: Product) => {
    setEditingProduct(null);
    setFormData({
      manufacturerId: product.manufacturerId || "",
      name: `Copy of ${product.name}`,
      modelNumber: product.modelNumber || "",
      description: product.description || "",
      category: product.category || "",
      unit: product.unit || "ea",
      tier: (product.tier || "") as "" | "good" | "better" | "best",
      collection: product.collection || "",
      color: product.color || "",
      imageUrl: product.imageUrl || "",
      productUrl: product.productUrl || "",
    });
    setPrimaryVendorId("");
    setPrimaryVendorSku("");
    setPrimaryVendorCost("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryVendorCostValue = primaryVendorId
      ? primaryVendorCost.trim() === ""
        ? 0
        : parseFloat(primaryVendorCost)
      : null;
    if (primaryVendorId && Number.isNaN(primaryVendorCostValue)) {
      setError("Primary vendor cost must be a valid number");
      return;
    }
    try {
      // Convert empty string tier to undefined for API compatibility
      const submitData = {
        ...formData,
        tier: formData.tier === "" ? undefined : formData.tier,
      };

      if (editingProduct) {
        const updated = await productService.updateProduct(
          editingProduct.id,
          submitData,
        );
        setProducts(products.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await productService.createProduct(submitData);
        setProducts([...products, created]);
        if (primaryVendorId) {
          try {
            const createdVendor = await productVendorService.create({
              productId: created.id,
              vendorId: primaryVendorId,
              cost: primaryVendorCostValue ?? 0,
              sku: primaryVendorSku.trim() || undefined,
              isPrimary: true,
            });
            setAllProductVendors(
              new Map(allProductVendors).set(created.id, [createdVendor]),
            );
          } catch (vendorError) {
            setError(
              "Product saved, but failed to create primary vendor relationship",
            );
            console.error("Error creating primary vendor:", vendorError);
          }
        }
      }
      handleCloseModal();
    } catch (err) {
      setError("Failed to save product");
      console.error("Error saving product:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await productService.deleteProduct(id);
      setProducts(products.filter((p) => p.id !== id));
    } catch (err) {
      setError("Failed to delete product");
      console.error("Error deleting product:", err);
    }
  };

  const handleOpenVendorModal = async (product: Product) => {
    setManagingProduct(product);
    try {
      const pv = await productVendorService.getAllByProduct(product.id);
      setProductVendors(pv);
      setAllProductVendors(new Map(allProductVendors).set(product.id, pv));
    } catch (err) {
      console.error("Error loading product vendors:", err);
      setProductVendors([]);
    }
    setIsVendorModalOpen(true);
  };

  const handleCloseVendorModal = () => {
    setIsVendorModalOpen(false);
    setManagingProduct(null);
    setProductVendors([]);
    setNewVendor({ vendorId: "", cost: 0, sku: "" });
  };

  const handleAddVendor = async () => {
    if (!managingProduct || !newVendor.vendorId) return;

    try {
      const created = await productVendorService.create({
        productId: managingProduct.id,
        vendorId: newVendor.vendorId,
        cost: newVendor.cost,
        sku: newVendor.sku || undefined,
      });
      const updated = [...productVendors, created];
      setProductVendors(updated);
      setAllProductVendors(
        new Map(allProductVendors).set(managingProduct.id, updated),
      );
      setNewVendor({ vendorId: "", cost: 0, sku: "" });
    } catch (err) {
      setError("Failed to add vendor");
      console.error("Error adding vendor:", err);
    }
  };

  const handleTogglePrimary = async (pv: ProductVendor) => {
    if (!managingProduct) return;
    try {
      const updated = await productVendorService.update(pv.id, {
        isPrimary: !pv.isPrimary,
      });
      const updatedList = productVendors.map(
        (item) =>
          item.id === updated.id ? updated : { ...item, isPrimary: false }, // Unset others
      );
      setProductVendors(updatedList);
      setAllProductVendors(
        new Map(allProductVendors).set(managingProduct.id, updatedList),
      );
    } catch (err) {
      setError("Failed to update primary vendor");
      console.error("Error updating primary vendor:", err);
    }
  };

  const handleUpdateCost = async (pv: ProductVendor, newCost: number) => {
    if (!managingProduct) return;
    try {
      const updated = await productVendorService.update(pv.id, {
        cost: newCost,
      });
      const updatedList = productVendors.map((item) =>
        item.id === updated.id ? updated : item,
      );
      setProductVendors(updatedList);
      setAllProductVendors(
        new Map(allProductVendors).set(managingProduct.id, updatedList),
      );
    } catch (err) {
      setError("Failed to update cost");
      console.error("Error updating cost:", err);
    }
  };

  const handleUpdateSku = async (pv: ProductVendor, newSku: string) => {
    if (!managingProduct) return;
    try {
      const updated = await productVendorService.update(pv.id, {
        sku: newSku || undefined,
      });
      const updatedList = productVendors.map((item) =>
        item.id === updated.id ? updated : item,
      );
      setProductVendors(updatedList);
      setAllProductVendors(
        new Map(allProductVendors).set(managingProduct.id, updatedList),
      );
    } catch (err) {
      setError("Failed to update SKU");
      console.error("Error updating SKU:", err);
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (
      !confirm("Are you sure you want to remove this vendor?") ||
      !managingProduct
    )
      return;

    try {
      await productVendorService.delete(id);
      const updatedList = productVendors.filter((pv) => pv.id !== id);
      setProductVendors(updatedList);
      setAllProductVendors(
        new Map(allProductVendors).set(managingProduct.id, updatedList),
      );
    } catch (err) {
      setError("Failed to delete vendor");
      console.error("Error deleting vendor:", err);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const imported: Product[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });

        // Map CSV columns to product fields
        const productData = {
          manufacturerId: row.manufacturerid || row.manufacturer_id || "",
          name: row.name || row.productname || row.product_name || "",
          modelNumber: row.modelnumber || row.model_number || row.model || "",
          description: row.description || "",
          category: row.category || "",
          unit: row.unit || "ea",
          imageUrl: row.imageurl || row.image_url || row.image || "",
          productUrl: row.producturl || row.product_url || row.url || "",
        };

        if (productData.manufacturerId && productData.name) {
          const created = await productService.createProduct(productData);
          imported.push(created);
        }
      }

      setProducts([...products, ...imported]);
      setIsCsvModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      alert(`Successfully imported ${imported.length} products`);
    } catch (err) {
      setError("Failed to import CSV");
      console.error("Error importing CSV:", err);
    }
  };

  const downloadCsvTemplate = () => {
    const template =
      "manufacturerId,name,modelNumber,description,category,unit,imageUrl,productUrl\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter products based on view and search
  const filteredProducts = products.filter((product) => {
    // Filter by view
    if (filterView === "manufacturer" && selectedManufacturerId) {
      if (product.manufacturerId !== selectedManufacturerId) return false;
    }

    // Filter by vendor using product-vendor relationships
    if (filterView === "vendor" && selectedVendorId) {
      const productVendorList = allProductVendors.get(product.id) || [];
      const hasVendor = productVendorList.some(
        (pv) => pv.vendorId === selectedVendorId,
      );
      if (!hasVendor) return false;
    }

    // Filter by category
    if (filterView === "category" && selectedCategory) {
      if (product.category !== selectedCategory) return false;
    }

    // Filter by tier - if any tier filter is checked, only show matching tiers
    const anyTierFilterActive =
      tierFilters.good || tierFilters.better || tierFilters.best;
    if (anyTierFilterActive) {
      if (!product.tier) return false; // Exclude products without tier
      if (product.tier === "good" && !tierFilters.good) return false;
      if (product.tier === "better" && !tierFilters.better) return false;
      if (product.tier === "best" && !tierFilters.best) return false;
    }

    // Filter by color
    if (colorFilter && product.color !== colorFilter) return false;

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const manufacturer = manufacturers.find(
        (m) => m.id === product.manufacturerId,
      );
      const productVendorList = allProductVendors.get(product.id) || [];
      const vendorNames = productVendorList
        .map((pv) => vendors.find((v) => v.id === pv.vendorId)?.name || "")
        .join(" ");
      return (
        product.name.toLowerCase().includes(search) ||
        product.modelNumber?.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search) ||
        product.category?.toLowerCase().includes(search) ||
        product.color?.toLowerCase().includes(search) ||
        manufacturer?.name.toLowerCase().includes(search) ||
        vendorNames.toLowerCase().includes(search)
      );
    }

    return true;
  });

  if (loading) return <div className="px-4 py-8">Loading products...</div>;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="mt-1 text-xs text-gray-600">
            Manage your product catalog
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
          >
            📊 Import CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            + Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filter Controls */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFilterView("all");
              setSelectedManufacturerId("");
              setSelectedVendorId("");
              setSelectedCategory("");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              filterView === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setFilterView("manufacturer")}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              filterView === "manufacturer"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            By Manufacturer
          </button>
          <button
            onClick={() => setFilterView("vendor")}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              filterView === "vendor"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            By Vendor
          </button>
          <button
            onClick={() => setFilterView("category")}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              filterView === "category"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            By Category
          </button>
        </div>

        {filterView === "manufacturer" && (
          <select
            value={selectedManufacturerId}
            onChange={(e) => setSelectedManufacturerId(e.target.value)}
            className="px-2 py-1 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Manufacturer...</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        {filterView === "vendor" && (
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="px-2 py-1 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}

        {filterView === "category" && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Category...</option>
            {Array.from(
              new Set(products.map((p) => p.category).filter(Boolean)),
            )
              .sort()
              .map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
          </select>
        )}

        {/* Tier Filter Checkboxes */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 font-medium">Tier:</span>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={tierFilters.good}
              onChange={(e) =>
                setTierFilters({ ...tierFilters, good: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Good</span>
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={tierFilters.better}
              onChange={(e) =>
                setTierFilters({ ...tierFilters, better: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Better</span>
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={tierFilters.best}
              onChange={(e) =>
                setTierFilters({ ...tierFilters, best: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Best</span>
          </label>
        </div>
        {/* Color Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">Color:</span>
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Colors</option>
            {Array.from(new Set(products.map((p) => p.color).filter(Boolean)))
              .sort()
              .map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="mt-3">
        <input
          type="text"
          placeholder="Search products by name, model, category, or manufacturer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <div className="mt-4 text-center py-12 bg-white rounded-lg shadow border">
          <p className="text-gray-500">
            {searchTerm || (filterView !== "all" && !selectedManufacturerId)
              ? "No products found matching your criteria"
              : "No products yet. Add your first product!"}
          </p>
        </div>
      ) : (
        <div className="mt-4 bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Product Name
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Model
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Mfr
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Category
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Unit
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Tier
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Collection
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Primary Vendor
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600">
                  Cost
                </th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">
                  Links
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const manufacturer = manufacturers.find(
                  (m) => m.id === product.manufacturerId,
                );
                const productVendorList =
                  allProductVendors.get(product.id) || [];
                const primaryVendor =
                  productVendorList.find((pv) => pv.isPrimary) ||
                  productVendorList[0];
                const primaryVendorName = primaryVendor
                  ? vendors.find((v) => v.id === primaryVendor.vendorId)?.name
                  : null;
                const hasSecondaryVendors = productVendorList.length > 1;
                return (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 border-b border-gray-200 relative group"
                  >
                    <td className="px-2 py-1">
                      <div className="font-medium text-gray-900">
                        {product.name}
                      </div>
                      {product.description && (
                        <div className="text-gray-500 truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td
                      className="px-2 py-1 text-gray-900 cursor-help"
                      onMouseEnter={(e) => {
                        setHoverProduct(product.id);
                        const spaceRight = window.innerWidth - e.clientX;
                        const spaceBelow = window.innerHeight - e.clientY;
                        setTooltipPos({
                          left: spaceRight >= 400 ? e.clientX + 16 : undefined,
                          right:
                            spaceRight < 400
                              ? window.innerWidth - e.clientX + 16
                              : undefined,
                          top: spaceBelow >= 280 ? e.clientY + 16 : undefined,
                          bottom:
                            spaceBelow < 280
                              ? window.innerHeight - e.clientY + 16
                              : undefined,
                        });
                      }}
                      onMouseLeave={() => setHoverProduct(null)}
                    >
                      {product.modelNumber || "-"}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {manufacturer?.name || "-"}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {product.category || "-"}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {product.unit || "-"}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {product.tier ? (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            product.tier === "best"
                              ? "bg-green-100 text-green-800"
                              : product.tier === "better"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {product.tier.charAt(0).toUpperCase() +
                            product.tier.slice(1)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {product.collection || "-"}
                    </td>
                    <td className="px-2 py-1 text-gray-900">
                      {primaryVendorName ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <span>{primaryVendorName}</span>
                            {hasSecondaryVendors && (
                              <span
                                className="px-1 py-0.5 bg-gray-200 text-gray-700 rounded"
                                title={`+${productVendorList.length - 1} more vendor${productVendorList.length - 1 > 1 ? "s" : ""}`}
                              >
                                +{productVendorList.length - 1}
                              </span>
                            )}
                          </div>
                          {primaryVendor?.sku && (
                            <div className="text-gray-500 text-xs">
                              SKU: {primaryVendor.sku}
                            </div>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-900">
                      {primaryVendor
                        ? `$${primaryVendor.cost.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-2">
                        {product.productUrl && (
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🔗
                          </a>
                        )}
                        {product.imageUrl && (
                          <a
                            href={product.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🖼️
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center relative">
                      <button
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const right = window.innerWidth - rect.right;
                          setMenuPos(
                            spaceBelow >= 160
                              ? { top: rect.bottom + 2, right }
                              : {
                                  bottom: window.innerHeight - rect.top + 2,
                                  right,
                                },
                          );
                          setOpenProductMenu(
                            openProductMenu === product.id ? null : product.id,
                          );
                        }}
                        className="text-lg font-bold text-gray-500 hover:text-gray-800 px-2"
                        title="Actions"
                      >
                        ⋮
                      </button>
                      {openProductMenu === product.id && (
                        <div
                          className="fixed w-36 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                          style={{
                            top: menuPos.top,
                            bottom: menuPos.bottom,
                            right: menuPos.right,
                          }}
                        >
                          <button
                            onClick={() => {
                              handleOpenModal(product);
                              setOpenProductMenu(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleOpenVendorModal(product);
                              setOpenProductMenu(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-gray-50"
                          >
                            Manage Vendors
                          </button>
                          <button
                            onClick={() => {
                              handleClone(product);
                              setOpenProductMenu(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs text-purple-600 hover:bg-gray-50"
                          >
                            Clone
                          </button>
                          <div className="border-t border-gray-100" />
                          <button
                            onClick={() => {
                              handleDelete(product.id);
                              setOpenProductMenu(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                    {/* Hover tooltip — shows full product details */}
                    {hoverProduct === product.id && (
                      <td
                        className="p-0 fixed z-50 pointer-events-none"
                        style={{
                          left: tooltipPos.left,
                          right: tooltipPos.right,
                          top: tooltipPos.top,
                          bottom: tooltipPos.bottom,
                        }}
                      >
                        <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-3 w-96 text-xs">
                          <div className="font-semibold text-gray-900 mb-1">
                            {product.name}
                          </div>
                          {product.description && (
                            <div className="text-gray-600 mb-2">
                              {product.description}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                            {product.modelNumber && (
                              <>
                                <span className="text-gray-500">Model:</span>
                                <span>{product.modelNumber}</span>
                              </>
                            )}
                            {manufacturer?.name && (
                              <>
                                <span className="text-gray-500">
                                  Manufacturer:
                                </span>
                                <span>{manufacturer.name}</span>
                              </>
                            )}
                            {product.category && (
                              <>
                                <span className="text-gray-500">Category:</span>
                                <span>{product.category}</span>
                              </>
                            )}
                            {product.unit && (
                              <>
                                <span className="text-gray-500">Unit:</span>
                                <span>{product.unit}</span>
                              </>
                            )}
                            {product.tier && (
                              <>
                                <span className="text-gray-500">Tier:</span>
                                <span className="capitalize">
                                  {product.tier}
                                </span>
                              </>
                            )}
                            {product.collection && (
                              <>
                                <span className="text-gray-500">
                                  Collection:
                                </span>
                                <span>{product.collection}</span>
                              </>
                            )}
                            {product.color && (
                              <>
                                <span className="text-gray-500">Color:</span>
                                <span>{product.color}</span>
                              </>
                            )}
                          </div>
                          {productVendorList.length > 0 && (
                            <div className="mt-2 border-t pt-2">
                              <div className="text-gray-500 mb-1">
                                Vendors &amp; Pricing:
                              </div>
                              {productVendorList.map((pv) => {
                                const v = vendors.find(
                                  (vv) => vv.id === pv.vendorId,
                                );
                                return (
                                  <div
                                    key={pv.id}
                                    className="flex justify-between items-center"
                                  >
                                    <span>
                                      {v?.name}
                                      {pv.isPrimary && (
                                        <span className="ml-1 text-yellow-600">
                                          ★
                                        </span>
                                      )}
                                      {pv.sku && (
                                        <span className="ml-1 text-gray-400">
                                          SKU: {pv.sku}
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium">
                                      ${pv.cost.toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="mt-2 flex gap-3">
                            {product.productUrl && (
                              <a
                                href={product.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pointer-events-auto text-indigo-600 hover:underline"
                              >
                                Product page ↗
                              </a>
                            )}
                            {product.imageUrl && (
                              <a
                                href={product.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pointer-events-auto text-indigo-600 hover:underline"
                              >
                                Image ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Manufacturer *
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      required
                      value={formData.manufacturerId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          manufacturerId: e.target.value,
                        })
                      }
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Manufacturer...</option>
                      {manufacturers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickAddMfr((v) => !v);
                        setQuickAddMfrName("");
                      }}
                      className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-md hover:bg-indigo-100"
                      title="Add new manufacturer"
                    >
                      +
                    </button>
                  </div>
                  {/* Quick-add manufacturer inline form */}
                  {showQuickAddMfr && (
                    <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="New manufacturer name..."
                        value={quickAddMfrName}
                        onChange={(e) => setQuickAddMfrName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!quickAddMfrName.trim() || quickAddMfrSaving)
                              return;
                            setQuickAddMfrSaving(true);
                            try {
                              const created =
                                await manufacturerService.createManufacturer({
                                  name: quickAddMfrName.trim(),
                                });
                              setManufacturers((prev) =>
                                [...prev, created].sort((a, b) =>
                                  a.name.localeCompare(b.name),
                                ),
                              );
                              setFormData((prev) => ({
                                ...prev,
                                manufacturerId: created.id,
                              }));
                              setShowQuickAddMfr(false);
                              setQuickAddMfrName("");
                            } catch {
                              // leave open on error
                            } finally {
                              setQuickAddMfrSaving(false);
                            }
                          }
                          if (e.key === "Escape") {
                            setShowQuickAddMfr(false);
                            setQuickAddMfrName("");
                          }
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        disabled={!quickAddMfrName.trim() || quickAddMfrSaving}
                        onClick={async () => {
                          if (!quickAddMfrName.trim() || quickAddMfrSaving)
                            return;
                          setQuickAddMfrSaving(true);
                          try {
                            const created =
                              await manufacturerService.createManufacturer({
                                name: quickAddMfrName.trim(),
                              });
                            setManufacturers((prev) =>
                              [...prev, created].sort((a, b) =>
                                a.name.localeCompare(b.name),
                              ),
                            );
                            setFormData((prev) => ({
                              ...prev,
                              manufacturerId: created.id,
                            }));
                            setShowQuickAddMfr(false);
                            setQuickAddMfrName("");
                          } catch {
                            // leave open on error
                          } finally {
                            setQuickAddMfrSaving(false);
                          }
                        }}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {quickAddMfrSaving ? "..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickAddMfr(false);
                          setQuickAddMfrName("");
                        }}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, modelNumber: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    list="product-categories"
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="product-categories">
                    <option value="Cabinets" />
                    <option value="Countertops" />
                    <option value="Doors" />
                    <option value="Electrical" />
                    <option value="Faucets" />
                    <option value="Floor Tile" />
                    <option value="Flooring" />
                    <option value="Hardware" />
                    <option value="HVAC" />
                    <option value="Lighting" />
                    <option value="Mirrors" />
                    <option value="Paint" />
                    <option value="Plumbing" />
                    <option value="Plumbing Fixtures" />
                    <option value="Shower" />
                    <option value="Tile" />
                    <option value="Trim" />
                    <option value="Vanity" />
                    <option value="Wall Tile" />
                    <option value="Windows" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ea">ea</option>
                    <option value="pc">pc</option>
                    <option value="case">case</option>
                    <option value="box">box</option>
                    <option value="bag">bag</option>
                    <option value="set">set</option>
                    <option value="doz">doz</option>
                    <option value="pair">pair</option>
                    <option value="roll">roll</option>
                    <option value="tube">tube</option>
                    <option value="gal">gal</option>
                    <option value="lbs">lbs</option>
                    <option value="sqft">sqft</option>
                    <option value="lnft">lnft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tier
                  </label>
                  <select
                    value={formData.tier}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tier: e.target.value as "" | "good" | "better" | "best",
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Not specified</option>
                    <option value="good">Good</option>
                    <option value="better">Better</option>
                    <option value="best">Best</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Collection
                  </label>
                  <input
                    type="text"
                    value={formData.collection}
                    onChange={(e) =>
                      setFormData({ ...formData, collection: e.target.value })
                    }
                    placeholder="e.g., Artisan Series, Pro Collection"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    list="product-colors"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    placeholder="e.g., White, Chrome, Brushed Nickel"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="product-colors">
                    <option value="White" />
                    <option value="Off-White" />
                    <option value="Almond" />
                    <option value="Bone" />
                    <option value="Biscuit" />
                    <option value="Black" />
                    <option value="Dark Bronze" />
                    <option value="Oil-Rubbed Bronze" />
                    <option value="Chrome" />
                    <option value="Brushed Nickel" />
                    <option value="Polished Nickel" />
                    <option value="Stainless Steel" />
                    <option value="Gold" />
                    <option value="Brushed Brass" />
                    <option value="Polished Brass" />
                    <option value="Gray" />
                    <option value="Slate" />
                    <option value="Charcoal" />
                    <option value="Beige" />
                    <option value="Tan" />
                    <option value="Brown" />
                    <option value="Espresso" />
                    <option value="Walnut" />
                    <option value="Natural" />
                    <option value="Clear" />
                  </datalist>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description (populates Material field on line items)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product URL
                  </label>
                  <input
                    type="url"
                    value={formData.productUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, productUrl: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {!editingProduct && (
                  <>
                    <div className="col-span-2 border-t pt-3">
                      <div className="text-xs font-semibold text-gray-700">
                        Primary Vendor (optional)
                      </div>
                      <div className="text-[11px] text-gray-500">
                        If selected, a Product Vendor relationship will be
                        created as PRIMARY.
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Primary Vendor
                      </label>
                      <select
                        value={primaryVendorId}
                        onChange={(e) => setPrimaryVendorId(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select Vendor...</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Vendor SKU
                      </label>
                      <input
                        type="text"
                        value={primaryVendorSku}
                        onChange={(e) => setPrimaryVendorSku(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Vendor Cost
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={primaryVendorCost}
                          onChange={(e) => setPrimaryVendorCost(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-600">
                          / {formData.unit || "ea"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {editingProduct && (
                  <div className="col-span-2 border-t pt-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">
                        Vendor Pricing
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Manage vendor relationships and pricing for this
                        product.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const prod = editingProduct;
                        handleCloseModal();
                        handleOpenVendorModal(prod);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
                    >
                      Manage Vendors →
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700"
                >
                  {editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Import Products from CSV
              </h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Upload a CSV file with the following columns:
                </p>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                  <li>manufacturerId (required)</li>
                  <li>name (required)</li>
                  <li>modelNumber</li>
                  <li>description</li>
                  <li>category</li>
                  <li>
                    unit (ea, case, box, bag, set, doz, pair, roll, tube, gal,
                    lbs, sqft, lnft)
                  </li>
                  <li>tier (good, better, best)</li>
                  <li>collection</li>
                  <li>imageUrl</li>
                  <li>productUrl</li>
                </ul>
              </div>
              <div className="mb-4">
                <button
                  onClick={downloadCsvTemplate}
                  className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                >
                  Download CSV Template
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Management Modal */}
      {isVendorModalOpen && managingProduct && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Manage Vendors - {managingProduct.name}
            </h2>
            <div className="space-y-3">
              {/* Add New Vendor */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="text-xs font-medium text-gray-700 mb-2">
                  Add Vendor
                </h3>
                <div className="grid grid-cols-12 gap-2">
                  <select
                    value={newVendor.vendorId}
                    onChange={(e) =>
                      setNewVendor({ ...newVendor, vendorId: e.target.value })
                    }
                    className="col-span-4 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Vendor...</option>
                    {vendors
                      .filter(
                        (v) =>
                          !productVendors.some((pv) => pv.vendorId === v.id),
                      )
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Vendor SKU"
                    value={newVendor.sku || ""}
                    onChange={(e) =>
                      setNewVendor({
                        ...newVendor,
                        sku: e.target.value,
                      })
                    }
                    className="col-span-3 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="text-xs text-gray-600">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      value={newVendor.cost || ""}
                      onChange={(e) =>
                        setNewVendor({
                          ...newVendor,
                          cost: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-600">
                      / {managingProduct?.unit || "ea"}
                    </span>
                  </div>
                  <button
                    onClick={handleAddVendor}
                    disabled={!newVendor.vendorId}
                    className="col-span-2 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Vendor List */}
              <div>
                <h3 className="text-xs font-medium text-gray-700 mb-2">
                  Current Vendors ({productVendors.length})
                </h3>
                {productVendors.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    No vendors assigned yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productVendors.map((pv) => {
                      const vendor = vendors.find((v) => v.id === pv.vendorId);
                      return (
                        <div
                          key={pv.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border ${
                            pv.isPrimary
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-900">
                                {vendor?.name || "Unknown Vendor"}
                              </span>
                              {pv.isPrimary && (
                                <span className="px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            {pv.sku && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                SKU: {pv.sku}
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="SKU"
                            value={pv.sku || ""}
                            onChange={(e) => {
                              // Update local state immediately for smooth typing
                              const updatedList = productVendors.map((item) =>
                                item.id === pv.id
                                  ? { ...item, sku: e.target.value }
                                  : item,
                              );
                              setProductVendors(updatedList);
                            }}
                            onBlur={(e) => handleUpdateSku(pv, e.target.value)}
                            className="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={pv.cost}
                              onChange={(e) => {
                                // Update local state immediately for smooth typing
                                const newCost = parseFloat(e.target.value) || 0;
                                const updatedList = productVendors.map(
                                  (item) =>
                                    item.id === pv.id
                                      ? { ...item, cost: newCost }
                                      : item,
                                );
                                setProductVendors(updatedList);
                              }}
                              onBlur={(e) =>
                                handleUpdateCost(
                                  pv,
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-500">
                              / {managingProduct?.unit || "ea"}
                            </span>
                          </div>
                          <button
                            onClick={() => handleTogglePrimary(pv)}
                            className={`px-3 py-1 text-xs font-medium rounded ${
                              pv.isPrimary
                                ? "bg-gray-200 text-gray-600"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            {pv.isPrimary ? "Primary" : "Set Primary"}
                          </button>
                          <button
                            onClick={() => handleDeleteVendor(pv.id)}
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={handleCloseVendorModal}
                  className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
