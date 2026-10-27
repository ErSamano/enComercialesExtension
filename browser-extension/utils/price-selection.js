import { parseCurrency } from "./currency.js";

const EXCLUDED_ANCESTOR = /recommend|related|upsell|cross[-_ ]?sell|product[-_ ]?card|collection|carousel/i;
const PRIMARY_SELECTORS = [
  [".vtex-product-price-1-x-sellingPriceValue, [class*='sellingPriceValue']", "PRODUCT_PAGE_PRIMARY_PRICE", 110],
  [".price-box .special-price .price, .price-box .sale-price .price", "PRODUCT_PAGE_PRIMARY_PRICE", 100],
  ["[data-product-price], [data-price-role='sale'], .product-single__price, .product__price", "PRODUCT_PAGE_PRIMARY_PRICE", 95],
  ["[itemprop='price']", "PRODUCT_PAGE_PRIMARY_PRICE", 90],
  [".price-item--sale, .sale-price, .selling-price", "PRODUCT_PAGE_PRIMARY_PRICE", 85],
  [".price-box .price", "PRODUCT_PAGE_PRIMARY_PRICE", 70],
  [".le-card__price", "PRODUCT_PAGE_PRIMARY_PRICE", 50]
];
const REFERENCE_SELECTORS = [".price-box .old-price, .price-box .list-price, .regular-price, .price-item--regular, [data-price-role='regular']"];

function visible(element) {
  if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
  const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
  return !(style && (style.display === "none" || style.visibility === "hidden")) && !/\b(hidden|inactive|unavailable|disabled)\b/i.test(element.className || "");
}

function productContext(element) {
  let current = element;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    if (EXCLUDED_ANCESTOR.test(String(current.className || "")) || current.getAttribute?.("aria-label")?.match(EXCLUDED_ANCESTOR)) return false;
  }
  return true;
}

function candidates(document) {
  const result = [];
  for (const [selector, source, priority] of PRIMARY_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (!visible(element) || !productContext(element)) continue;
      const parsed = parseCurrency(element.textContent || element.getAttribute?.("content"));
      if (parsed) result.push({ ...parsed, source, priority, selector });
    }
  }
  return result.sort((left, right) => right.priority - left.priority);
}

function structuredProduct(document) {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(parsed?.["@graph"] || [])];
      const product = items.find((item) => item && (Array.isArray(item["@type"]) ? item["@type"].includes("Product") : item["@type"] === "Product"));
      if (!product) continue;
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
      const price = parseCurrency(offer.price ?? product.price);
      if (price) return { ...price, source: "STRUCTURED_DATA", sku: product.sku || product.mpn || "", gtin: product.gtin13 || product.gtin12 || product.gtin14 || product.gtin8 || "" };
    } catch { /* malformed structured data is only a fallback */ }
  }
  return null;
}

function shopifyVariant(document, location = globalThis.location) {
  const scripts = [...document.querySelectorAll('script[type="application/json"], script[id*="ProductJson"], script[id*="product-json"]')];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      const product = parsed?.product || parsed;
      if (!Array.isArray(product?.variants)) continue;
      const requestedId = new URL(location?.href || "https://invalid.local").searchParams.get("variant") || document.querySelector('select[name="id"] option:checked, input[name="id"]')?.value;
      const variant = product.variants.find((item) => String(item.id) === String(requestedId)) || product.variants.find((item) => item.available !== false) || product.variants[0];
      if (!variant) continue;
      const amount = Number(variant.price) / (Number(variant.price) > 10000 ? 100 : 1);
      if (!Number.isFinite(amount)) continue;
      const current = { amount, currency: variant.price_currency || product.currency || "MXN", source: "SHOPIFY_SELECTED_VARIANT" };
      const compare = Number(variant.compare_at_price) / (Number(variant.compare_at_price) > 10000 ? 100 : 1);
      return { current, reference: Number.isFinite(compare) && compare > amount ? { amount: compare, currency: current.currency } : null, variantId: variant.id };
    } catch { /* not a Shopify product JSON script */ }
  }
  return null;
}

export function selectProductPrice(document, location = globalThis.location) {
  const domCandidates = candidates(document);
  const structured = structuredProduct(document);
  const shopify = shopifyVariant(document, location);
  const selected = shopify?.current || domCandidates[0] || structured;
  const candidatePrices = [
    ...domCandidates.map(({ amount, source }) => ({ amount, source })),
    ...(shopify?.current ? [{ amount: shopify.current.amount, source: shopify.current.source }] : []),
    ...(structured ? [{ amount: structured.amount, source: structured.source }] : [])
  ];
  const distinct = new Set(candidatePrices.map((candidate) => `${candidate.amount}:${candidate.source}`));
  const amounts = new Set(candidatePrices.map((candidate) => candidate.amount));
  return {
    price: selected ? { amount: selected.amount, currency: selected.currency } : null,
    salePrice: selected ? { amount: selected.amount, currency: selected.currency } : null,
    referencePrice: shopify?.reference || parseCurrency(REFERENCE_SELECTORS.map((selector) => document.querySelector(selector)?.textContent).find(Boolean)),
    priceDiagnostics: { selectedPrice: selected?.amount ?? null, selectedSource: selected?.source || "UNAVAILABLE", candidatePrices: [...new Map([...candidatePrices].map((candidate) => [`${candidate.amount}:${candidate.source}`, candidate])).values()], hasConflict: amounts.size > 1 },
    shopifyVariantId: shopify?.variantId || "",
    _candidateCount: distinct.size
  };
}
