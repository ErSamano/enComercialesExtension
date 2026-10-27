import { selectProductPrice } from "../utils/price-selection.js";

const SELECTORS = {
  Vinoteca: { name: ".vtex-product-identifier-0-x-productName, h1", price: ".vtex-product-price-1-x-sellingPriceValue", reference: ".vtex-product-price-1-x-listPriceValue, .regular-price, .old-price" },
  Alianza: { name: "h1, .vtex-store-components-3-x-productNameContainer", price: ".vtex-product-price-1-x-sellingPriceValue", reference: ".vtex-product-price-1-x-listPriceValue, .regular-price, .old-price" },
  "La Europea": { name: "h1, .page-title", price: ".price-box .price, .le-card__price" },
  "Palacio de Hierro": { name: "h1, .product-name", price: ".b-product_price-sales .b-product_price-value, .b-product_price-value" },
  "La Castellana": { name: "h1, .product__title", price: ".price-item--sale, .price-item--regular" },
  Liverpool: { name: "h1, h3.a-card-description", price: ".a-product-price, .a-card-discount, .a-card-price" }
};

export function adapterFor(retailer) {
  const selectors = SELECTORS[retailer];
  if (!selectors) return null;
  return { name: retailer, detectProductPage: () => Boolean(document.querySelector(selectors.name)), extractProductName: () => document.querySelector(selectors.name)?.textContent?.trim() || "", extractPrice: () => selectProductPrice(document).price?.amount == null ? "" : String(selectProductPrice(document).price.amount), extractReferencePrice: () => { const selected = selectProductPrice(document); return selected.referencePrice?.amount == null ? "" : String(selected.referencePrice.amount); }, extractionMethod: `adapter:${retailer}` };
}

