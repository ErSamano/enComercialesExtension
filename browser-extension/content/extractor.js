import { parseCurrency } from "../utils/currency.js";
import { selectProductPrice } from "../utils/price-selection.js";

function meta(selector) { return document.querySelector(selector)?.content?.trim() || ""; }
function firstText(selectors) { return selectors.map((selector) => document.querySelector(selector)?.textContent?.trim()).find(Boolean) || ""; }
function asArray(value) { return Array.isArray(value) ? value : [value]; }

function jsonLdProducts() {
  const values = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent);
      const visit = (item) => {
        if (!item || typeof item !== "object") return;
        if (item["@graph"]) item["@graph"].forEach(visit);
        if (item.itemListElement) asArray(item.itemListElement).forEach((entry) => visit(entry.item || entry));
        const types = asArray(item["@type"]);
        if (types.includes("Product") || types.includes("Offer")) values.push(item);
      };
      visit(parsed);
    } catch { /* malformed retailer JSON-LD */ }
  }
  return values;
}

export function extractStructuredProduct() {
  const product = jsonLdProducts().find((item) => asArray(item["@type"]).includes("Product")) || {};
  const offer = asArray(product.offers || jsonLdProducts().find((item) => asArray(item["@type"]).includes("Offer")))[0] || {};
  const brand = typeof product.brand === "object" ? product.brand.name : product.brand;
  return {
    name: product.name || meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]'),
    sku: product.sku || product.mpn || "", gtin: product.gtin13 || product.gtin12 || product.gtin14 || product.gtin8 || "",
    brand: brand || "", price: parseCurrency(offer.price ?? product.price), salePrice: parseCurrency(offer.price),
    currency: offer.priceCurrency || "MXN", referencePrice: null, advertisedDiscountPercent: null, image: Array.isArray(product.image) ? product.image[0] : (product.image || meta('meta[property="og:image"]')),
    url: product.url || document.querySelector('link[rel="canonical"]')?.href || location.href, extractionMethod: "JSON-LD"
  };
}

export function extractGenericProduct() {
  const structured = extractStructuredProduct();
  const selected = selectProductPrice(document);
  if (structured.name || structured.price) return { ...structured, price: selected.price || structured.price, salePrice: selected.salePrice || structured.salePrice, referencePrice: selected.referencePrice || structured.referencePrice, priceDiagnostics: selected.priceDiagnostics };
  const name = document.querySelector('[itemprop="name"], h1, [class*="product-title"], [class*="productName"]')?.textContent?.trim() || meta('meta[property="og:title"]');
  const priceText = document.querySelector('[itemprop="price"], [class*="sale-price"], [class*="sellingPrice"], [class*="price"]')?.textContent;
  const referencePrice = parseCurrency(firstText([".regular-price", ".list-price", ".old-price", "[class*='listPrice']", "[class*='oldPrice']", "[data-testid*='regular']"]));
  return { ...structured, name, price: selected.price || parseCurrency(priceText), salePrice: selected.salePrice || parseCurrency(priceText), referencePrice: selected.referencePrice || referencePrice, priceDiagnostics: selected.priceDiagnostics, extractionMethod: "DOM" };
}
