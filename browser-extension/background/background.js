import { getSettings, observePrice } from "../utils/api.js";
import { normalizeProductName } from "../utils/product-normalizer.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PRODUCT_DETECTED") { const product = message.product || {}; const detected = { ...product, rawProductName: product.name || "", normalizedProductName: normalizeProductName(product.name), adapter: product.extractionMethod?.startsWith("adapter:") ? product.extractionMethod.slice(8) : "generic", tabId: sender.tab?.id, detectedAt: new Date().toISOString(), apiStatus: "NOT_TESTED" };
    const values = { lastProduct: detected };
    if (Number.isInteger(sender.tab?.id)) values[`product:${sender.tab.id}`] = detected;
    chrome.storage.session.set(values).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ error: "STORAGE_FAILED" }));
    return true;
  }
  if (message.type === "OBSERVE_PRICE") { observePrice(message.observation).then(sendResponse).catch((error) => sendResponse({ error: error.message })); return true; }
  if (message.type === "DEBUG") { getSettings().then(({ debug }) => sendResponse({ debug })); return true; }
  return false;
});

// A different tab must never replace the product shown in the active popup.
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove([`product:${tabId}`, `analysis:${tabId}`]);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') chrome.storage.session.remove([`product:${tabId}`, `analysis:${tabId}`]);
});
