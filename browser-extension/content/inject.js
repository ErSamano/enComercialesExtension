// MV3 content scripts are classic scripts; keep this runtime bundle import-free.
function parseCurrency(value, defaultCurrency = "MXN") {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u00a0/g, " ").trim(); let number = text.replace(/[^0-9,.-]/g, "");
  if (number.includes(",") && number.includes(".")) number = number.replace(/,/g, "");
  else if (number.includes(",")) number = number.replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  const amount = Number.parseFloat(number); const currency = /\b(USD|MXN|EUR|CAD)\b|US\s*\$/i.exec(text)?.[1]?.toUpperCase() || defaultCurrency;
  return Number.isFinite(amount) ? { amount, currency } : null;
}
function meta(selector) { return document.querySelector(selector)?.content?.trim() || ""; }
function firstText(selectors) { return selectors.map((selector) => document.querySelector(selector)?.textContent?.trim()).find(Boolean) || ""; }
function advertisedDiscount() { const text = firstText([".discount", ".discount-percentage", ".vtex-product-price-1-x-savings", "[data-testid='discount']"]); const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/); return match ? Number.parseFloat(match[1].replace(",", ".")) : null; }
function asArray(value) { return Array.isArray(value) ? value : [value]; }
const EXCLUDED_ANCESTOR = /recommend|related|upsell|cross[-_ ]?sell|product[-_ ]?card|collection|carousel/i;
function visible(element) { if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false; const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element); return !(style && (style.display === "none" || style.visibility === "hidden")) && !/\b(hidden|inactive|unavailable|disabled)\b/i.test(element.className || ""); }
function productContext(element) { let current = element; for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) if (EXCLUDED_ANCESTOR.test(String(current.className || "")) || current.getAttribute?.("aria-label")?.match(EXCLUDED_ANCESTOR)) return false; return true; }
function priceCandidates() { const selectors = [[".vtex-product-price-1-x-sellingPriceValue, [class*='sellingPriceValue']", 110], [".price-box .special-price .price, .price-box .sale-price .price", 100], ["[data-product-price], [data-price-role='sale'], .product-single__price, .product__price", 95], ["[itemprop='price']", 90], [".price-item--sale, .sale-price, .selling-price", 85], [".price-box .price", 70], [".le-card__price", 50]]; return selectors.flatMap(([selector, priority]) => [...document.querySelectorAll(selector)].filter((element) => visible(element) && productContext(element)).map((element) => ({ value: parseCurrency(element.textContent || element.getAttribute("content")), priority, source: "PRODUCT_PAGE_PRIMARY_PRICE" }))).filter((candidate) => candidate.value).sort((a, b) => b.priority - a.priority); }
function shopifyVariant() { for (const script of document.querySelectorAll('script[type="application/json"], script[id*="ProductJson"], script[id*="product-json"]')) { try { const parsed = JSON.parse(script.textContent || "null"); const product = parsed?.product || parsed; if (!Array.isArray(product?.variants)) continue; const requestedId = new URL(location.href).searchParams.get("variant") || document.querySelector('select[name="id"] option:checked, input[name="id"]')?.value; const variant = product.variants.find((item) => String(item.id) === String(requestedId)) || product.variants.find((item) => item.available !== false) || product.variants[0]; const amount = Number(variant?.price) / (Number(variant?.price) > 10000 ? 100 : 1); if (!Number.isFinite(amount)) continue; const current = { amount, currency: variant.price_currency || product.currency || "MXN" }; const compare = Number(variant.compare_at_price) / (Number(variant.compare_at_price) > 10000 ? 100 : 1); return { current, reference: Number.isFinite(compare) && compare > amount ? { amount: compare, currency: current.currency } : null, variantId: variant.id }; } catch { /* not product JSON */ } } return null; }
function selectedPrice() { const dom = priceCandidates(); const shopify = shopifyVariant(); const structured = structuredProduct(); const chosen = shopify?.current || dom[0]?.value || structured?.price; const candidatePrices = [...dom.map((candidate) => ({ amount: candidate.value.amount, source: candidate.source })), ...(shopify?.current ? [{ amount: shopify.current.amount, source: "SHOPIFY_SELECTED_VARIANT" }] : []), ...(structured?.price ? [{ amount: structured.price.amount, source: "STRUCTURED_DATA" }] : [])]; return { chosen, reference: shopify?.reference || structured?.referencePrice || null, shopifyVariantId: shopify?.variantId || "", priceDiagnostics: { selectedPrice: chosen?.amount ?? null, selectedSource: shopify?.current ? "SHOPIFY_SELECTED_VARIANT" : dom[0] ? "PRODUCT_PAGE_PRIMARY_PRICE" : structured?.price ? "STRUCTURED_DATA" : "UNAVAILABLE", candidatePrices: [...new Map(candidatePrices.map((candidate) => [`${candidate.amount}:${candidate.source}`, candidate])).values()], hasConflict: new Set(candidatePrices.map((candidate) => candidate.amount)).size > 1 } }; }
function structuredProduct() {
  const items = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const visit = (item) => { if (!item || typeof item !== "object") return; if (item["@graph"]) item["@graph"].forEach(visit); if (item.itemListElement) asArray(item.itemListElement).forEach((entry) => visit(entry.item || entry)); const types = asArray(item["@type"]); if (types.includes("Product") || types.includes("Offer")) items.push(item); }; visit(JSON.parse(script.textContent)); } catch { /* malformed retailer JSON-LD */ }
  }
  const product = items.find((item) => asArray(item["@type"]).includes("Product")) || {}; const offer = asArray(product.offers || items.find((item) => asArray(item["@type"]).includes("Offer")))[0] || {}; const brand = typeof product.brand === "object" ? product.brand.name : product.brand;
  const structuredName = product.name || meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]');
  const structuredPrice = parseCurrency(offer.price ?? product.price);
  if (structuredName || structuredPrice) return { name: structuredName, sku: product.sku || product.mpn || "", gtin: product.gtin13 || product.gtin12 || product.gtin14 || product.gtin8 || "", brand: brand || "", price: structuredPrice, salePrice: parseCurrency(offer.price), referencePrice: null, advertisedDiscountPercent: advertisedDiscount(), currency: offer.priceCurrency || "MXN", image: Array.isArray(product.image) ? product.image[0] : (product.image || meta('meta[property="og:image"]')), url: product.url || document.querySelector('link[rel="canonical"]')?.href || location.href, extractionMethod: "JSON-LD" };
  const name = document.querySelector('[itemprop="name"], h1, [class*="product-title"], [class*="productName"]')?.textContent?.trim() || "";
  const priceText = document.querySelector('[itemprop="price"], [class*="sale-price"], [class*="sellingPrice"], [class*="price"]')?.textContent || "";
  return { name, sku: "", gtin: "", brand: "", price: parseCurrency(priceText), salePrice: parseCurrency(priceText), referencePrice: parseCurrency(firstText([".regular-price", ".list-price", ".old-price", "[class*='listPrice']", "[class*='oldPrice']", "[data-testid*='regular']"])), advertisedDiscountPercent: advertisedDiscount(), currency: "MXN", image: meta('meta[property="og:image"]'), url: document.querySelector('link[rel="canonical"]')?.href || location.href, extractionMethod: "DOM" };
}
const SELECTORS = { Vinoteca: { name: ".vtex-product-identifier-0-x-productName, h1", price: ".vtex-product-price-1-x-sellingPriceValue" }, Alianza: { name: "h1, .vtex-store-components-3-x-productNameContainer", price: ".vtex-product-price-1-x-sellingPriceValue" }, "La Europea": { name: "h1, .page-title", price: ".price-box .price, .le-card__price" }, "Palacio de Hierro": { name: "h1, .product-name", price: ".b-product_price-sales .b-product_price-value, .b-product_price-value" }, "La Castellana": { name: "h1, .product__title", price: ".price-item--sale, .price-item--regular" }, Liverpool: { name: "h1, h3.a-card-description", price: ".a-product-price, .a-card-discount, .a-card-price" } };
const domains = [["vinoteca.com", "Vinoteca"], ["bodegasalianza.com", "Alianza"], ["laeuropea.com.mx", "La Europea"], ["elpalaciodehierro.com", "Palacio de Hierro"], ["lacastellana.com", "La Castellana"], ["liverpool.com.mx", "Liverpool"]];
const retailer = domains.find(([domain]) => location.hostname === domain || location.hostname.endsWith(`.${domain}`))?.[1] || "Unknown retailer"; const selectors = SELECTORS[retailer]; let lastSignature = "";
function emitProduct(force = false) {
  const generic = structuredProduct(); const selected = selectedPrice();
  const referenceSelector = ".vtex-product-price-1-x-listPriceValue, .regular-price, .old-price";
  const product = selectors ? { ...generic, name: document.querySelector(selectors.name)?.textContent?.trim() || generic.name, price: selected.chosen || generic.price, salePrice: selected.chosen || generic.salePrice, referencePrice: selected.reference || parseCurrency(document.querySelector(referenceSelector)?.textContent) || generic.referencePrice, priceDiagnostics: selected.priceDiagnostics, shopifyVariantId: selected.shopifyVariantId, extractionMethod: `adapter:${retailer}`, retailer } : { ...generic, price: selected.chosen || generic.price, salePrice: selected.chosen || generic.salePrice, referencePrice: selected.reference || generic.referencePrice, priceDiagnostics: selected.priceDiagnostics, retailer };
  product.url = location.href;
  const signature = JSON.stringify([product.name, product.price, product.referencePrice, product.advertisedDiscountPercent, product.url, product.sku, product.gtin]);
  if (product.name && (force || signature !== lastSignature)) { lastSignature = signature; chrome.runtime.sendMessage({ type: "PRODUCT_DETECTED", product, supportedRetailer: retailer !== "Unknown retailer" }).catch(() => {}); }
  return product.name ? product : null;
}
emitProduct();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PRODUCT") sendResponse({ product: emitProduct(true) });
});
// A trailing debounce can starve forever on pages with continuously changing widgets.
let mutationTimer = 0;
const observer = new MutationObserver(() => {
  if (mutationTimer) return;
  mutationTimer = window.setTimeout(() => { mutationTimer = 0; emitProduct(); }, 500);
});
if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["content", "value", "class", "hidden"] });
