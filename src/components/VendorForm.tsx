import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vendorService } from "../services";
import type { CreateVendorRequest, UpdateVendorRequest } from "../types";

const VendorForm = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const isEditMode = !!vendorId;

  const [formData, setFormData] = useState<CreateVendorRequest>({
    name: "",
    contactInfo: "",
    website: undefined,
    taxRate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && vendorId) {
      loadVendor(vendorId);
    }
  }, [vendorId, isEditMode]);

  const loadVendor = async (id: string) => {
    try {
      const vendor = await vendorService.getVendor(id);
      setFormData({
        name: vendor.name,
        contactInfo: vendor.contactInfo || "",
        website: vendor.website,
        taxRate: vendor.taxRate ?? 0,
      });
    } catch (err) {
      setError("Failed to load vendor");
      console.error("Error loading vendor:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && vendorId) {
        await vendorService.updateVendor(
          vendorId,
          formData as UpdateVendorRequest,
        );
      } else {
        await vendorService.createVendor(formData);
      }
      navigate("/vendors");
    } catch (err) {
      setError(`Failed to ${isEditMode ? "update" : "create"} vendor`);
      console.error("Error saving vendor:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : value,
    }));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {isEditMode ? "Edit Vendor" : "Create Vendor"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEditMode
              ? "Update vendor information."
              : "Add a new vendor to your list."}
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
                    Vendor Name
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
                    htmlFor="contactInfo"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Contact Information
                  </label>
                  <textarea
                    id="contactInfo"
                    name="contactInfo"
                    rows={3}
                    value={formData.contactInfo}
                    onChange={handleChange}
                    placeholder="Phone, email, address, etc."
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>

                <div>
                  <label
                    htmlFor="taxRate"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    name="taxRate"
                    id="taxRate"
                    min="0"
                    step="0.01"
                    value={formData.taxRate ?? 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        taxRate: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>

                <div>
                  <label
                    htmlFor="website"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    id="website"
                    value={formData.website || ""}
                    onChange={handleChange}
                    placeholder="https://example.com"
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 space-x-3">
                <button
                  type="button"
                  onClick={() => navigate("/vendors")}
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

export default VendorForm;
