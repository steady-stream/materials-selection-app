import pptxgen from "pptxgenjs";
import type {
    Category,
    LineItem,
    LineItemOption,
    Manufacturer,
    Product,
    Project,
    Vendor,
} from "../types";
import {
    batchGetManufacturers,
    batchGetProducts,
    batchGetVendors,
    categoryService,
    lineItemOptionService,
    lineItemService,
    projectService,
} from "./index";

/**
 * Data structure for organizing project data for PowerPoint generation
 */
interface CategorySection {
  category: Category;
  lineItems: Array<{
    lineItem: LineItem;
    product: Product | null;
    manufacturer: Manufacturer | null;
    vendor: Vendor | null;
    options: Array<{
      option: LineItemOption;
      product: Product;
      manufacturer: Manufacturer | null;
      vendor: Vendor | null;
    }>;
  }>;
  totalBudget: number;
  totalAllowance: number;
}

interface ProjectPresentationData {
  project: Project;
  categorySections: CategorySection[];
  totalBudget: number;
  totalAllowance: number;
}

/**
 * Phase 2: Data fetching layer
 * Fetches all data needed for PowerPoint generation using batch endpoints
 * to reduce API Gateway concurrency load from 100+ requests to ~4 requests
 */
async function fetchProjectData(
  projectId: string,
): Promise<ProjectPresentationData> {
  // Fetch project and all line items
  const project = await projectService.getById(projectId);
  const lineItems = await lineItemService.getByProjectId(projectId);

  // ─ Step 1: Collect all IDs that need to be fetched upfront
  const allProductIds = new Set<string>();
  const allManufacturerIds = new Set<string>();
  const allVendorIds = new Set<string>();

  // For each line item, get its options (doing this sequentially is much faster
  // than doing 100+ concurrent requests one per line item)
  const lineItemsWithOptions: Array<LineItem & { options: LineItemOption[] }> =
    [];
  for (const lineItem of lineItems) {
    const options = await lineItemOptionService.getByLineItemId(lineItem.id);
    lineItemsWithOptions.push({ ...lineItem, options });

    // Collect IDs
    if (lineItem.productId) allProductIds.add(lineItem.productId);
    if (lineItem.vendorId) allVendorIds.add(lineItem.vendorId);

    for (const option of options) {
      if (!option.isSelected) {
        allProductIds.add(option.productId);
      }
    }
  }

  // ─ Step 2: Batch fetch products and vendors.
  // Note: allManufacturerIds is empty here — manufacturer IDs live on products,
  // not on line items. We collect them after products are fetched (Step 3).
  const [productResults, vendorResults] = await Promise.all([
    allProductIds.size > 0 ? batchGetProducts(Array.from(allProductIds)) : [],
    allVendorIds.size > 0 ? batchGetVendors(Array.from(allVendorIds)) : [],
  ]);

  // ─ Step 3: Build product map by product.id (not positional index).
  // The batch endpoint filters out not-found products, so positional indexing
  // breaks whenever any product is missing — map by id instead.
  const productMap = new Map<string, Product>();
  for (const product of productResults) {
    if (product) {
      productMap.set(product.id, product);
      // Collect manufacturer IDs now that we have the products
      if (product.manufacturerId) {
        allManufacturerIds.add(product.manufacturerId);
      }
    }
  }

  // Fetch manufacturers after products so we know which IDs are actually needed
  const manufacturerResults =
    allManufacturerIds.size > 0
      ? await batchGetManufacturers(Array.from(allManufacturerIds))
      : [];

  const manufacturerMap = new Map<string, Manufacturer>();
  for (const manufacturer of manufacturerResults) {
    if (manufacturer) {
      manufacturerMap.set(manufacturer.id, manufacturer);
    }
  }

  const vendorMap = new Map<string, Vendor>();
  for (const vendor of vendorResults) {
    if (vendor) {
      vendorMap.set(vendor.id, vendor);
    }
  }

  // ─ Step 4: Build detailed line items using cached data
  const lineItemsWithDetails = await Promise.all(
    lineItemsWithOptions.map(async (lineItem) => {
      const category = await categoryService.getById(lineItem.categoryId);

      // Use cached product/manufacturer/vendor data
      const product = lineItem.productId
        ? productMap.get(lineItem.productId) || null
        : null;
      const manufacturer = product?.manufacturerId
        ? manufacturerMap.get(product.manufacturerId) || null
        : null;
      const vendor = lineItem.vendorId
        ? vendorMap.get(lineItem.vendorId) || null
        : null;

      // Use pre-fetched line item options
      const options: LineItemOption[] = lineItem.options || [];

      // Build option details using cached product data
      const optionsWithDetails = options
        .filter((opt: LineItemOption) => !opt.isSelected)
        .map((option: LineItemOption) => {
          const optionProduct = productMap.get(option.productId);
          const optionManufacturer = optionProduct?.manufacturerId
            ? manufacturerMap.get(optionProduct.manufacturerId) || null
            : null;

          return {
            option,
            product: optionProduct || undefined,
            manufacturer: optionManufacturer,
            vendor: null, // Options don't have vendor mapping
          };
        })
        .filter((opt: any) => opt.product !== undefined) as Array<{
        option: LineItemOption;
        product: Product;
        manufacturer: Manufacturer | null;
        vendor: Vendor | null;
      }>;

      return {
        lineItem,
        product,
        category,
        manufacturer,
        vendor,
        options: optionsWithDetails,
      };
    }),
  );

  // Filter to only line items that have either a selected product or options
  const relevantLineItems = lineItemsWithDetails.filter(
    (item) => item.product !== null || item.options.length > 0,
  );

  // Organize by category
  const categoryMap = new Map<string, CategorySection>();

  relevantLineItems.forEach((item) => {
    const categoryId = item.category.id;

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        category: item.category,
        lineItems: [],
        totalBudget: 0,
        totalAllowance: 0,
      });
    }

    const section = categoryMap.get(categoryId)!;
    section.lineItems.push({
      lineItem: item.lineItem,
      product: item.product,
      manufacturer: item.manufacturer,
      vendor: item.vendor,
      options: item.options,
    });
    section.totalBudget += item.lineItem.totalCost || 0;
    section.totalAllowance += item.lineItem.allowance || 0;
  });

  const categorySections = Array.from(categoryMap.values());
  const totalBudget = categorySections.reduce(
    (sum, section) => sum + section.totalBudget,
    0,
  );
  const totalAllowance = categorySections.reduce(
    (sum, section) => sum + section.totalAllowance,
    0,
  );

  return {
    project,
    categorySections,
    totalBudget,
    totalAllowance,
  };
}

/**
 * Phase 4: Helper function to fetch and convert image to base64 data URI.
 * Three-tier strategy:
 *   1. Canvas approach (works for same-origin and CORS-enabled remote URLs)
 *   2. Direct fetch (works if the remote server allows CORS)
 *   3. Server-side proxy via /image-proxy (handles third-party CDNs with no CORS headers)
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const MAX_IMAGE_DIMENSION = 2048;
  const isRemoteUrl = /^https?:\/\//i.test(url);
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    "https://xrld1hq3e2.execute-api.us-east-1.amazonaws.com/prod";

  function looksLikeImageBytes(bytes: Uint8Array): boolean {
    if (bytes.length < 12) return false;

    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return true;
    }

    // PNG
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return true;
    }

    // GIF
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return true;
    }

    // WEBP (RIFF....WEBP)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return true;
    }

    return false;
  }

  function decodeBase64ImageBlob(
    base64Payload: string,
    mimeType: string,
  ): Blob {
    const sanitized = base64Payload
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/\s+/g, "");

    const binary = atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType || "image/jpeg" });
  }

  function getScaledDimensions(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      return { width: 1, height: 1 };
    }
    const largest = Math.max(width, height);
    if (largest <= MAX_IMAGE_DIMENSION) {
      return { width, height };
    }
    const scale = MAX_IMAGE_DIMENSION / largest;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  async function normalizeBlobForPpt(blob: Blob): Promise<string> {
    // Always rasterize to a predictable PNG payload; this avoids format/encoding
    // edge cases that browsers handle but PowerPoint rejects at render time.
    try {
      const imageBitmap = await createImageBitmap(blob);
      const dimensions = getScaledDimensions(
        imageBitmap.width,
        imageBitmap.height,
      );
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not create canvas context for blob conversion");
      }

      context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
      imageBitmap.close();
      return canvas.toDataURL("image/png");
    } catch {
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const dimensions = getScaledDimensions(
                img.naturalWidth || img.width,
                img.naturalHeight || img.height,
              );
              const canvas = document.createElement("canvas");
              canvas.width = dimensions.width;
              canvas.height = dimensions.height;
              const context = canvas.getContext("2d");
              if (!context) {
                reject(
                  new Error(
                    "Could not create canvas context for fallback conversion",
                  ),
                );
                return;
              }
              context.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL("image/png"));
            } catch (error) {
              reject(error);
            }
          };
          img.onerror = () => {
            reject(
              new Error(
                "Failed to decode image blob during fallback conversion",
              ),
            );
          };
          img.src = objectUrl;
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    throw new Error("Failed to normalize image for PowerPoint embedding");
  }

  async function fetchRemoteImageViaProxy(remoteUrl: string): Promise<Blob> {
    const proxyUrl = `${apiBase}/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
    const proxyResponse = await fetch(proxyUrl);
    if (!proxyResponse.ok) {
      throw new Error(`Proxy fetch failed with status ${proxyResponse.status}`);
    }

    const contentType =
      proxyResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await proxyResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (looksLikeImageBytes(bytes)) {
      return new Blob([bytes], { type: contentType });
    }

    // Some API Gateway configurations return base64 as plain text body even when
    // content-type is image/*. Decode that payload into true image bytes.
    const textPayload = new TextDecoder().decode(bytes);
    try {
      return decodeBase64ImageBlob(textPayload, contentType);
    } catch {
      throw new Error(
        "Proxy returned non-image payload that could not be decoded",
      );
    }
  }

  // For remote URLs, always route via proxy first to avoid third-party hotlink/CORS
  // behavior differences between browser image rendering and programmatic fetch.
  if (isRemoteUrl) {
    const remoteBlob = await fetchRemoteImageViaProxy(url);
    return await normalizeBlobForPpt(remoteBlob);
  }

  // Local assets can use browser image pipeline directly.
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const dimensions = getScaledDimensions(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
          );
          const canvas = document.createElement("canvas");
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          const context = canvas.getContext("2d");
          if (!context) {
            reject(
              new Error("Could not create canvas context for image conversion"),
            );
            return;
          }

          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          // toDataURL throws a SecurityError if the image is cross-origin
          // without CORS headers — let the catch block handle it
          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Image element failed to load: ${url}`));
      };

      img.src = url;
    });
  } catch {
    // Fallback for local assets loaded as blob.
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      return await normalizeBlobForPpt(blob);
    } catch (localError) {
      console.warn(`All image fetch strategies failed for ${url}:`, localError);
      throw localError;
    }
  }
}

function formatCoverSlideAddress(address?: string): string | null {
  if (!address) return null;

  const normalizedAddress = address.trim();
  if (!normalizedAddress) return null;

  const parts = normalizedAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return normalizedAddress;

  const countryTokens = new Set([
    "us",
    "usa",
    "united states",
    "united states of america",
    "ca",
    "canada",
    "mx",
    "mexico",
    "uk",
    "united kingdom",
    "gb",
    "fr",
    "france",
    "de",
    "germany",
    "it",
    "italy",
    "es",
    "spain",
    "nl",
    "netherlands",
    "be",
    "belgium",
    "au",
    "australia",
    "ch",
    "switzerland",
    "se",
    "sweden",
    "no",
    "norway",
    "dk",
    "denmark",
    "fi",
    "finland",
    "ie",
    "ireland",
    "pt",
    "portugal",
    "at",
    "austria",
    "pl",
    "poland",
    "cz",
    "czech republic",
    "gr",
    "greece",
    "ru",
    "russia",
    "jp",
    "japan",
    "cn",
    "china",
    "in",
    "india",
    "br",
    "brazil",
    "ar",
    "argentina",
    "za",
    "south africa",
    "kr",
    "south korea",
    "sg",
    "singapore",
    "ae",
    "united arab emirates",
  ]);

  const lastPart = parts[parts.length - 1].toLowerCase();
  if (countryTokens.has(lastPart)) {
    return parts.slice(0, -1).join(", ");
  }

  return normalizedAddress;
}

/**
 * Phase 5: Generate cover slide matching sample styling
 * Blue gradient background on left 25%, logo and selector info on right
 */
async function generateCoverSlide(
  pptx: pptxgen,
  project: Project,
  totalBudget: number,
  totalAllowance: number,
): Promise<void> {
  const slide = pptx.addSlide();
  const totalVariance =
    totalAllowance > 0 ? totalBudget - totalAllowance : null;

  // Blue gradient background on left 25%
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 2.5,
    h: 7.5,
    fill: { color: "1F4788" },
  });

  // Project details in blue section (white text)
  const leftSectionBlocks: Array<{
    text: string;
    y: number;
    fontSize: number;
    bold?: boolean;
  }> = [];

  if (project.customerName) {
    leftSectionBlocks.push({
      text: project.customerName,
      y: 1.25,
      fontSize: 19,
    });
  }

  const formattedAddress = formatCoverSlideAddress(project.address);
  if (formattedAddress) {
    leftSectionBlocks.push({
      text: formattedAddress,
      y: 1.95,
      fontSize: 17,
    });
  }

  if (project.projectNumber) {
    leftSectionBlocks.push({
      text: `Project Number: ${project.projectNumber}`,
      y: 3.0,
      fontSize: 16,
      bold: true,
    });
  }

  leftSectionBlocks.forEach((block) => {
    slide.addText(block.text, {
      x: 0.2,
      y: block.y,
      w: 2.1,
      h: 0.6,
      fontSize: block.fontSize,
      fontFace: "Calibri",
      color: "FFFFFF",
      valign: "top",
      margin: 0.02,
      bold: block.bold,
    });
  });

  // Logo on right side
  try {
    const logoData = await fetchImageAsBase64("/MegaProsLogo.png");
    slide.addImage({
      data: logoData,
      x: 4.0,
      y: 0.5,
      w: 3.0,
      h: 0.6,
    });
  } catch (error) {
    console.warn("Failed to add logo to cover slide:", error);
  }

  // Selector info in bottom right
  slide.addText("Judy Hogel\nJudy@megapros.com\n847-652-4185", {
    x: 7.0,
    y: 6.8,
    w: 2.5,
    h: 0.6,
    fontSize: 10,
    fontFace: "Calibri",
    color: "363636",
    align: "right",
    valign: "bottom",
  });

  // Project totals in the lower right, above selector info.
  const projectTotals: string[] = [
    `Project Total: $${totalBudget.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  ];
  if (totalAllowance > 0) {
    projectTotals.push(
      `Allowance: $${totalAllowance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }
  if (totalVariance != null) {
    projectTotals.push(
      `Variance: ${totalVariance > 0 ? "+" : ""}$${Math.abs(
        totalVariance,
      ).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }

  slide.addText(projectTotals.join("\n"), {
    x: 6.2,
    y: 5.65,
    w: 3.3,
    h: 0.95,
    fontSize: 11,
    fontFace: "Calibri",
    color: "363636",
    align: "right",
    valign: "bottom",
  });
}

/**
 * Phase 5: Generate section slide matching sample styling
 * Blue gradient background on top 75%, section name and info
 */
function generateSectionSlide(
  pptx: pptxgen,
  category: Category,
  totalBudget: number,
  totalAllowance: number,
): void {
  const slide = pptx.addSlide();
  const totalVariance =
    totalAllowance > 0 ? totalBudget - totalAllowance : null;

  // Blue gradient background on top 75%
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: "1F4788" },
  });

  // Category name (white text)
  slide.addText(category.name, {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1.0,
    fontSize: 39,
    fontFace: "Calibri",
    bold: true,
    align: "center",
    color: "FFFFFF",
  });

  // Section info below blue area
  const sectionSummary = [
    `Total Budget: $${totalBudget.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  ];
  if (totalAllowance > 0) {
    sectionSummary.push(
      `Allowance: $${totalAllowance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }
  if (totalVariance != null) {
    sectionSummary.push(
      `Variance: ${totalVariance > 0 ? "+" : ""}$${Math.abs(
        totalVariance,
      ).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }

  slide.addText(sectionSummary.join(" | "), {
    x: 0.5,
    y: 6.0,
    w: 9,
    h: 0.5,
    fontSize: 16,
    fontFace: "Calibri",
    align: "center",
    color: "363636",
  });

  // Category description if available
  if (category.description) {
    slide.addText(category.description, {
      x: 0.5,
      y: 6.6,
      w: 9,
      h: 0.7,
      fontSize: 18,
      fontFace: "Calibri",
      align: "center",
      color: "666666",
    });
  }
}

/**
 * Phase 5: Generate product slide matching sample styling
 * Blue bar on bottom 10%, product details upper area, image below
 */
async function generateProductSlide(
  pptx: pptxgen,
  lineItem: LineItem,
  product: Product | null,
  manufacturer: Manufacturer | null,
  vendor: Vendor | null,
  statusText?: string,
): Promise<void> {
  const slide = pptx.addSlide();
  const variance =
    lineItem.allowance != null ? lineItem.totalCost - lineItem.allowance : null;

  // Blue bar on bottom 10%
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 6.75,
    w: 10,
    h: 0.75,
    fill: { color: "1F4788" },
  });

  // Allowance in blue footer bar
  if (lineItem.allowance) {
    const allowanceParts = [
      `Allowance: $${lineItem.allowance.toLocaleString()}`,
    ];
    if (variance != null) {
      allowanceParts.push(
        `Variance: ${variance > 0 ? "+" : ""}$${Math.abs(variance).toLocaleString()}`,
      );
    }
    const allowanceText = allowanceParts.join(" | ");
    slide.addText(allowanceText, {
      x: 0.5,
      y: 6.8,
      w: 9,
      h: 0.65,
      fontSize: 18,
      fontFace: "Calibri",
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
  }

  // Product URL just above blue bar (if available)
  if (typeof product?.productUrl === "string" && product.productUrl.trim()) {
    // Ensure URL has protocol prefix
    let fullUrl = product.productUrl.trim();
    if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
      fullUrl = "https://" + fullUrl;
    }

    slide.addText(fullUrl, {
      x: 0.5,
      y: 5.9,
      w: 9,
      h: 0.7,
      fontSize: 18,
      fontFace: "Calibri",
      hyperlink: { url: fullUrl },
      color: "0563C1",
      align: "center",
      underline: { style: "sng" },
    });
  }

  // Line item name upper left with dynamic font sizing and wrapping
  const lineItemName =
    typeof lineItem.name === "string" && lineItem.name.trim()
      ? lineItem.name.trim()
      : "Untitled Line Item";
  const nameLength = lineItemName.length;
  let nameFontSize = 35;
  if (nameLength > 60) {
    nameFontSize = 24;
  } else if (nameLength > 40) {
    nameFontSize = 28;
  }

  slide.addText(lineItemName, {
    x: 0.3,
    y: 0.2,
    w: 5.5,
    h: 1.0,
    fontSize: nameFontSize,
    fontFace: "Calibri",
    bold: true,
    color: "1F4788",
    wrap: true,
    valign: "top",
  });

  // Status upper right (keep original case)
  const baseStatus = statusText || lineItem.status || "Selected";
  const fullStatusText = baseStatus;

  // Determine status color
  let statusColor = "1F4788"; // Default blue
  const statusLower = baseStatus.toLowerCase();

  if (statusLower === "installed") {
    statusColor = "2D9F48"; // Green
  } else if (statusLower === "ordered") {
    statusColor = "2B579A"; // Blue
  } else if (statusLower === "received") {
    statusColor = "7E3BA6"; // Purple
  } else if (statusLower === "final") {
    statusColor = "0D9488"; // Teal
  } else if (statusLower.startsWith("option")) {
    statusColor = "D97706"; // Amber/Orange
  } else if (statusLower === "no selection") {
    statusColor = "DC2626"; // Red
  }

  slide.addText(fullStatusText, {
    x: 6.0,
    y: 0.2,
    w: 3.7,
    h: 1.0,
    fontSize: 24,
    fontFace: "Calibri",
    bold: true,
    color: statusColor,
    align: "right",
    valign: "top",
  });

  // Product details - consolidated single text box with dynamic font sizing
  // Adjust Y position based on line item name length to prevent overlap
  const detailsX = 0.3;
  const detailsW = 4.5;

  // Calculate detailsY based on estimated line item name height
  // If name is short (<=40 chars), it's likely 1 line, start details at 0.9
  // If name is longer, it will wrap to 2+ lines, move details down to 1.35
  let detailsY = 0.9;
  let detailsH = 4.8; // Height to accommodate wrapped text

  if (nameLength > 40) {
    detailsY = 1.35; // Move down to avoid overlap with wrapped name
    detailsH = 4.35; // Reduce height to avoid overlapping URL at bottom
  }

  // Resolve the selected variation (catalog hydrates product with all variations)
  const selectedVariation = lineItem.productVariationId
    ? product?.variations?.find((v) => v.id === lineItem.productVariationId)
    : product?.variations?.[0]; // fall back to default/first variation

  // Debug logging for problem products
  if (
    product?.name === "NVENESAN1224" ||
    product?.name === "Calacatta Premata"
  ) {
    console.log(
      `[PPT_PRODUCT] ${product.name}: productVariationId=${lineItem.productVariationId}, variations.length=${product.variations?.length}, selectedVariation.imageUrl=${selectedVariation?.imageUrl}, product.imageUrl=${product.imageUrl}`,
    );
  }

  // Build details text array
  const detailsLines: string[] = [];

  if (product?.name) {
    detailsLines.push(`Product: ${product.name}`);
  }

  const description = product?.description || lineItem.material;
  if (description) {
    detailsLines.push(`Description: ${description}`);
  }

  const safeQuantity = Number.isFinite(Number(lineItem.quantity))
    ? Number(lineItem.quantity)
    : 0;
  const safeUnitCost = Number.isFinite(Number(lineItem.unitCost))
    ? Number(lineItem.unitCost)
    : 0;
  const safeTotalCost = Number.isFinite(Number(lineItem.totalCost))
    ? Number(lineItem.totalCost)
    : 0;
  const safeUnit =
    typeof lineItem.unit === "string" && lineItem.unit.trim()
      ? lineItem.unit.trim()
      : "";

  // Prefer variation's effectiveModelNumber so the per-variation model number shows
  const modelNumber =
    selectedVariation?.effectiveModelNumber ||
    selectedVariation?.modelNumber ||
    product?.modelNumber;
  if (modelNumber) {
    detailsLines.push(`Model: ${modelNumber}`);
  }

  if (manufacturer) {
    detailsLines.push(`Manufacturer: ${manufacturer.name}`);
  }

  if (vendor) {
    detailsLines.push(`Vendor: ${vendor.name}`);
  }

  // Prefer variation-level color/finish — these are what was actually selected
  const color = selectedVariation?.color || product?.color;
  const finish = selectedVariation?.finish || product?.finish;
  if (color) {
    detailsLines.push(`Color: ${color}`);
  }

  if (finish) {
    detailsLines.push(`Finish: ${finish}`);
  }

  if (product?.collection) {
    detailsLines.push(`Collection: ${product.collection}`);
  }

  detailsLines.push(
    `Quantity: ${safeQuantity}${safeUnit ? ` ${safeUnit}` : ""}`,
  );
  detailsLines.push(
    `Unit: $${safeUnitCost.toFixed(2)} | Total: $${safeTotalCost.toFixed(2)}`,
  );

  // Calculate total text length for dynamic font sizing
  const totalText = detailsLines.join("\n");
  const totalChars = totalText.length;

  // Dynamic font size: fewer chars = larger font
  let detailsFontSize = 18;
  if (totalChars > 400) {
    detailsFontSize = 14;
  } else if (totalChars > 250) {
    detailsFontSize = 16;
  }

  const imageUrl = selectedVariation?.imageUrl || product?.imageUrl;

  // Add single consolidated text box
  slide.addText(totalText, {
    x: detailsX,
    y: detailsY,
    w: detailsW,
    h: detailsH,
    fontSize: detailsFontSize,
    fontFace: "Calibri",
    color: "363636",
    wrap: true,
    valign: "top",
  });

  // Product image or placeholder (below details)
  try {
    let imageData: string;
    if (imageUrl) {
      try {
        imageData = await fetchImageAsBase64(imageUrl);
      } catch (error) {
        console.warn(`Failed to load product image, using placeholder:`, error);
        imageData = await fetchImageAsBase64("/SubstituteImage.png");
      }
    } else {
      imageData = await fetchImageAsBase64("/SubstituteImage.png");
    }

    slide.addImage({
      data: imageData,
      x: 5.0,
      y: 1.0,
      w: 4.5,
      h: 5.0,
      sizing: { type: "contain", w: 4.5, h: 5.0 },
    });
  } catch (error) {
    console.warn(`Failed to add image to slide:`, error);
  }
}

/**
 * Phase 3: Main function to generate project PowerPoint
 * Generates complete presentation with cover, sections, and product slides
 */
export async function generateProjectPPTX(projectId: string): Promise<void> {
  try {
    console.log("Fetching project data for PowerPoint generation...");
    const data = await fetchProjectData(projectId);

    console.log("Generating PowerPoint presentation...");

    // Create presentation instance
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_4x3";
    pptx.author = "MegaPros Materials Selection App";
    pptx.title = data.project.name;

    // Generate cover slide with logo
    await generateCoverSlide(
      pptx,
      data.project,
      data.totalBudget,
      data.totalAllowance,
    );

    // Generate category sections with products
    for (const section of data.categorySections) {
      // Section divider slide
      generateSectionSlide(
        pptx,
        section.category,
        section.totalBudget,
        section.totalAllowance,
      );

      // Product slides for this category
      for (const item of section.lineItems) {
        const isFinal = item.lineItem.status === "final";

        if (isFinal) {
          // For "final" status, only show selected product (or "No Selection")
          const statusText = item.product ? "Final" : "No Selection";
          await generateProductSlide(
            pptx,
            item.lineItem,
            item.product,
            item.manufacturer,
            item.vendor,
            statusText,
          );
        } else {
          // For non-final status, show selected product first, then options
          // Show selected product slide if it exists
          if (item.product) {
            await generateProductSlide(
              pptx,
              item.lineItem,
              item.product,
              item.manufacturer,
              item.vendor,
              undefined, // Use actual status
            );
          }

          // Show option slides
          for (let i = 0; i < item.options.length; i++) {
            const option = item.options[i];
            const optionStatusText = `Option ${i + 1}`;

            // Create a temporary line item for the option with option's cost
            const optionLineItem = {
              ...item.lineItem,
              unitCost: option.option.unitCost,
              totalCost: option.option.unitCost * item.lineItem.quantity,
            };

            await generateProductSlide(
              pptx,
              optionLineItem,
              option.product,
              option.manufacturer,
              option.vendor,
              optionStatusText,
            );
          }
        }
      }
    }

    // Generate filename
    const fileName = `${data.project.name.replace(/[^a-zA-Z0-9]/g, "_")}_Materials_Selection.pptx`;

    // Download the file
    console.log(`Downloading ${fileName}...`);
    await pptx.writeFile({ fileName });

    console.log("PowerPoint generated successfully!");
  } catch (error) {
    console.error("Error generating PowerPoint:", error);
    alert("Failed to generate PowerPoint. Check console for details.");
  }
}

/**
 * Phase 1: Basic proof of concept - generates a simple PowerPoint with one slide
 * Used to verify pptxgenjs works with our stack
 */
export const generateTestPPTX = () => {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.layout = "LAYOUT_4x3"; // Match sample presentations
  pptx.author = "MegaPros Materials Selection App";
  pptx.title = "Test Presentation";

  // Add a simple slide
  const slide = pptx.addSlide();
  slide.addText("Hello World from PowerPoint!", {
    x: 1,
    y: 1,
    w: 8,
    h: 1,
    fontSize: 24,
    bold: true,
    align: "center",
    color: "363636",
  });

  slide.addText("If you can see this, pptxgenjs is working correctly!", {
    x: 1,
    y: 2.5,
    w: 8,
    h: 0.5,
    fontSize: 14,
    align: "center",
    color: "666666",
  });

  // Download the file
  pptx.writeFile({ fileName: "Test-Presentation.pptx" });
};
