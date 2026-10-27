import { buildCompareQuery } from "./compare-query.js";

const DEFAULT_API_URL = "https://encomerciales.com/api";
export const OBSERVATIONS_ENABLED = false;

export function buildApiUrl(apiBaseUrl, path) {
  const parsed = new URL(String(apiBaseUrl || ""));
  parsed.search = "";
  parsed.hash = "";
  const base = parsed.toString().replace(/\/+$/, "");
  const endpoint = String(path || "").replace(/^\/+/, "");
  return `${base}/${endpoint}`;
}

export async function getSettings() {
  const values = await chrome.storage.local.get({ apiBaseUrl: DEFAULT_API_URL, debug: false });
  return { ...values, apiBaseUrl: String(values.apiBaseUrl).replace(/\/$/, "") };
}

const REQUEST_TIMEOUT_MS = 8000;

async function request(path, options = {}, diagnostic = null) {
  const { apiBaseUrl } = await getSettings();
  const endpoint = buildApiUrl(apiBaseUrl, path);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, { ...options, signal: controller.signal, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const body = await response.json().catch(() => ({}));
    diagnostic?.({ endpoint: new URL(endpoint).pathname, request: Object.fromEntries(new URL(endpoint).searchParams), httpStatus: response.status, apiStatus: body?.status || body?.error || "UNKNOWN", matchConfidence: body?.match?.confidence || body?.products?.[0]?.matchConfidence || null, reasonCode: body?.reasonCode || body?.error || null, trustedHistoryReturned: Boolean(body?.statistics || body?.history || body?.realDiscount) });
    if (!response.ok) throw new Error(`API_${response.status}`);
    return body;
  } catch (error) {
    diagnostic?.({ endpoint: new URL(endpoint).pathname, request: Object.fromEntries(new URL(endpoint).searchParams), httpStatus: error?.name === "AbortError" ? 408 : null, apiStatus: error?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED", matchConfidence: null, reasonCode: error?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED", trustedHistoryReturned: false });
    throw error;
  } finally { clearTimeout(timer); }
}

export function searchProducts(product, options = {}) {
  const query = new URLSearchParams({ name: product.name || "", sku: product.sku || "", gtin: product.gtin || "", limit: "5" });
  return request(`/products/search?${query}`, {}, options.onDiagnostic);
}

export function getProductHistory(id, confidence = "UNKNOWN", options = {}) { return request(`/products/history?id=${encodeURIComponent(id)}&confidence=${encodeURIComponent(confidence)}`, {}, options.onDiagnostic); }
export function compareProduct(product, options = {}) {
  const query = new URLSearchParams(buildCompareQuery(product));
  return request(`/products/compare?${query}`, {}, options.onDiagnostic);
}
export function observePrice() { return Promise.resolve({ error: "OBSERVATIONS_DISABLED" }); }
export async function healthCheck() {
  const { apiBaseUrl } = await getSettings();
  const response = await fetch(buildApiUrl(apiBaseUrl, "/health"), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`API_${response.status}`);
  return response.json();
}
