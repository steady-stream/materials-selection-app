import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { categoryService } from "../services";
import type { CreateCategoryRequest, UpdateCategoryRequest } from "../types";

const CategoryForm = () => {
  const { projectId, categoryId } = useParams<{
    projectId: string;
    categoryId: string;
  }>();
  const navigate = useNavigate();
  const isEditMode = !!categoryId;

  const [formData, setFormData] = useState<CreateCategoryRequest>({
    projectId: projectId || "",
    name: "",
    description: "",
    allowance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && categoryId) {
      loadCategory(categoryId);
    }
  }, [categoryId, isEditMode]);

  const loadCategory = async (id: string) => {
    try {
      const category = await categoryService.getById(id);
      setFormData({
        projectId: category.projectId,
        name: category.name,
        description: category.description,
        allowance: category.allowance || 0,
      });
    } catch (err) {
      setError("Failed to load category");
      console.error("Error loading category:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && categoryId) {
        await categoryService.update(
          categoryId,
          formData as UpdateCategoryRequest,
        );
        navigate(`/projects/${formData.projectId}`);
      } else {
        await categoryService.create(formData);
        navigate(`/projects/${projectId}`);
      }
    } catch (err) {
      setError(`Failed to ${isEditMode ? "update" : "create"} section`);
      console.error("Error saving section:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {isEditMode ? "Edit Section" : "Create Section"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEditMode
              ? "Update the section information below."
              : "Create a new section to organize your materials."}
          </p>
        </div>
        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="shadow sm:rounded-md sm:overflow-hidden">
              <div className="px-4 py-5 bg-white space-y-6 sm:p-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Section Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    required
                    value={formData.description}
                    onChange={handleChange}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>

                <div>
                  <label
                    htmlFor="allowance"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Allowance
                  </label>
                  <input
                    type="number"
                    name="allowance"
                    id="allowance"
                    step="1"
                    value={formData.allowance}
                    onChange={handleChange}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${formData.projectId}`)}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? "Saving..." : isEditMode ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CategoryForm;
