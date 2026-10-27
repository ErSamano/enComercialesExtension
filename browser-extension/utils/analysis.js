import { searchProducts, getProductHistory, compareProduct } from './api.js';
import { classifyHistoryState } from './popup-state.js';
import { normalizeComparisonResponse, applyVerifiedHistoryFallback } from './real-discount.js';
import { productMatchConfidence } from './product-normalizer.js';

export const productKey = product => JSON.stringify([product?.tabId, product?.detectedAt, product?.url, product?.name, product?.retailer, product?.price, product?.referencePrice, product?.sku, product?.gtin]);
// Detection timestamps are events, not product changes.
export const analysisKey = product => JSON.stringify([product?.tabId, product?.url, product?.name, product?.retailer, product?.price, product?.referencePrice, product?.sku, product?.gtin, product?.advertisedDiscountPercent]);

function identityCompatible(product, candidate) {
  if (!candidate?.name || candidate.identity?.status === "REJECTED") return false;
  if (product.gtin && candidate.gtin) return product.gtin === candidate.gtin;
  if (product.sku && candidate.sku) return product.sku === candidate.sku;
  return ["EXACT", "HIGH", "MEDIUM"].includes(productMatchConfidence(product, candidate));
}

function selectCandidate(product, products) {
  const rank = { EXACT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
  return [...products]
    .filter(candidate => identityCompatible(product, candidate))
    .sort((a, b) => (rank[b.matchConfidence] || 0) - (rank[a.matchConfidence] || 0))[0] || null;
}

// Each runner belongs to one popup. A newer load invalidates all older completions.
export function createAnalysisRunner() {
  let generation = 0;
  return {
    begin() { const id = ++generation; return () => id === generation; },
    invalidate() { generation += 1; }
  };
}

export async function analyzeProduct(product, { onDiagnostic, onResult, signal, isCurrent = async () => true } = {}) {
  const options = { onDiagnostic, signal };
  const search = await searchProducts(product, options);
  if (!(await isCurrent())) return null;
  if (!Array.isArray(search.products)) throw new Error('SEARCH_MALFORMED');
  const match = selectCandidate(product, search.products);
  if (!match) return { match: null, history: null, state: classifyHistoryState() };
  if (typeof match.id !== 'string' || !match.id) throw new Error('MISSING_CANDIDATE_ID');
  // IDs are opaque: never decode, normalize, repair mojibake or re-encode them.
  const raw = await getProductHistory(match.id, match.matchConfidence, options);
  if (!(await isCurrent())) return null;
  const state = classifyHistoryState({ match, history: raw });
  if (state.status === 'AVAILABLE' && !identityCompatible(product, raw.product || match)) {
    state.status = 'CONTRACT_INCONSISTENT';
    state.reason = 'El historial verificado pertenece a otro producto.';
    onDiagnostic?.({ endpoint: '/api/products/history', httpStatus: 200, apiStatus: 'IDENTITY_CONTRACT_INCONSISTENT', reasonCode: 'HISTORY_PRODUCT_MISMATCH', identityStatus: raw.match?.identity?.status || null, matchConfidence: raw.match?.confidence || null, product: { name: product.name || '' }, historyProduct: { name: raw.product?.name || '' } });
  }
  let history = normalizeComparisonResponse(raw);
  if (state.status === 'AVAILABLE') history = applyVerifiedHistoryFallback(history, { currentPrice: product.price?.amount, currentCurrency: product.price?.currency });
  let comparisonWarning = null;
  let comparisonStatus = 'NOT_ATTEMPTED';
  if (state.status === 'AVAILABLE') {
    // History is already usable. Never hold it behind the optional comparison.
    onResult?.({ match, history, state, comparisonWarning, comparisonStatus: 'PENDING' });
    try {
      const comparison = await compareProduct(product, options);
      if (!(await isCurrent())) return null;
      comparisonStatus = 'COMPARE_SUCCESS';
      const comparisonState = classifyHistoryState({ match, history: comparison });
      // Compare can independently select another candidate. Never attach its metrics.
      if (comparisonState.status === 'AVAILABLE' && comparison.product?.id === match.id) {
        history.realDiscount = normalizeComparisonResponse(comparison).realDiscount;
      } else { comparisonWarning = comparisonState.status === 'AVAILABLE' ? 'COMPARISON_PRODUCT_MISMATCH' : comparisonState.status; comparisonStatus = 'COMPARE_FAILED'; }
    } catch (error) {
      comparisonWarning = error.message;
      comparisonStatus = error.code === 'INVALID_COMPARISON_INPUT' ? 'INVALID_COMPARISON_INPUT' : 'COMPARE_FAILED';
      if (/^API_4\d\d$/.test(error.message || '') || error.code === 'INVALID_COMPARISON_INPUT') history.realDiscount = null;
    }
  }
  if (!(await isCurrent())) return null;
  return { match, history, state, comparisonWarning, comparisonStatus };
}
