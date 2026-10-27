import { formatCurrency } from '../utils/currency.js';
import { ratePrice } from '../utils/rating.js';
import { renderPriceHistory } from '../components/price-history.js';
import { describeRealDiscount, formatPercent, isCurrencyCompatible } from '../utils/real-discount.js';
import { extractionDisplay } from '../utils/popup-state.js';

const $ = id => document.getElementById(id);
export function renderExtractedProduct(product) {
  const display = extractionDisplay(product);
  $('product-name').textContent = display.name;
  $('retailer').textContent = display.retailer;
  $('current-price').textContent = formatCurrency(display.price, display.currency);
  $('reference-price').textContent = display.referencePrice !== null ? `Antes: ${formatCurrency(display.referencePrice, display.referenceCurrency)}` : '';
  $('advertised-discount').textContent = display.advertisedDiscountPercent !== null ? `Anunciado: ${formatPercent(display.advertisedDiscountPercent)}` : '';
  $('content').hidden = false;
  $('error').hidden = true;
  $('state').hidden = true;
}
export function renderPending() {
  $('history-summary').hidden = true;
  $('history-statistics').hidden = true;
  $('chart').hidden = true;
  $('rating').hidden = true;
  $('history-status-panel').hidden = false;
  $('history-status-panel').dataset.tone = 'loading';
  $('history-status').textContent = 'Consultando historial…';
  $('history-reason').textContent = '';
  $('history-details').open = false;
}
function renderDiscount(prefix, value, currency, metricCurrency) {
  const result = describeRealDiscount(isCurrencyCompatible(currency, metricCurrency) ? value : null);
  $(prefix + '-card').hidden = !result.available;
  $(prefix + '-card').dataset.tone = result.tone;
  $(prefix + '-discount').textContent = result.label;
  $(prefix + '-explanation').textContent = result.explanation;
  return result.available;
}
export function renderResult(product, result) {
  const { history, state, comparisonStatus } = result;
  if (state.status !== 'AVAILABLE') {
    renderPending();
    $('history-status-panel').dataset.tone = 'unavailable';
    $('history-status').textContent = state.status === 'NOT_FOUND' ? 'Sin historial para este producto' : 'Historial no disponible';
    $('history-reason').textContent = state.reason || '';
    return;
  }
  $('history-status-panel').hidden = true;
  $('history-summary').hidden = false;
  $('history-statistics').hidden = false;
  $('chart').hidden = false;
  const stats = history.statistics || {};
  const currentPrice = product.price?.amount;
  const currency = stats.currency || product.price?.currency || 'MXN';
  const currentValid = Number.isFinite(currentPrice) && currentPrice > 0 && isCurrencyCompatible(product.price?.currency, stats.currency);
  const rating = currentValid ? ratePrice({ ...stats, currentPrice, observations: stats.trustedRecords ?? stats.observations ?? history.history?.length ?? 0 }) : null;
  const labels = { 'GREAT DEAL': 'Muy buen precio', 'GOOD DEAL': 'Buen precio', 'NORMAL PRICE': 'Precio habitual', 'EXPENSIVE': 'Precio alto' };
  $('rating').textContent = labels[rating?.category] || '';
  $('rating').hidden = !labels[rating?.category];
  $('rating').dataset.tone = rating?.category === 'EXPENSIVE' ? 'negative' : rating?.category === 'NORMAL PRICE' ? 'neutral' : 'positive';
  $('rating').title = rating?.reason || '';
  $('low').textContent = formatCurrency(stats.historicalLow ?? stats.low, currency);
  $('average').textContent = formatCurrency(stats.historicalAverage ?? stats.average, currency);
  $('high').textContent = formatCurrency(stats.historicalHigh ?? stats.high, currency);
  $('observations').textContent = stats.trustedRecords ?? stats.observations ?? history.history?.length ?? '—';
  $('best-store').textContent = stats.bestStore || 'No disponible';
  $('low-date').textContent = stats.dateOfLow || '';
  $('updated').textContent = stats.lastUpdated ? `Actualizado: ${stats.lastUpdated}` : '';
  const discount = currentValid ? history.realDiscount : null;
  renderDiscount('market', discount?.marketRealDiscountPercent, product.price?.currency, discount?.market?.currency);
  const retailerAvailable = renderDiscount('retailer', discount?.retailerRealDiscountPercent, product.price?.currency, discount?.retailer?.currency);
  $('comparison-note').textContent = comparisonStatus === 'PENDING' ? 'Consultando comparación de la tienda…' : retailerAvailable ? '' : 'Sin comparación histórica para esta tienda.';
  renderPriceHistory($('chart'), history.history || [], { currentPrice: currentValid ? currentPrice : null, average: stats.historicalAverage ?? stats.average, currency });
}
export function renderFatal(message) {
  $('state').hidden = true;
  $('content').hidden = true;
  $('error').hidden = false;
  $('error').textContent = message;
}
