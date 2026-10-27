import { buildCompareQuery, validateComparisonInput } from "./compare-query.js";
import { historyEvidence } from "./popup-state.js";

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
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let responseReceived = false;
  try {
    const response = await fetch(endpoint, { ...options, signal: controller.signal, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const body = await response.json();
    responseReceived = true;
    diagnostic?.({ endpoint: new URL(endpoint).pathname, request: Object.fromEntries(new URL(endpoint).searchParams), httpStatus: response.status, apiStatus: body?.status || body?.error || "UNKNOWN", matchConfidence: body?.match?.confidence || body?.products?.[0]?.matchConfidence || null, reasonCode: body?.match?.reasonCode || body?.reasonCode || body?.error || null, identityStatus: body?.match?.identity?.status || null, ...historyEvidence(body) });
    if (!response.ok) throw new Error(`API_${response.status}`);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("API_MALFORMED");
    if (body.error || body.status === "ERROR" || body.success === false) throw new Error(String(body.error || body.message || "API_ERROR"));
    return body;
  } catch (error) {
    if (!responseReceived) diagnostic?.({ endpoint: new URL(endpoint).pathname, request: Object.fromEntries(new URL(endpoint).searchParams), httpStatus: error?.name === "AbortError" ? 408 : null, apiStatus: error?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED", matchConfidence: null, reasonCode: error?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED", trustedHistoryReturned: false });
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}

export function searchProducts(product, options = {}) {
  const query = new URLSearchParams({ name: product.name || "", sku: product.sku || "", gtin: product.gtin || "", limit: "5" });
  return request(`/products/search?${query}`, { signal: options.signal }, options.onDiagnostic);
}

export function getProductHistory(id, confidence = "UNKNOWN", options = {}) { return request(`/products/history?id=${encodeURIComponent(id)}&confidence=${encodeURIComponent(confidence)}`, { signal: options.signal }, options.onDiagnostic); }
export function compareProduct(product, options = {}) {
  const validation = validateComparisonInput(product);
  if (!validation.valid) {
    const error = new Error(`INVALID_COMPARISON_INPUT:${validation.errors.join(",")}`);
    error.code = "INVALID_COMPARISON_INPUT";
    options.onDiagnostic?.({ endpoint: "/api/products/compare", httpStatus: null, apiStatus: "INVALID_COMPARISON_INPUT", reasonCode: validation.errors.join(","), request: buildCompareQuery(product), trustedHistoryReturned: false });
    return Promise.reject(error);
  }
  const query = new URLSearchParams(buildCompareQuery(product));
  return request(`/products/compare?${query}`, { signal: options.signal }, options.onDiagnostic);
}
export function observePrice() { return Promise.resolve({ error: "OBSERVATIONS_DISABLED" }); }
export function healthCheck() { return request('/health'); }
