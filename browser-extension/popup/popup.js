import { analyzeProduct, createAnalysisRunner, productKey, analysisKey } from '../utils/analysis.js';
import { getSettings } from '../utils/api.js';
import { renderExtractedProduct, renderPending, renderResult, renderFatal } from './render.js';

const $ = id => document.getElementById(id);
const runner = createAnalysisRunner();
const CACHE_TTL_MS = 60000;
let activeTabId = null;
let displayedKey = null;
let controller = null;
let currentProduct = null;

function save(values) {
  // Diagnostics/cache failures must never hide an already received result.
  return chrome.storage.session.set(values).catch(error => console.warn('Could not save analysis', error));
}
function diagnosticResult(product, result, diagnostics) {
  const { state, match, history, comparisonStatus, comparisonWarning } = result;
  const statuses = { AVAILABLE: comparisonStatus === 'COMPARE_SUCCESS' ? 'COMPARE_SUCCESS' : 'HISTORY_VERIFIED', UNVERIFIED: 'CANDIDATE_UNVERIFIED', INSUFFICIENT: 'HISTORY_INSUFFICIENT', NOT_FOUND: 'HISTORY_NOT_FOUND', MALFORMED: 'API_ERROR', ERROR: 'API_ERROR', CONTRACT_INCONSISTENT: 'API_CONTRACT_INCONSISTENT' };
  return { productKey: productKey(product), analysisKey: analysisKey(product), apiStatus: statuses[state.status], databaseMatch: match?.name, matchConfidence: history?.match?.confidence || match?.matchConfidence, apiError: state.status === 'AVAILABLE' ? null : state.reason, comparisonWarning, apiDiagnostics: diagnostics };
}
async function loadProduct(lastProduct, { force = false } = {}) {
  if (lastProduct?.tabId !== activeTabId || !lastProduct?.name) {
    runner.invalidate(); controller?.abort(); displayedKey = null; currentProduct = null;
    renderFatal('No se reconoció un producto en esta página. Abre la página de un producto y vuelve a intentar.');
    $('retry').hidden = false;
    $('retry').disabled = false;
    return;
  }
  const key = analysisKey(lastProduct);
  if (!force && key === displayedKey) return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const isCurrent = runner.begin();
  displayedKey = key;
  currentProduct = lastProduct;
  renderExtractedProduct(lastProduct);
  renderPending();
  $('retry').hidden = false;
  $('retry').disabled = true;
  $('retry').textContent = 'Consultando…';
  const diagnostics = [];
  const onDiagnostic = value => diagnostics.push(value);
  let showedHistory = false;
  const display = result => {
    if (!isCurrent()) return;
    renderResult(lastProduct, result);
    showedHistory = result.state.status === 'AVAILABLE';
  };
  try {
    const { apiBaseUrl } = await getSettings();
    const cacheName = `analysis:${activeTabId}`;
    const stored = await chrome.storage.session.get(cacheName).catch(() => ({}));
    if (!isCurrent()) return;
    const cache = stored[cacheName];
    if (!force && cache?.key === key && cache.apiBaseUrl === apiBaseUrl && Date.now() - cache.savedAt < CACHE_TTL_MS) {
      display(cache.result);
      if (cache.complete) return;
    }
    const onResult = result => {
      if (!isCurrent()) return;
      display(result);
      // Reopening the popup can immediately recover history even if compare is pending.
      void save({ [cacheName]: { key, apiBaseUrl, savedAt: Date.now(), complete: false, result } });
    };
    const result = await analyzeProduct(lastProduct, { onDiagnostic, onResult, signal, isCurrent });
    if (!isCurrent() || !result) return;
    display(result);
    const values = { analysisResult: diagnosticResult(lastProduct, result, diagnostics) };
    if (result.state.status === 'AVAILABLE') values[cacheName] = { key, apiBaseUrl, savedAt: Date.now(), complete: true, result };
    void save(values);
  } catch (error) {
    if (!isCurrent()) return;
    if (!showedHistory) renderResult(lastProduct, { state: { status: 'ERROR', reason: error.name === 'AbortError' ? 'El servidor tardó demasiado. Intenta de nuevo.' : 'No se pudo consultar el historial. Revisa tu conexión e intenta de nuevo.' } });
    void save({ analysisResult: { productKey: productKey(lastProduct), analysisKey: key, apiStatus: 'API_ERROR', apiError: error.message, apiDiagnostics: diagnostics } });
  } finally {
    if (isCurrent()) {
      $('retry').disabled = false;
      $('retry').textContent = showedHistory ? 'Actualizar' : 'Reintentar';
    }
  }
}
async function load({ force = false } = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;
    if (activeTabId === null) return loadProduct(null);
    // Ask the page itself: session storage can belong to a previous navigation.
    let product;
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_PRODUCT' });
      product = response?.product ? { ...response.product, tabId: activeTabId } : null;
    } catch {
      // Content scripts from an earlier extension version may not support GET_PRODUCT.
      const stored = await chrome.storage.session.get([`product:${activeTabId}`]);
      product = stored[`product:${activeTabId}`];
    }
    await loadProduct(product, { force });
  } catch {
    renderFatal('No se pudo cargar el producto. Intenta de nuevo.');
    $('retry').hidden = false;
    $('retry').disabled = false;
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && activeTabId !== null && changes[`product:${activeTabId}`]) {
    void loadProduct(changes[`product:${activeTabId}`].newValue);
  }
  if (area === 'local' && changes.apiBaseUrl && currentProduct) void loadProduct(currentProduct, { force: true });
});
$('retry').addEventListener('click', () => load({ force: true }));
window.addEventListener('pagehide', () => { runner.invalidate(); controller?.abort(); });
void load();
