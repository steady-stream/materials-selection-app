import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { categoryService, lineItemService } from "../services";
import type { Category, LineItem } from "../types";

const CategoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortLineItemsForDisplay = (items: LineItem[]) => {
    return [...items].sort((a, b) => {
      const aSeq =
        typeof a.sequence === "number" ? a.sequence : Number.MAX_SAFE_INTEGER;
      const bSeq =
        typeof b.sequence === "number" ? b.sequence : Number.MAX_SAFE_INTEGER;
      if (aSeq !== bSeq) return aSeq - bSeq;

      const aTime = Date.parse(a.createdAt || "") || 0;
      const bTime = Date.parse(b.createdAt || "") || 0;
      if (aTime !== bTime) return aTime - bTime;

      return a.id.localeCompare(b.id);
    });
  };

  useEffect(() => {
    if (id) {
      loadCategoryData(id);
    }
  }, [id]);

  const loadCategoryData = async (categoryId: string) => {
    try {
      setLoading(true);
      const [categoryData, lineItemsData] = await Promise.all([
        categoryService.getById(categoryId),
        lineItemService.getByCategoryId(categoryId),
      ]);
      setCategory(categoryData);
      setLineItems(sortLineItemsForDisplay(lineItemsData));
      setError(null);
    } catch (err) {
      setError("Failed to load section details");
      console.error("Error loading section:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLineItem = async (lineItemId: string) => {
    if (!confirm("Are you sure you want to delete this line item?")) return;

    try {
      await lineItemService.delete(lineItemId);
      setLineItems(
        sortLineItemsForDisplay(lineItems.filter((li) => li.id !== lineItemId)),
      );
    } catch (err) {
      alert("Failed to delete line item");
      console.error("Error deleting line item:", err);
    }
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.totalCost, 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading section...</div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error || "Section not found"}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to={`/projects/${category.projectId}`}
          className="text-indigo-600 hover:text-indigo-900"
        >
          ← Back to Project
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {category.name}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {category.description}
          </p>
        </div>
      </div>

      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-xl font-semibold text-gray-900">Line Items</h2>
          <p className="mt-2 text-sm text-gray-700">
            Material line items for this section.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to={`/categories/${id}/lineitems/new`}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add Line Item
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Material
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Quantity
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Unit Cost
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Total Cost
                    </th>
                    <th
                      scope="col"
                      className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-sm text-gray-500 text-center"
                      >
                        No line items found. Add a line item to get started.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {item.name}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-500">
                            {item.material}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            ${item.unitCost.toFixed(2)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            ${item.totalCost.toFixed(2)}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <Link
                              to={`/lineitems/${item.id}/edit`}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteLineItem(item.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-sm font-bold text-gray-900 text-right"
                        >
                          Total:
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                          ${calculateTotal().toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryDetail;
