const UNAVAILABLE = "Descuento real no disponible";

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeComparisonResponse(response = {}) {
  const realDiscount = response.realDiscount || null;
  return {
    ...response,
    statistics: response.statistics || response.stats || {},
    realDiscount: realDiscount ? {
      marketRealDiscountPercent: realDiscount.market?.status === "AVAILABLE" ? numberOrNull(realDiscount.marketRealDiscountPercent ?? realDiscount.market?.realDiscountPercent) : null,
      retailerRealDiscountPercent: realDiscount.retailer?.status === "AVAILABLE" ? numberOrNull(realDiscount.retailerRealDiscountPercent ?? realDiscount.retailer?.realDiscountPercent) : null,
      advertisedDiscountPercent: numberOrNull(realDiscount.advertisedDiscountPercent),
      market: realDiscount.market || {},
      retailer: realDiscount.retailer || {}
    } : null
  };
}

function trustedSample(statistics = {}) {
  const observations = Number(statistics.trustedRecords ?? statistics.observations ?? 0);
  return statistics.sampleStatus === "SUFFICIENT" && Number.isFinite(observations) && observations >= 3;
}

function fallbackPercent(average, currentPrice) {
  return Number.isFinite(average) && average > 0 && Number.isFinite(currentPrice) && currentPrice > 0
    ? ((average - currentPrice) / average) * 100 : null;
}

export function applyVerifiedHistoryFallback(normalized, { currentPrice, currentCurrency } = {}) {
  const statistics = normalized.statistics || {};
  if (!trustedSample(statistics) || !Number.isFinite(currentPrice) || currentPrice <= 0) return normalized;
  const api = normalized.realDiscount || {};
  const market = api.market || {};
  const retailer = api.retailer || {};
  // An explicit API rejection is authoritative; a browser fallback must not override it.
  const marketRejected = market.status && market.status !== "AVAILABLE";
  const retailerRejected = retailer.status && retailer.status !== "AVAILABLE";
  const marketCurrency = market.currency || statistics.currency;
  const marketAverage = Number(statistics.historicalAverage ?? statistics.average);
  const retailerAverage = Number(statistics.retailerHistoricalAverage ?? statistics.retailerAverage ?? retailer.average ?? retailer.historicalAverage);
  const retailerCurrency = retailer.currency || statistics.retailerCurrency || statistics.currency;
  const retailerObservations = Number(statistics.retailerTrustedRecords ?? retailer.trustedRecords ?? retailer.observations ?? 0);
  const retailerSampleSufficient = (statistics.retailerSampleStatus === "SUFFICIENT" || retailer.sampleStatus === "SUFFICIENT" || retailerObservations >= 3);
  const compatible = (metric) => !metric || !currentCurrency || String(metric).toUpperCase() === String(currentCurrency).toUpperCase();
  const result = { ...normalized, realDiscount: { ...api, marketRealDiscountPercent: api.marketRealDiscountPercent ?? null, retailerRealDiscountPercent: api.retailerRealDiscountPercent ?? null, market: { ...market }, retailer: { ...retailer } } };
  if (result.realDiscount.marketRealDiscountPercent != null) result.realDiscount.market.source = "API";
  if (result.realDiscount.retailerRealDiscountPercent != null) result.realDiscount.retailer.source = "API";
  if (result.realDiscount.marketRealDiscountPercent == null && !marketRejected && compatible(marketCurrency)) {
    const value = fallbackPercent(marketAverage, currentPrice);
    if (value != null) { result.realDiscount.marketRealDiscountPercent = value; result.realDiscount.market.source = "VERIFIED_HISTORY_FALLBACK"; result.realDiscount.market.currency = marketCurrency; }
  }
  if (result.realDiscount.retailerRealDiscountPercent == null && !retailerRejected && retailerSampleSufficient && compatible(retailerCurrency)) {
    const value = fallbackPercent(retailerAverage, currentPrice);
    if (value != null) { result.realDiscount.retailerRealDiscountPercent = value; result.realDiscount.retailer.source = "VERIFIED_HISTORY_FALLBACK"; result.realDiscount.retailer.currency = retailerCurrency; }
  }
  return result;
}

export function formatPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function describeRealDiscount(value, unavailableReason = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return { available: false, label: UNAVAILABLE, explanation: unavailableReason || "El API no proporcionó una comparación histórica confiable.", tone: "unavailable" };
  if (Math.abs(value) < 0.05) return { available: true, label: "0.0%", explanation: "El precio es similar al promedio histórico.", tone: "neutral" };
  if (value > 0) return { available: true, label: formatPercent(value), explanation: `Estás pagando ${Math.abs(value).toFixed(1)}% menos que el promedio histórico.`, tone: "positive" };
  return { available: true, label: formatPercent(value), explanation: `Este precio está ${Math.abs(value).toFixed(1)}% por encima del promedio histórico.`, tone: "negative" };
}

export function isCurrencyCompatible(currentCurrency, metricCurrency) {
  return !metricCurrency || !currentCurrency || String(currentCurrency).toUpperCase() === String(metricCurrency).toUpperCase();
}

export { UNAVAILABLE };
