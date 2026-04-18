import React, { useEffect, useState } from "react";
import { lineItemOptionService, lineItemService } from "../services";
import type {
    CreateLineItemOptionRequest,
    LineItem,
    LineItemOption,
    Manufacturer,
    Product,
    ProductVendor,
    Vendor,
} from "../types";

interface ChooseOptionsModalProps {
  lineItem: LineItem;
  products: Product[];
  manufacturers: Manufacturer[];
  vendors: Vendor[];
  productVendors: ProductVendor[];
  onClose: () => void;
  onOptionsChanged: () => void;
}

export const ChooseOptionsModal: React.FC<ChooseOptionsModalProps> = ({
  lineItem,
  products,
  manufacturers,
  vendors,
  productVendors,
  onClose,
  onOptionsChanged,
}) => {
  // Filter states (for available products)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVendorId, setFilterVendorId] = useState("");
  const [filterManufacturerId, setFilterManufacturerId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCollection, setFilterCollection] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterFinish, setFilterFinish] = useState("");
  const [filterTier, setFilterTier] = useState({
    good: false,
    better: false,
    best: false,
  });

  // Hover state for product tooltip
  const [hoverProduct, setHoverProduct] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  }>({});

  // Selected options state
  const [selectedOptions, setSelectedOptions] = useState<LineItemOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Load existing options
  useEffect(() => {
    loadOptions();
  }, [lineItem.id]);

  const loadOptions = async () => {
    try {
      setLoading(true);
      const options = await lineItemOptionService.getByLineItemId(lineItem.id);
      setSelectedOptions(options);
    } catch (error) {
      console.error("Error loading options:", error);
    } finally {
      setLoading(false);
    }
  };

  // Add product as option
  const handleAddOption = async (product: Product) => {
    try {
      // Get primary vendor cost
      const productVendorList = productVendors.filter(
        (pv) => pv.productId === product.id,
      );
      const primaryPV =
        productVendorList.find((pv) => pv.isPrimary) || productVendorList[0];

      if (!primaryPV) {
        alert("No vendor cost available for this product");
        return;
      }

      const optionData: CreateLineItemOptionRequest = {
        productId: product.id,
        unitCost: primaryPV.cost,
      };

      await lineItemOptionService.create(lineItem.id, optionData);
      await loadOptions();
      onOptionsChanged();
    } catch (error) {
      console.error("Error adding option:", error);
      alert("Failed to add option");
    }
  };

  // Remove option
  const handleRemoveOption = async (optionId: string) => {
    try {
      await lineItemOptionService.delete(optionId);
      await loadOptions();
      onOptionsChanged();
    } catch (error) {
      console.error("Error removing option:", error);
      alert("Failed to remove option");
    }
  };

  // Select option as the line item's product
  const handleSelectOption = async (option: LineItemOption) => {
    try {
      const product = products.find((p) => p.id === option.productId);
      if (!product) {
        alert("Product not found");
        return;
      }

      // Get primary vendor for this product
      const productVendorList = productVendors.filter(
        (pv) => pv.productId === product.id,
      );
      const primaryPV =
        productVendorList.find((pv) => pv.isPrimary) || productVendorList[0];

      // Use the new selectOption endpoint that handles everything
      await lineItemOptionService.selectOption(lineItem.id, {
        productId: product.id,
        unitCost: option.unitCost,
      });

      // Update line item with selected product (for denormalized cache)
      await lineItemService.update(lineItem.id, {
        productId: product.id,
        modelNumber: product.modelNumber,
        manufacturerId: product.manufacturerId,
        vendorId: primaryPV?.vendorId,
        unitCost: option.unitCost,
        unit: product.unit || "",
        material: product.description || "",
      });

      // Refresh
      await loadOptions();
      onOptionsChanged();
    } catch (error) {
      console.error("Error selecting option:", error);
      alert("Failed to select option");
    }
  };

  // Select a product option and immediately mark the line item as "final"
  const handleSelectOptionAsFinal = async (option: LineItemOption) => {
    try {
      const product = products.find((p) => p.id === option.productId);
      if (!product) {
        alert("Product not found");
        return;
      }

      const productVendorList = productVendors.filter(
        (pv) => pv.productId === product.id,
      );
      const primaryPV =
        productVendorList.find((pv) => pv.isPrimary) || productVendorList[0];

      await lineItemOptionService.selectOption(lineItem.id, {
        productId: product.id,
        unitCost: option.unitCost,
      });

      // Set status to "final" instead of "selected"
      await lineItemService.update(lineItem.id, {
        productId: product.id,
        modelNumber: product.modelNumber,
        manufacturerId: product.manufacturerId,
        vendorId: primaryPV?.vendorId,
        unitCost: option.unitCost,
        unit: product.unit || "",
        material: product.description || "",
        status: "final",
      });

      await loadOptions();
      onOptionsChanged();
    } catch (error) {
      console.error("Error selecting option as final:", error);
      alert("Failed to select option as final");
    }
  };

  // Deselect the current option
  const handleDeselectOption = async (option: LineItemOption) => {
    try {
      // Update option to not selected
      await lineItemOptionService.update(option.id, { isSelected: false });

      // Clear line item product selection
      await lineItemService.update(lineItem.id, {
        productId: null,
        modelNumber: null,
        manufacturerId: null,
        vendorId: null,
        unitCost: 0,
        unit: "",
        material: "",
      });

      // Refresh
      await loadOptions();
      onOptionsChanged();
    } catch (error) {
      console.error("Error deselecting option:", error);
      alert("Failed to deselect option");
    }
  };

  // Check if product is already an option
  const isProductSelected = (productId: string) => {
    return selectedOptions.some((opt) => opt.productId === productId);
  };

  // Filter products
  const getFilteredProducts = () => {
    let filtered = products;

    // Search term filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        if (
          p.name.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search) ||
          p.modelNumber?.toLowerCase().includes(search)
        ) {
          return true;
        }
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
        if (p.tier === "good" && !filterTier.good) return false;
        if (p.tier === "better" && !filterTier.better) return false;
        if (p.tier === "best" && !filterTier.best) return false;
        return true;
      });
    }

    // Collection filter
    if (filterCollection) {
      const collectionSearch = filterCollection.toLowerCase();
      filtered = filtered.filter((p) =>
        p.collection?.toLowerCase().includes(collectionSearch),
      );
    }

    // Color filter
    if (filterColor) {
      filtered = filtered.filter((p) => p.color === filterColor);
    }

    // Finish filter
    if (filterFinish) {
      filtered = filtered.filter((p) => p.finish === filterFinish);
    }

    // Vendor filter
    if (filterVendorId) {
      const productIdsForVendor = productVendors
        .filter((pv) => pv.vendorId === filterVendorId)
        .map((pv) => pv.productId);
      filtered = filtered.filter((p) => productIdsForVendor.includes(p.id));
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Choose Line Item Options
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Line Item Details */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs text-gray-700">
            <span className="font-medium">{lineItem.name}</span>
            {" • "}
            <span>Qty: {lineItem.quantity}</span>
            {lineItem.allowance !== undefined && lineItem.allowance > 0 && (
              <>
                {" • "}
                <span>Allowance: ${lineItem.allowance.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>

        {/* Selected Options Section */}
        {!loading && selectedOptions.length > 0 && (
          <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-900 mb-2">
              Selected Options ({selectedOptions.length})
            </h4>
            <div className="border rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
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
                      Tier
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                      Vendor(s)
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                      Cost
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                      Unit
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedOptions.map((option) => {
                    const product = products.find(
                      (p) => p.id === option.productId,
                    );
                    const manufacturer = product
                      ? manufacturers.find(
                          (m) => m.id === product.manufacturerId,
                        )
                      : null;
                    const productVendorList = product
                      ? productVendors.filter(
                          (pv) => pv.productId === product.id,
                        )
                      : [];
                    const primaryPV =
                      productVendorList.find((pv) => pv.isPrimary) ||
                      productVendorList[0];

                    return (
                      <tr
                        key={option.id}
                        className={option.isSelected ? "bg-green-50" : ""}
                      >
                        <td className="px-3 py-2 text-xs text-gray-900">
                          <div className="flex items-center gap-2">
                            {option.isSelected && (
                              <span className="text-green-600 font-bold">
                                ✓
                              </span>
                            )}
                            <div>
                              <div className="font-medium">
                                {product?.name || "Unknown Product"}
                              </div>
                              {product?.description && (
                                <div className="text-gray-500 truncate max-w-xs">
                                  {product.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {product?.modelNumber || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {manufacturer?.name || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {product?.tier ? (
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
                                    <span>{vendor?.name}</span>
                                    {pv.isPrimary && (
                                      <span className="text-yellow-600">★</span>
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
                          $
                          {primaryPV
                            ? primaryPV.cost.toFixed(2)
                            : option.unitCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {product?.unit || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex gap-2">
                            {option.isSelected ? (
                              <button
                                onClick={() => handleDeselectOption(option)}
                                className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700"
                              >
                                Deselect
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSelectOption(option)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                >
                                  Select
                                </button>
                                <button
                                  onClick={() =>
                                    handleSelectOptionAsFinal(option)
                                  }
                                  className="bg-teal-600 text-white px-3 py-1 rounded text-xs hover:bg-teal-700"
                                >
                                  Final
                                </button>
                                <button
                                  onClick={() => handleRemoveOption(option.id)}
                                  className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filter Section */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, model, SKU..."
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
                Category
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
            </div>{" "}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Color
              </label>
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Colors</option>
                {Array.from(
                  new Set(products.map((p) => p.color).filter(Boolean)),
                )
                  .sort()
                  .map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
              </select>
            </div>{" "}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Finish
              </label>
              <select
                value={filterFinish}
                onChange={(e) => setFilterFinish(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Finishes</option>
                {Array.from(
                  new Set(products.map((p) => p.finish).filter(Boolean)),
                )
                  .sort()
                  .map((finish) => (
                    <option key={finish} value={finish}>
                      {finish}
                    </option>
                  ))}
              </select>
            </div>{" "}
          </div>

          {/* Tier Checkboxes */}
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

        {/* Available Products Table */}
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
                    Tier
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                    Vendor(s)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                    Cost
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                    Unit
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const manufacturer = manufacturers.find(
                      (m) => m.id === product.manufacturerId,
                    );
                    const productVendorList = productVendors.filter(
                      (pv) => pv.productId === product.id,
                    );
                    const primaryPV =
                      productVendorList.find((pv) => pv.isPrimary) ||
                      productVendorList[0];
                    const alreadySelected = isProductSelected(product.id);

                    return (
                      <tr
                        key={product.id}
                        className={`relative ${
                          alreadySelected ? "bg-green-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-900">
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-gray-500 truncate max-w-xs">
                              {product.description}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-xs text-gray-600 cursor-help"
                          onMouseEnter={(e) => {
                            setHoverProduct(product.id);
                            const spaceRight = window.innerWidth - e.clientX;
                            const spaceBelow = window.innerHeight - e.clientY;
                            setTooltipPos({
                              left:
                                spaceRight >= 336 ? e.clientX + 16 : undefined,
                              right:
                                spaceRight < 336
                                  ? window.innerWidth - e.clientX + 16
                                  : undefined,
                              top:
                                spaceBelow >= 280 ? e.clientY + 16 : undefined,
                              bottom:
                                spaceBelow < 280
                                  ? window.innerHeight - e.clientY + 16
                                  : undefined,
                            });
                          }}
                          onMouseLeave={() => setHoverProduct(null)}
                        >
                          {product.modelNumber || "-"}
                          {hoverProduct === product.id && (
                            <div
                              className="fixed z-50 pointer-events-none"
                              style={{
                                left: tooltipPos.left,
                                right: tooltipPos.right,
                                top: tooltipPos.top,
                                bottom: tooltipPos.bottom,
                              }}
                            >
                              <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-3 w-80 text-xs">
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
                                      <span className="text-gray-500">
                                        Model:
                                      </span>
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
                                      <span className="text-gray-500">
                                        Category:
                                      </span>
                                      <span>{product.category}</span>
                                    </>
                                  )}
                                  {product.color && (
                                    <>
                                      <span className="text-gray-500">
                                        Color:
                                      </span>
                                      <span>{product.color}</span>
                                    </>
                                  )}
                                  {product.finish && (
                                    <>
                                      <span className="text-gray-500">
                                        Finish:
                                      </span>
                                      <span>{product.finish}</span>
                                    </>
                                  )}
                                  {product.tier && (
                                    <>
                                      <span className="text-gray-500">
                                        Tier:
                                      </span>
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
                                  {product.unit && (
                                    <>
                                      <span className="text-gray-500">
                                        Unit:
                                      </span>
                                      <span>{product.unit}</span>
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
                                          </span>
                                          <span className="font-medium">
                                            ${pv.cost.toFixed(2)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {manufacturer?.name || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {product.category || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
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
                                      <span className="text-yellow-600">★</span>
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
                          {primaryPV ? `$${primaryPV.cost.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {product.unit || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {alreadySelected ? (
                            <span className="text-green-600 font-medium">
                              ✓ Added
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddOption(product)}
                              disabled={!primaryPV}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-xs text-gray-500"
                    >
                      No products found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
