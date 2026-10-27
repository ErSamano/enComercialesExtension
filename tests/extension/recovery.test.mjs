import assert from "node:assert/strict";
import { selectProductPrice } from "../../browser-extension/utils/price-selection.js";
import { buildCompareQuery } from "../../browser-extension/utils/compare-query.js";
import { classifyHistoryState } from "../../browser-extension/utils/popup-state.js";
import { compareProduct, getProductHistory, searchProducts } from "../../browser-extension/utils/api.js";

class Element {
  constructor(text, className = "", parentElement = null, attrs = {}) { this.textContent = text; this.className = className; this.parentElement = parentElement; this.hidden = false; this.attrs = attrs; this.ownerDocument = { defaultView: { getComputedStyle: () => ({ display: "", visibility: "" }) } }; }
  getAttribute(name) { return this.attrs[name] || null; }
}

function documentWith({ selectors = {}, scripts = [] } = {}) {
  return {
    querySelectorAll(selector) { return selectors[selector] || []; },
    querySelector(selector) { return (selectors[selector] || [])[0] || null; },
    defaultView: { getComputedStyle: () => ({ display: "", visibility: "" }) },
    scripts
  };
}

const primary = new Element("$345.00");
const metadata = { textContent: JSON.stringify({ "@type": "Product", name: "Ron Bacardi Blanco 980 ml", offers: { price: "799.00", priceCurrency: "MXN" } }) };
const conflictDocument = documentWith({
  selectors: { ".price-box .special-price .price, .price-box .sale-price .price": [primary], 'script[type="application/ld+json"]': [metadata] },
  scripts: [metadata]
});
const conflict = selectProductPrice(conflictDocument, { href: "https://laeuropea.com.mx/products/10000001017" });
assert.deepEqual(conflict.price, { amount: 345, currency: "MXN" });
assert.equal(conflict.priceDiagnostics.selectedSource, "PRODUCT_PAGE_PRIMARY_PRICE");
assert.equal(conflict.priceDiagnostics.hasConflict, true);
assert.deepEqual(conflict.priceDiagnostics.candidatePrices, [{ amount: 345, source: "PRODUCT_PAGE_PRIMARY_PRICE" }, { amount: 799, source: "STRUCTURED_DATA" }]);

const recommendationParent = new Element("", "recommendation product-card");
const recommended = new Element("$999.00", "", recommendationParent);
const inactive = new Element("$888.00", "price hidden");
const selectedVariant = new Element("", "", null, { value: "2" });
const shopifyScript = { textContent: JSON.stringify({ id: 1, currency: "MXN", variants: [{ id: 1, price: 79900, compare_at_price: 90000, available: true }, { id: 2, price: 34500, compare_at_price: 79900, available: true }] }) };
const variantDocument = documentWith({
  selectors: {
    ".price-box .price": [recommended, inactive],
    'select[name="id"] option:checked, input[name="id"]': [selectedVariant],
    'script[type="application/json"], script[id*="ProductJson"], script[id*="product-json"]': [shopifyScript]
  }
});
const variant = selectProductPrice(variantDocument, { href: "https://laeuropea.com.mx/products/10000001017?variant=2" });
assert.deepEqual(variant.price, { amount: 345, currency: "MXN" });
assert.deepEqual(variant.referencePrice, { amount: 799, currency: "MXN" });
assert.equal(variant.priceDiagnostics.selectedSource, "SHOPIFY_SELECTED_VARIANT");

const noIdentity = selectProductPrice(documentWith(), { href: "https://example.test/product" });
assert.equal(noIdentity.price, null);
assert.equal(noIdentity.priceDiagnostics.selectedSource, "UNAVAILABLE");
assert.equal(noIdentity.priceDiagnostics.hasConflict, false);
const alianzaPrice = new Element("$475.00");
const alianzaDocument = documentWith({ selectors: { ".vtex-product-price-1-x-sellingPriceValue, [class*='sellingPriceValue']": [alianzaPrice] } });
assert.deepEqual(selectProductPrice(alianzaDocument).price, { amount: 475, currency: "MXN" });
assert.equal(buildCompareQuery({ name: "Chivas Regal 12 Años 750 ml", price: { amount: 475, currency: "MXN" }, retailer: "Alianza" }).store, "Alianza");
assert.equal(classifyHistoryState({ match: { matchConfidence: "LOW" } }).reason.includes("verificar"), true);
assert.equal(classifyHistoryState({ match: null }).reason, "Producto no encontrado en el historial de enComerciales.");

globalThis.chrome = { storage: { local: { async get(defaults) { return defaults; } } } };
const requests = [];
globalThis.fetch = async (url) => { requests.push(String(url)); return { ok: true, status: 200, async json() { return { products: [{ id: "chivas-id", name: "Chivas Regal 12 Años 750 ml", matchConfidence: "EXACT" }] }; } }; };
const diagnostics = [];
await searchProducts({ name: "Chivas Regal 12 Años 750 ml", sku: "", gtin: "" }, { onDiagnostic: (value) => diagnostics.push(value) });
assert.match(requests[0], /name=Chivas\+Regal\+12\+A%C3%B1os\+750\+ml/);
assert.equal(diagnostics[0].endpoint, "/api/products/search");
assert.equal(diagnostics[0].request.name, "Chivas Regal 12 Años 750 ml");
assert.equal(diagnostics[0].trustedHistoryReturned, false);
requests.length = 0;
await getProductHistory("chivas-id", "EXACT", { onDiagnostic: (value) => diagnostics.push(value) });
assert.match(requests[0], /\/api\/products\/history\?id=chivas-id&confidence=EXACT/);

const invalidDiagnostics = [];
await assert.rejects(() => compareProduct({ name: "Chivas", price: null, retailer: "Alianza" }, { onDiagnostic: value => invalidDiagnostics.push(value) }), /INVALID_COMPARISON_INPUT/);
assert.equal(invalidDiagnostics[0].apiStatus, "INVALID_COMPARISON_INPUT");
assert.equal(requests.length, 1);
await assert.rejects(() => compareProduct({ name: "Chivas", price: { amount: 475, currency: "UNKNOWN" }, retailer: "" }), /INVALID_COMPARISON_INPUT/);

globalThis.fetch = async () => ({ ok: false, status: 400, async json() { return { status: "INVALID_QUERY", reasonCode: "INVALID_QUERY" }; } });
const failedCompareDiagnostics = [];
await assert.rejects(() => compareProduct({ name: "Chivas", price: { amount: 475, currency: "MXN" }, retailer: "Alianza" }, { onDiagnostic: value => failedCompareDiagnostics.push(value) }), /API_400/);
assert.equal(failedCompareDiagnostics[0].httpStatus, 400);
assert.equal(failedCompareDiagnostics[0].apiStatus, "INVALID_QUERY");

globalThis.fetch = async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; };
await assert.rejects(() => searchProducts({ name: "Bacardi" }, { onDiagnostic: (value) => diagnostics.push(value) }), { name: "AbortError" });
assert.equal(diagnostics.at(-1).apiStatus, "TIMEOUT");

console.log("extension recovery regressions ok");
