import { searchProducts, getProductHistory, OBSERVATIONS_ENABLED } from "../utils/api.js";
import { formatCurrency } from "../utils/currency.js";
import { ratePrice } from "../utils/rating.js";
import { renderPriceHistory } from "../components/price-history.js";
import { describeRealDiscount, formatPercent, isCurrencyCompatible, normalizeComparisonResponse } from "../utils/real-discount.js";
import { classifyHistoryState, extractionDisplay } from "../utils/popup-state.js";

const $ = (id) => document.getElementById(id);
function showFatalError(message) { $("state").hidden = true; $("content").hidden = true; $("error").hidden = false; $("error").textContent = message; }
function setDiscount(prefix, explanationId, value, reason, currency, metricCurrency) {
  const compatible = isCurrencyCompatible(currency, metricCurrency);
  const result = compatible ? describeRealDiscount(value, reason) : describeRealDiscount(null, "No se puede comparar: las monedas no coinciden.");
  const card = $(prefix).closest(".discount-card"); card.dataset.tone = result.tone;
  $(prefix).textContent = result.label; $(explanationId).textContent = result.explanation;
}
function renderConfidence(lastProduct, match, history) {
  const method = lastProduct.extractionMethod || "No disponible";
  $("confidence").textContent = lastProduct.extractionConfidence || (method.startsWith("adapter:") ? `Adaptador: ${method.slice(8)}` : method);
  $("history-confidence").textContent = history.match?.confidence || match.matchConfidence || "NO DISPONIBLE";
}
function renderExtractedProduct(product) {
  const display = extractionDisplay(product);
  $("product-name").textContent = display.name;
  $("retailer").textContent = display.retailer;
  $("current-price").textContent = formatCurrency(display.price, display.currency);
  $("reference-price").textContent = display.referencePrice !== null ? `Precio anterior: ${formatCurrency(display.referencePrice, display.referenceCurrency)}` : "";
  $("advertised-discount").textContent = display.advertisedDiscountPercent !== null ? `Descuento anunciado: ${formatPercent(display.advertisedDiscountPercent)}` : "";
  $("content").hidden = false;
  $("error").hidden = true;
}
function setHistoryUnavailable(message, reason = "") {
  $("history-status").textContent = "Comparación histórica no disponible";
  $("history-reason").textContent = reason || message || "No se pudo verificar una coincidencia histórica confiable.";
  $("history-status").dataset.tone = "unavailable";
  const currency = lastProductForRender?.price?.currency || "UNKNOWN";
  setDiscount("market-discount", "market-explanation", null, reason, currency, currency);
  setDiscount("retailer-discount", "retailer-explanation", null, reason, currency, currency);
  $("history-confidence").textContent = "NO DISPONIBLE";
  $("rating").textContent = "";
  $("history-statistics").hidden = true;
  $("chart-heading").hidden = true;
  $("chart").hidden = true;
  $("updated").hidden = true;
  $("observe").hidden = true;
}
function setHistoryAvailable(history, match) {
  $("history-status").textContent = "Comparación histórica disponible";
  $("history-reason").textContent = history.match?.reason || "Identidad histórica verificada.";
  $("history-status").dataset.tone = "available";
  $("history-statistics").hidden = false;
  $("chart-heading").hidden = false;
  $("chart").hidden = false;
  $("updated").hidden = false;
  renderConfidence(lastProductForRender, match, history);
}
let lastProductForRender = null;
async function load() {
  try {
    const { lastProduct } = await chrome.storage.session.get("lastProduct");
    if (!lastProduct?.name) return showFatalError("No se reconoció un producto en esta página.");
    lastProductForRender = lastProduct;
    renderExtractedProduct(lastProduct);
    setHistoryUnavailable("", "Consultando historial…");
    const diagnostics = []; const onDiagnostic = (value) => diagnostics.push({ ...value, product: { name: lastProduct.name || "", normalizedProductName: lastProduct.normalizedProductName || "", retailer: lastProduct.retailer || "", currentPrice: lastProduct.price?.amount ?? null, currency: lastProduct.price?.currency || "UNKNOWN" } });
    const identity = (product) => `${product?.url || ""}|${product?.name || ""}|${product?.price?.amount ?? ""}`;
    const productIdentity = identity(lastProduct);
    const stillCurrent = async () => identity((await chrome.storage.session.get("lastProduct")).lastProduct) === productIdentity;
    let match;
    try {
      const search = await searchProducts(lastProduct, { onDiagnostic });
      match = [...(search.products || [])].sort((left, right) => ({ EXACT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }[right.matchConfidence] ?? 0) - ({ EXACT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }[left.matchConfidence] ?? 0))[0] || null;
      if (!(await stillCurrent())) { setHistoryUnavailable("", "La página cambió mientras se consultaba el historial."); return; }
      await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: "SEARCH_SUCCESS", apiDiagnostics: diagnostics } });
    } catch (error) {
      await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: error?.name === "AbortError" ? "SEARCH_TIMEOUT" : "SEARCH_FAILED", apiError: error?.message || "REQUEST_FAILED", apiDiagnostics: diagnostics } });
      return setHistoryUnavailable("", "Error de conexión con el servidor.");
    }
    if (!match) {
      await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: "SEARCH_SUCCESS", apiError: "PRODUCT_NOT_FOUND", apiDiagnostics: diagnostics } });
      return setHistoryUnavailable("", classifyHistoryState({ match }).reason);
    }
    if (["LOW", "UNKNOWN"].includes(match.matchConfidence) && match.identity?.status !== "VERIFIED") {
      await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: "CANDIDATE_UNVERIFIED", databaseMatch: match.name, matchConfidence: match.matchConfidence, apiDiagnostics: diagnostics } });
      return setHistoryUnavailable("", classifyHistoryState({ match }).reason);
    }
    let history;
    try {
      history = normalizeComparisonResponse(await getProductHistory(match.id, match.matchConfidence, { onDiagnostic }));
      if (!(await stillCurrent())) { setHistoryUnavailable("", "La página cambió mientras se consultaba el historial."); return; }
    } catch (error) {
      await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: error?.name === "AbortError" ? "HISTORY_TIMEOUT" : "HISTORY_FAILED", databaseMatch: match.name, apiError: error?.message || "REQUEST_FAILED", apiDiagnostics: diagnostics } });
      return setHistoryUnavailable("", "Error de conexión con el servidor.");
    }
    const historyState = classifyHistoryState({ match, history });
    const statusByHistoryState = { AVAILABLE: "COMPARE_SUCCESS", UNVERIFIED: "CANDIDATE_UNVERIFIED", INSUFFICIENT: "HISTORY_INSUFFICIENT", NOT_FOUND: "HISTORY_NOT_FOUND", MALFORMED: "COMPARE_MALFORMED", ERROR: "COMPARE_FAILED" };
    await chrome.storage.session.set({ lastProduct: { ...lastProduct, apiStatus: statusByHistoryState[historyState.status] || "COMPARE_FAILED", databaseMatch: match.name, matchConfidence: history.match?.confidence || match.matchConfidence, apiError: historyState.status === "AVAILABLE" ? null : historyState.reason, apiDiagnostics: diagnostics } });
    if (historyState.status !== "AVAILABLE") return setHistoryUnavailable("", historyState.reason);
    const stats = history.statistics || {}; const rating = history.rating || ratePrice({ ...stats, currentPrice: lastProduct.price?.amount, observations: stats.observations || history.history?.length || 0 });
    $("rating").textContent = rating.category; $("reason").textContent = rating.reason || "";
    const currency = lastProduct.price?.currency || "MXN";
    $("low").textContent = formatCurrency(stats.historicalLow ?? stats.low, currency); $("average").textContent = formatCurrency(stats.historicalAverage ?? stats.average, currency); $("high").textContent = formatCurrency(stats.historicalHigh ?? stats.high, currency);
    $("low-date").textContent = stats.dateOfLow ? `Fecha: ${stats.dateOfLow}` : ""; $("observations").textContent = stats.observations ?? history.realDiscount?.market?.observations ?? "—";
    $("best-store").textContent = stats.bestStore || "No disponible"; $("updated").textContent = stats.lastUpdated ? `Última actualización: ${stats.lastUpdated}` : "Última actualización: no disponible";
    const discount = history.realDiscount; setDiscount("market-discount", "market-explanation", discount?.marketRealDiscountPercent, discount?.market?.reason || discount?.market?.reasonCode, currency, discount?.market?.currency); setDiscount("retailer-discount", "retailer-explanation", discount?.retailerRealDiscountPercent, discount?.retailer?.reason || discount?.retailer?.reasonCode, currency, discount?.retailer?.currency);
    $("advertised-discount").textContent = typeof discount?.advertisedDiscountPercent === "number" ? `Descuento anunciado: ${formatPercent(discount.advertisedDiscountPercent)}` : $("advertised-discount").textContent;
    setHistoryAvailable(history, match); renderPriceHistory($("chart"), history.history || [], { currentPrice: lastProduct.price?.amount, average: stats.historicalAverage ?? stats.average, currency });
    $("observe").addEventListener("click", async () => {
      const button = $("observe"); button.disabled = true; button.textContent = "Enviando…";
      try { const response = await chrome.runtime.sendMessage({ type: "OBSERVE_PRICE", observation: { name: lastProduct.name, retailer: lastProduct.retailer, url: lastProduct.url, price: lastProduct.price?.amount, salePrice: lastProduct.salePrice?.amount ?? null, currency, extractionMethod: lastProduct.extractionMethod || "generic", adapter: lastProduct.adapter || "generic", matchConfidence: history.match?.confidence || match.matchConfidence || "UNKNOWN" } }); button.textContent = response?.error ? "No aceptado" : "Precio enviado"; } catch { button.textContent = "Error de conexión"; }
      window.setTimeout(() => { button.disabled = false; button.textContent = "Enviar precio observado"; }, 2500);
    }, { once: true });
    $("state").hidden = true; $("observe").hidden = !OBSERVATIONS_ENABLED;
  } catch (error) { showFatalError("No se pudo cargar el producto. Intenta de nuevo."); console.error(error); }
}
load();
