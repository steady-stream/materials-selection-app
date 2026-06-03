import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectService, salesforceService } from "../services";
import type {
    CreateProjectRequest,
    OpportunityDetails,
    SalesforceOpportunity,
    SalesforceOpportunityFilters,
    SalesforcePicklistOption,
    UpdateProjectRequest,
} from "../types";

const defaultOpportunityFilters: SalesforceOpportunityFilters = {
  selectionCoordinatorNeeded: true,
  stages: [],
};

const ProjectForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Salesforce integration state
  const [useSalesforce, setUseSalesforce] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [opportunities, setOpportunities] = useState<SalesforceOpportunity[]>(
    [],
  );
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [stageOptions, setStageOptions] = useState<SalesforcePicklistOption[]>(
    [],
  );
  const [opportunityFilters, setOpportunityFilters] =
    useState<SalesforceOpportunityFilters>(defaultOpportunityFilters);
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<OpportunityDetails | null>(null);

  useEffect(() => {
    if (isEditMode && id) {
      loadProject(id);
    }
  }, [id, isEditMode]);

  const loadProject = async (projectId: string) => {
    try {
      const project = await projectService.getById(projectId);
      setFormData({
        name: project.name,
        description: project.description,
      });
    } catch (err) {
      setError("Failed to load project");
      console.error("Error loading project:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && id) {
        await projectService.update(id, formData as UpdateProjectRequest);
      } else {
        await projectService.create(formData);
      }
      navigate("/");
    } catch (err) {
      setError(`Failed to ${isEditMode ? "update" : "create"} project`);
      console.error("Error saving project:", err);
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

  const handleToggleSalesforce = async () => {
    const newValue = !useSalesforce;
    setUseSalesforce(newValue);

    if (newValue) {
      if (opportunities.length === 0) {
        await loadStageOptions();
        await loadOpportunities();
      } else {
        setShowOpportunityModal(true);
      }
    }

    if (!newValue) {
      // Clear SF data when toggled off
      setSelectedOpportunity(null);
      setShowOpportunityModal(false);
    }
  };

  const loadOpportunities = async (
    filters: SalesforceOpportunityFilters = opportunityFilters,
  ) => {
    setLoadingOpportunities(true);
    setError(null);
    try {
      console.log("Loading Salesforce opportunities...");
      const opps = await salesforceService.getOpportunities(filters);
      console.log("Received opportunities:", opps);
      console.log("Opportunities count:", opps?.length || 0);

      setOpportunities(opps || []);
      setOpportunityFilters(filters);
      setShowOpportunityModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load Salesforce opportunities: ${errorMessage}`);
      console.error("Error loading opportunities:", err);
      setUseSalesforce(false);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  const loadStageOptions = async () => {
    try {
      const options = await salesforceService.getOpportunityStageOptions();
      setStageOptions(options);
    } catch (err) {
      console.error("Error loading Salesforce stage options:", err);
      setError("Failed to load Salesforce opportunity stages");
    }
  };

  const handleStageFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedStage = e.target.value;
    setOpportunityFilters((prev) => ({
      ...prev,
      stages: selectedStage ? [selectedStage] : [],
    }));
  };

  const filteredOpportunities = opportunities.filter((opportunity) =>
    opportunity.Name.toLowerCase().includes(opportunitySearch.toLowerCase()),
  );

  const handleSelectOpportunity = async (opportunityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const details =
        await salesforceService.getOpportunityDetails(opportunityId);
      setSelectedOpportunity(details);

      // Pre-populate form with SF data
      const address = [
        details.account.BillingStreet,
        details.account.BillingCity,
        details.account.BillingState,
        details.account.BillingPostalCode,
        details.account.BillingCountry,
      ]
        .filter(Boolean)
        .join(", ");

      setFormData((prev) => ({
        ...prev,
        name: details.opportunity.Name,
        customerName: details.contact.Name,
        email: details.contact.Email || "",
        phone: details.contact.Phone || "",
        mobilePhone: details.contact.MobilePhone || "",
        preferredContactMethod:
          details.contact.Preferred_Method_of_Contact__c || "",
        address: address,
        opportunityId: details.opportunity.Id,
      }));

      setShowOpportunityModal(false);
    } catch (err) {
      setError("Failed to load opportunity details");
      console.error("Error loading opportunity details:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {isEditMode ? "Edit Project" : "Create Project"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEditMode
              ? "Update the project information below."
              : "Create a new project to organize your materials selections."}
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

                {!isEditMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="useSalesforce"
                        checked={useSalesforce}
                        onChange={handleToggleSalesforce}
                        disabled={loadingOpportunities}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="useSalesforce"
                        className="ml-3 block text-sm font-medium text-gray-700"
                      >
                        Create from Salesforce Opportunity
                      </label>
                    </div>
                    {selectedOpportunity && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Selected:</strong>{" "}
                        {selectedOpportunity.opportunity.Name} (
                        {selectedOpportunity.opportunity.StageName})
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Project Name
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
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 space-x-3">
                <button
                  type="button"
                  onClick={() => navigate("/")}
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

      {/* Salesforce Opportunity Selection Modal */}
      {showOpportunityModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowOpportunityModal(false)}
            />

            <div className="inline-block bg-white rounded-lg text-left shadow-xl sm:my-8 sm:max-w-4xl w-full p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Select Salesforce Opportunity
              </h3>

              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={
                        opportunityFilters.selectionCoordinatorNeeded ?? true
                      }
                      onChange={(e) =>
                        setOpportunityFilters((prev) => ({
                          ...prev,
                          selectionCoordinatorNeeded: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Selection Coordinator Needed
                  </label>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Stage filter
                    </label>
                    <select
                      value={opportunityFilters.stages?.[0] || ""}
                      onChange={handleStageFilterChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All stages</option>
                      {stageOptions.map((stageOption) => (
                        <option
                          key={stageOption.value}
                          value={stageOption.value}
                        >
                          {stageOption.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadOpportunities(opportunityFilters)}
                    disabled={loadingOpportunities}
                    className="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingOpportunities ? "Loading..." : "Apply"}
                  </button>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Search name
                  </label>
                  <input
                    type="text"
                    value={opportunitySearch}
                    onChange={(e) => setOpportunitySearch(e.target.value)}
                    placeholder="Search opportunity name"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOpportunities.length > 0 ? (
                      filteredOpportunities.map((opp, index) => (
                        <tr key={opp.Id || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {opp.Name || "No Name"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {opp.StageName || "No Stage"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              type="button"
                              onClick={() => handleSelectOpportunity(opp.Id)}
                              disabled={loading}
                              className="text-indigo-600 hover:text-indigo-900 font-medium disabled:opacity-50"
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center py-4 text-sm text-gray-500"
                        >
                          {opportunities.length === 0
                            ? "No opportunities found for the current Salesforce filters"
                            : "No opportunities match the current name search"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 px-4 py-3 mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpportunityModal(false);
                    setUseSalesforce(false);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectForm;
