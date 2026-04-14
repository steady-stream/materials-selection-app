import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { projectService } from "../services";
import type { ReviewData, ReviewLineItem, LineItemOption, Product, Manufacturer } from "../types";

// ---- Utilities ---------------------------------------------------------------

type CategoryGroup = {
  category: ReviewData["categories"][0];
  items: ReviewLineItem[];
};

function groupByCategory(
  lineItems: ReviewLineItem[],
  categories: ReviewData["categories"],
): CategoryGroup[] {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const groups: Record<string, CategoryGroup> = {};

  lineItems.forEach((li) => {
    const catId = li.categoryId;
    if (!groups[catId]) {
      groups[catId] = {
        category: catMap[catId] ?? ({ id: catId, name: "Uncategorized" } as any),
        items: [],
      };
    }
    groups[catId].items.push(li);
  });

  return Object.values(groups);
}

function fmt(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

// Color-coded status badge matching PPT conventions
function StatusBadge({ status, tier }: { status?: string | null; tier?: string | null }) {
  const s = (status ?? "selected").toLowerCase();
  let colorClass = "bg-[#1F4788]";
  if (s === "installed")           colorClass = "bg-[#2D9F48]";
  else if (s === "ordered")        colorClass = "bg-[#2B579A]";
  else if (s === "received")       colorClass = "bg-[#7E3BA6]";
  else if (s === "part recvd")     colorClass = "bg-[#7E3BA6]";
  else if (s === "final")          colorClass = "bg-[#0D9488]";
  else if (s === "no selection")   colorClass = "bg-[#DC2626]";
  else if (s.startsWith("option")) colorClass = "bg-[#D97706]";

  const tierLabel = tier ? ` · ${tier.toUpperCase()}` : "";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold text-white whitespace-nowrap ${colorClass}`}>
      {status ?? "Selected"}{tierLabel}
    </span>
  );
}

// ---- PIN Entry ---------------------------------------------------------------

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
    <div className="min-h-screen flex" style={{ background: "#1F4788" }}>
      {/* Left navy panel — brand */}
      <div className="hidden md:flex flex-col justify-between w-64 p-10 flex-shrink-0">
        <div>
          <img
            src="/MegaProsLogo.png"
            alt="MegaPros"
            className="h-8 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <p className="text-blue-300 text-xs mt-3 leading-relaxed">
            Materials Selection<br />Review Portal
          </p>
        </div>
        <p className="text-blue-400 text-xs">© MegaPros</p>
      </div>

      {/* Right white card area */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-6">
            <img src="/MegaProsLogo.png" alt="MegaPros" className="h-7 w-auto mx-auto" />
          </div>

          <h2 className="text-base font-bold text-gray-900 mb-1">Project Review</h2>
          <p className="text-xs text-gray-500 mb-6">
            Enter the 4-digit PIN provided by your MegaPros representative to access this project review.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Access PIN
              </label>
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
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl tracking-[0.75em] text-center font-mono focus:outline-none focus:border-[#1F4788] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || loading}
              className="w-full text-white text-sm font-bold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ background: "#1F4788" }}
            >
              {loading ? "Verifying…" : "View Project"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---- Product card -----------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-gray-700 leading-relaxed">{value}</span>
    </div>
  );
}

interface OptionEntry {
  option: LineItemOption;
  product: Product;
  manufacturer: Manufacturer | null;
}

function AlternateOptions({ options, parentQty, unit }: {
  options: OptionEntry[];
  parentQty: number;
  unit: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-amber-700">
          {options.length} Alternative Option{options.length !== 1 ? "s" : ""} Considered
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2.5">
          {options.map(({ option, product, manufacturer }) => (
            <div
              key={option.id}
              className="flex items-start justify-between gap-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">{product.name}</p>
                {product.modelNumber && (
                  <p className="text-xs text-gray-400 mt-0.5">Model: {product.modelNumber}</p>
                )}
                {manufacturer?.name && (
                  <p className="text-xs text-gray-500 mt-0.5">{manufacturer.name}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-gray-700">
                  {fmt(option.unitCost)}
                  <span className="text-gray-400 font-normal"> / {unit || "unit"}</span>
                </p>
                {parentQty != null && option.unitCost != null && (
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(parentQty * option.unitCost)} total</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ li }: { li: ReviewLineItem }) {
  const productUrl = li.product?.productUrl;
  const safeUrl = productUrl
    ? productUrl.startsWith("http") ? productUrl : `https://${productUrl}`
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <h3 className="text-sm font-bold text-[#1F4788] leading-snug">{li.name}</h3>
        <div className="flex-shrink-0">
          <StatusBadge status={li.status} tier={li.product?.tier} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex gap-5 px-6 py-5">
        {/* Left: details */}
        <div className="flex-1 space-y-2 min-w-0">
          {li.product?.name && (
            <DetailRow label="Product" value={li.product.name} />
          )}
          {(li.product?.description || li.material) && (
            <DetailRow label="Description" value={(li.product?.description || li.material) ?? ""} />
          )}
          {li.product?.modelNumber && (
            <DetailRow label="Model #" value={li.product.modelNumber} />
          )}
          {li.manufacturer?.name && (
            <DetailRow label="Manufacturer" value={li.manufacturer.name} />
          )}
          {li.vendor?.name && (
            <DetailRow label="Vendor" value={li.vendor.name} />
          )}

          {/* Pricing row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 mt-1 border-t border-gray-100">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-400">Qty</span>
              <span className="text-xs font-semibold text-gray-700">
                {li.quantity ?? "—"}{li.unit ? ` ${li.unit}` : ""}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-400">Unit Cost</span>
              <span className="text-xs font-semibold text-gray-700">{fmt(li.unitCost)}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-400">Total</span>
              <span className="text-sm font-bold text-[#1F4788]">{fmt(li.totalCost)}</span>
            </div>
          </div>

          {safeUrl && (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-[#1F4788] underline mt-1 truncate max-w-full"
            >
              {li.product?.productUrl}
            </a>
          )}
        </div>

        {/* Right: product image */}
        {li.product?.imageUrl && (
          <div className="flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
            <img
              src={li.product.imageUrl}
              alt={li.product.name}
              className="w-full h-full object-contain p-1"
            />
          </div>
        )}
      </div>

      {/* Allowance footer — navy bar matching PPT */}
      {li.allowance != null && li.allowance > 0 && (
        <div
          className="flex items-center justify-between px-6 py-2.5"
          style={{ background: "#1F4788" }}
        >
          <span className="text-xs font-bold text-white uppercase tracking-widest">Allowance</span>
          <span className="text-sm font-bold text-white">{fmt(li.allowance)}</span>
        </div>
      )}

      {/* Alternate options collapsible */}
      {li.options && li.options.length > 0 && (
        <AlternateOptions
          options={li.options}
          parentQty={li.quantity}
          unit={li.unit}
        />
      )}
    </div>
  );
}

// ---- Section pane -----------------------------------------------------------

function SectionPane({ category, items }: CategoryGroup) {
  const totalBudget = items.reduce((sum, li) => sum + (li.totalCost ?? 0), 0);

  return (
    <div>
      {/* Section hero — mimics PPT section slide: navy block, large category name */}
      <div
        className="rounded-2xl px-8 py-10 mb-6 text-center"
        style={{ background: "#1F4788" }}
      >
        <h2 className="text-2xl font-bold text-white tracking-tight">{category.name}</h2>
        {category.description && (
          <p className="text-blue-200 text-sm mt-2 max-w-xl mx-auto">{category.description}</p>
        )}
        <p className="text-blue-300 text-xs mt-3">
          Section Total:{" "}
          <span className="text-white font-bold text-sm">{fmt(totalBudget)}</span>
        </p>
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        {items.map((li) => (
          <ProductCard key={li.id} li={li} />
        ))}
      </div>
    </div>
  );
}

// ---- Review content (main layout) -------------------------------------------

function ReviewContent({ data }: { data: ReviewData }) {
  const { project, lineItems, categories } = data;
  const groups = groupByCategory(lineItems, categories);
  const [activeTab, setActiveTab] = useState(0);

  const expiresFormatted = data.expiresAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(data.expiresAt))
    : null;

  const active = groups[activeTab];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Presentation header — navy, like PPT cover */}
      <div style={{ background: "#1F4788" }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-6">
          {/* Logo */}
          <div className="flex-shrink-0 hidden sm:block">
            <img
              src="/MegaProsLogo.png"
              alt="MegaPros"
              className="h-8 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-blue-600 flex-shrink-0" />

          {/* Project info */}
          <div className="flex-1 min-w-0">
            <p className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">
              Materials Selection Review
            </p>
            <h1 className="text-lg font-bold text-white leading-tight truncate">
              {project.name}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {project.customerName && (
                <span className="text-blue-200 text-xs">{project.customerName}</span>
              )}
              {project.address && (
                <span className="text-blue-300 text-xs">{project.address}</span>
              )}
              {project.projectNumber && (
                <span className="text-blue-300 text-xs">#{project.projectNumber}</span>
              )}
            </div>
          </div>

          {/* Expiry */}
          {expiresFormatted && (
            <div className="flex-shrink-0 text-right hidden md:block">
              <p className="text-blue-400 text-xs">Valid until</p>
              <p className="text-blue-200 text-xs font-semibold">{expiresFormatted}</p>
            </div>
          )}
        </div>
      </div>

      {/* Section tab bar */}
      {groups.length > 0 && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-6">
            <nav className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {groups.map(({ category }, idx) => (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(idx)}
                  className={`flex-shrink-0 px-5 py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === idx
                      ? "text-[#1F4788] border-[#1F4788]"
                      : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Active section */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {groups.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400">No materials selections have been added yet.</p>
          </div>
        ) : active ? (
          <SectionPane key={active.category.id} {...active} />
        ) : null}

        <p className="text-center text-xs text-gray-300 mt-10 pb-6">
          Read-only view prepared by MegaPros · Contact your representative with any questions
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
        setFatalError(
          "This review link has expired. Please contact your MegaPros representative for a new link.",
        );
      } else if (status === 404) {
        setFatalError("This review link was not found. It may have been revoked.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (fatalError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#1F4788" }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
          <img src="/MegaProsLogo.png" alt="MegaPros" className="h-7 w-auto mx-auto mb-4" />
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4">
            <p className="text-xs text-amber-800">{fatalError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (reviewData) return <ReviewContent data={reviewData} />;

  return <PinEntry onSubmit={handlePinSubmit} error={error} loading={loading} />;
}

