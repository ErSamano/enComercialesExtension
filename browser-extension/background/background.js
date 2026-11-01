import { getSettings } from "../utils/api.js";
import { normalizeProductName } from "../utils/product-normalizer.js";

const RETAILER_HOSTS = ["vinoteca.com", "bodegasalianza.com", "laeuropea.com.mx", "elpalaciodehierro.com", "lacastellana.com", "liverpool.com.mx"];
function isSupportedPage(sender) {
  if (!Number.isInteger(sender.tab?.id) || typeof sender.tab.url !== "string") return false;
  try {
    const url = new URL(sender.tab.url);
    return url.protocol === "https:" && RETAILER_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
function boundedText(value, max = 300) { return typeof value === "string" ? value.slice(0, max) : ""; }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PRODUCT_DETECTED") {
    if (!isSupportedPage(sender) || !message.product || typeof message.product !== "object") return false;
    const product = message.product;
    const name = boundedText(product.name, 300).trim();
    if (!name) return false;
    const detected = {
      name,
      rawProductName: name,
      normalizedProductName: normalizeProductName(name),
      sku: boundedText(product.sku, 100),
      gtin: boundedText(product.gtin, 32),
      brand: boundedText(product.brand, 100),
      retailer: boundedText(product.retailer, 80),
      url: sender.tab.url,
      image: "",
      price: product.price && Number.isFinite(product.price.amount) && product.price.amount > 0
        ? { amount: product.price.amount, currency: boundedText(product.price.currency, 3) }
        : null,
      salePrice: product.salePrice && Number.isFinite(product.salePrice.amount) && product.salePrice.amount > 0
        ? { amount: product.salePrice.amount, currency: boundedText(product.salePrice.currency, 3) }
        : null,
      referencePrice: product.referencePrice && Number.isFinite(product.referencePrice.amount) && product.referencePrice.amount > 0
        ? { amount: product.referencePrice.amount, currency: boundedText(product.referencePrice.currency, 3) }
        : null,
      advertisedDiscountPercent: Number.isFinite(product.advertisedDiscountPercent) ? product.advertisedDiscountPercent : null,
      extractionMethod: boundedText(product.extractionMethod, 50),
      adapter: typeof product.extractionMethod === "string" && product.extractionMethod.startsWith("adapter:") ? boundedText(product.extractionMethod.slice(8), 50) : "generic",
      tabId: sender.tab.id,
      detectedAt: new Date().toISOString(),
      apiStatus: "NOT_TESTED"
    };
    const values = { lastProduct: detected };
    values[`product:${sender.tab.id}`] = detected;
    chrome.storage.session.set(values).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ error: "STORAGE_FAILED" }));
    return true;
  }
  if (message?.type === "OBSERVE_PRICE") { sendResponse({ error: "OBSERVATIONS_DISABLED" }); return false; }
  if (message?.type === "DEBUG") { getSettings().then(({ debug }) => sendResponse({ debug })).catch(() => sendResponse({ debug: false })); return true; }
  return false;
});

// A different tab must never replace the product shown in the active popup.
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove([`product:${tabId}`, `analysis:${tabId}`]);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') chrome.storage.session.remove([`product:${tabId}`, `analysis:${tabId}`]);
});
