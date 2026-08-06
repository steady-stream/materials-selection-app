export const PRODUCT_COLOR_OPTIONS = [
  "Almond",
  "Beige",
  "Biscuit",
  "Black",
  "Blue",
  "Bone",
  "Brown",
  "Charcoal",
  "Clear",
  "Copper",
  "Cream",
  "Espresso",
  "Graphite",
  "Gray",
  "Green",
  "Ivory",
  "Mocha",
  "Natural",
  "Navy",
  "Off-White",
  "Pearl",
  "Red",
  "Sage",
  "Sand",
  "Silver",
  "Slate",
  "Tan",
  "Taupe",
  "Walnut",
  "White",
] as const;

export const normalizeOptionValue = (value?: string | null): string => {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/grey/g, "gray");
};

export const matchesOptionValue = (
  value: string | null | undefined,
  filter: string | null | undefined,
): boolean => {
  if (!filter) return true;
  return normalizeOptionValue(value) === normalizeOptionValue(filter);
};

export const PRODUCT_FINISH_OPTIONS = [
  "Aged Brass",
  "Black Stainless",
  "Brilliance Black Onyx",
  "Brilliance Brushed Nickel",
  "Brilliance Polished Gold",
  "Brilliance Polished Nickel",
  "Brilliance Stainless",
  "Bronzed Gold",
  "Brushed Bronze",
  "Brushed Gold",
  "Brushed Gold PVD",
  "Brushed Moderne Brass",
  "Brushed Nickel",
  "Brushed Nickel PVD",
  "Champagne Bronze",
  "Chrome",
  "Cocoa Bronze",
  "French Gold",
  "Gunmetal",
  "Luxe Nickel",
  "Luxe Steel",
  "Matte Black",
  "Matte White",
  "Oil-Rubbed Bronze",
  "Polished Brass",
  "Polished Brass PVD",
  "Polished Chrome",
  "Polished Nickel",
  "Polished Nickel PVD",
  "Satin Copper",
  "Spot Resist Stainless",
  "Stainless / Arctic Stainless",
  "Stainless Steel PVD",
  "Titanium",
  "Venetian Bronze",
  "Vibrant Stainless",
] as const;
