import { useEffect, useState } from "react";
import { vendorService } from "../services";
import type { Vendor } from "../types";

const VendorList = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactInfo: "",
    website: "",
    taxRate: 0,
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const data = await vendorService.getAllVendors();
      setVendors(data);
    } catch (err) {
      setError("Failed to load vendors");
      console.error("Error loading vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        name: vendor.name,
        contactInfo: vendor.contactInfo || "",
        website: vendor.website || "",
        taxRate: vendor.taxRate ?? 0,
      });
    } else {
      setEditingVendor(null);
      setFormData({
        name: "",
        contactInfo: "",
        website: "",
        taxRate: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVendor(null);
    setFormData({
      name: "",
      contactInfo: "",
      website: "",
      taxRate: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendor) {
        const updated = await vendorService.updateVendor(
          editingVendor.id,
          formData,
        );
        setVendors(vendors.map((v) => (v.id === updated.id ? updated : v)));
      } else {
        const created = await vendorService.createVendor(formData);
        setVendors([...vendors, created]);
      }
      handleCloseModal();
    } catch (err) {
      setError("Failed to save vendor");
      console.error("Error saving vendor:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) return;

    try {
      await vendorService.deleteVendor(id);
      setVendors(vendors.filter((v) => v.id !== id));
    } catch (err) {
      setError("Failed to delete vendor");
      console.error("Error deleting vendor:", err);
    }
  };

  if (loading) return <div className="px-4 py-8">Loading vendors...</div>;
  if (error) return <div className="px-4 py-8 text-red-600">{error}</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-lg font-semibold text-gray-900">Vendors</h1>
          <p className="mt-1 text-xs text-gray-600">
            Manage your vendor list for material sourcing
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Vendor
          </button>
        </div>
      </div>
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 pl-3 pr-2 text-left text-xs font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">
                      Contact Info
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">
                      Website
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">
                      Tax Rate
                    </th>
                    <th className="relative py-2 pl-2 pr-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {vendors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-xs text-gray-500"
                      >
                        No vendors found. Create your first vendor to get
                        started.
                      </td>
                    </tr>
                  ) : (
                    vendors.map((vendor) => (
                      <tr key={vendor.id}>
                        <td className="py-1 pl-3 pr-2 text-xs font-medium text-gray-900">
                          {vendor.name}
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-500">
                          {vendor.contactInfo || "-"}
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-500">
                          {vendor.website ? (
                            <a
                              href={vendor.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Visit
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-500">
                          {(vendor.taxRate ?? 0).toFixed(2)}%
                        </td>
                        <td className="relative py-1 pl-2 pr-3 text-right text-xs font-medium space-x-2">
                          <button
                            onClick={() => handleOpenModal(vendor)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(vendor.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              {editingVendor ? "Edit Vendor" : "Create Vendor"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contact Information
                </label>
                <textarea
                  value={formData.contactInfo}
                  onChange={(e) =>
                    setFormData({ ...formData, contactInfo: e.target.value })
                  }
                  rows={3}
                  placeholder="Phone, email, address, etc."
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      taxRate: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://example.com"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
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
                  {editingVendor ? "Update Vendor" : "Create Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorList;
