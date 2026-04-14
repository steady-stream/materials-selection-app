import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { projectService } from "../services";
import type { ReviewData, ReviewLineItem } from "../types";

// Groups line items by their category for display
function groupByCategory(lineItems: ReviewLineItem[], categories: ReviewData["categories"]) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const groups: Record<string, { category: (typeof categories)[0]; items: ReviewLineItem[] }> = {};

  lineItems.forEach((li) => {
    const catId = li.categoryId;
    if (!groups[catId]) {
      groups[catId] = { category: catMap[catId] ?? { id: catId, name: "Uncategorized" } as any, items: [] };
    }
    groups[catId].items.push(li);
  });

  // Return in insertion order (categories come back in DB order)
  return Object.values(groups);
}

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

// ---- PIN Entry screen -------------------------------------------------------
interface PinEntryProps {
  onSubmit: (pin: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

function PinEntry({ onSubmit, error, loading }: PinEntryProps) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) onSubmit(pin);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow border border-gray-200 w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-base font-semibold text-gray-800">MegaPros</h1>
          <p className="text-xs text-gray-500 mt-1">Project Review</p>
        </div>

        <p className="text-xs text-gray-600 text-center mb-5">
          Enter the 4-digit PIN provided by your MegaPros contact to view this project.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Access PIN</label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="• • • •"
              autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying…" : "View Project"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Review content ---------------------------------------------------------
function ReviewContent({ data }: { data: ReviewData }) {
  const { project, lineItems, categories } = data;
  const groups = groupByCategory(lineItems, categories);

  const expiresFormatted = data.expiresAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(data.expiresAt))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">MegaPros</span>
            <h1 className="text-sm font-semibold text-gray-800 mt-0.5">{project.name}</h1>
          </div>
          {expiresFormatted && (
            <span className="text-xs text-gray-400">Link valid until {expiresFormatted}</span>
          )}
        </div>
      </div>

      {/* Project info */}
      <div className="max-w-4xl mx-auto px-6 py-5">
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Project Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ["Customer", project.customerName],
              ["Project #", project.projectNumber],
              ["Address", project.address],
              ["Email", project.email],
              ["Phone", project.phone],
              ["Type", project.type],
              ["Status", project.status],
              ["Est. Start", project.estimatedStartDate],
            ]
              .filter(([, val]) => val)
              .map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-xs text-gray-800 font-medium">{val}</p>
                </div>
              ))}
          </div>
          {project.description && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">Description</p>
              <p className="text-xs text-gray-700 mt-0.5">{project.description}</p>
            </div>
          )}
        </div>

        {/* Categories + line items */}
        {groups.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-10">No materials selections have been added yet.</p>
        ) : (
          <div className="space-y-5">
            {groups.map(({ category, items }) => (
              <div key={category.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Category header */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                  <h3 className="text-xs font-semibold text-gray-700">{category.name}</h3>
                  {category.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{category.description}</p>
                  )}
                </div>

                {/* Line items table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left px-4 py-2 font-medium">Item</th>
                        <th className="text-left px-4 py-2 font-medium">Selected Product</th>
                        <th className="text-left px-4 py-2 font-medium">Manufacturer</th>
                        <th className="text-left px-4 py-2 font-medium">Vendor</th>
                        <th className="text-right px-4 py-2 font-medium">Qty</th>
                        <th className="text-right px-4 py-2 font-medium">Unit Price</th>
                        <th className="text-right px-4 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((li) => (
                        <React.Fragment key={li.id}>
                          {/* Primary selection row */}
                          <tr className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-2 font-medium text-gray-800">{li.name}</td>
                            <td className="px-4 py-2 text-gray-700">
                              {li.product?.name ?? <span className="text-gray-300">—</span>}
                              {li.product?.modelNumber && (
                                <span className="text-gray-400 ml-1">({li.product.modelNumber})</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{li.manufacturer?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-gray-600">{li.vendor?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {li.quantity != null ? `${li.quantity}${li.unit ? ` ${li.unit}` : ""}` : "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {formatCurrency(li.unitCost)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-800">
                              {li.totalCost != null
                                ? formatCurrency(li.totalCost)
                                : "—"}
                            </td>
                          </tr>

                          {/* Alternate options rows */}
                          {li.options?.map(({ option, product, manufacturer }) => (
                            <tr key={option.id} className="border-b border-gray-50 bg-blue-50/30">
                              <td className="px-4 py-1.5 pl-8 text-gray-400 italic">Alt. option</td>
                              <td className="px-4 py-1.5 text-gray-600">
                                {product.name}
                                {product.modelNumber && (
                                  <span className="text-gray-400 ml-1">({product.modelNumber})</span>
                                )}
                              </td>
                              <td className="px-4 py-1.5 text-gray-500">{manufacturer?.name ?? "—"}</td>
                              <td className="px-4 py-1.5 text-gray-400">—</td>
                              <td className="px-4 py-1.5 text-right text-gray-500">
                                {li.quantity != null ? `${li.quantity}${li.unit ? ` ${li.unit}` : ""}` : "—"}
                              </td>
                              <td className="px-4 py-1.5 text-right text-gray-500">
                                {formatCurrency(option.unitCost)}
                              </td>
                              <td className="px-4 py-1.5 text-right text-gray-500">
                                {li.quantity != null && option.unitCost != null
                                  ? formatCurrency(li.quantity * option.unitCost)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-8 pb-6">
          This is a read-only view. Contact your MegaPros representative with any questions.
        </p>
      </div>
    </div>
  );
}

// ---- Main export ------------------------------------------------------------
export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const data = await projectService.getReviewData(token, pin);
      setReviewData(data);
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;

      if (status === 401) {
        const remaining = body?.attemptsRemaining;
        setError(
          remaining != null
            ? `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
            : "Incorrect PIN.",
        );
      } else if (status === 429) {
        const until = body?.lockedUntil
          ? new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(body.lockedUntil))
          : "a while";
        setError(`Too many incorrect attempts. Please try again after ${until}.`);
      } else if (status === 410) {
        setFatalError("This review link has expired. Please contact your MegaPros representative for a new link.");
      } else if (status === 404) {
        setFatalError("This review link was not found. It may have been revoked.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fatal errors — can't recover with a PIN retry
  if (fatalError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 w-full max-w-sm p-8 text-center">
          <h1 className="text-base font-semibold text-gray-800 mb-2">MegaPros</h1>
          <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 mt-4">
            <p className="text-xs text-amber-800">{fatalError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (reviewData) {
    return <ReviewContent data={reviewData} />;
  }

  return <PinEntry onSubmit={handlePinSubmit} error={error} loading={loading} />;
}
