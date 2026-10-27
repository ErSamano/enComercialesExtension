export function buildCompareQuery(product) {
  return {
    name: product.name || "",
    price: product.price?.amount == null ? "" : String(product.price.amount),
    currency: product.price?.currency || "UNKNOWN",
    store: product.retailer || "",
    sku: product.sku || "",
    gtin: product.gtin || "",
    referencePrice: product.referencePrice?.amount == null ? "" : String(product.referencePrice.amount),
    referenceCurrency: product.referencePrice?.currency || "",
    advertisedDiscountPercent: product.advertisedDiscountPercent == null ? "" : String(product.advertisedDiscountPercent)
  };
}

const SUPPORTED_CURRENCIES = new Set(["MXN", "USD", "EUR", "CAD"]);
const SUPPORTED_RETAILERS = new Set(["vinoteca", "alianza", "balianza", "bodegas alianza", "la europea", "palacio de hierro", "la castellana", "liverpool"]);

export function validateComparisonInput(product = {}) {
  const amount = Number(product.price?.amount);
  const currency = String(product.price?.currency || "").toUpperCase();
  const retailer = String(product.retailer || "").trim();
  const errors = [];
  if (!Number.isFinite(amount) || amount <= 0) errors.push("INVALID_PRICE");
  if (!SUPPORTED_CURRENCIES.has(currency)) errors.push("UNSUPPORTED_CURRENCY");
  if (!String(product.name || "").trim()) errors.push("MISSING_PRODUCT_NAME");
  if (!retailer || /^unknown(?: retailer)?$/i.test(retailer) || !SUPPORTED_RETAILERS.has(retailer.toLowerCase())) errors.push("INVALID_RETAILER");
  return { valid: errors.length === 0, errors, amount, currency, retailer };
}
