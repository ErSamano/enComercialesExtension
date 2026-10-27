export function historyEvidence(history) {
  const identity = history?.match?.identity;
  const stats = history?.statistics ?? history?.stats ?? {};
  const points = Array.isArray(history?.history) ? history.history.filter(p => p && typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0 && typeof p.date === "string" && p.date) : [];
  const count = stats.trustedRecords ?? stats.observations ?? points.length;
  const observations = typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : 0;
  const verified = identity?.status === "VERIFIED" && !(identity.conflicts?.length);
  const contradictory = (identity?.status === "VERIFIED" && Boolean(identity.conflicts?.length)) ||
    (!verified && (observations > 0 || points.length > 0 || history?.realDiscount?.market?.status === "AVAILABLE")) ||
    (count === 0 && points.length > 0);
  return { verified, observations, contradictory, trustedHistoryReturned: verified && !contradictory && observations > 0 && !history?.error && history?.status !== "ERROR" && history?.success !== false };
}

export function classifyHistoryState({ match = null, history = null, searchError = false, compareError = false } = {}) {
  if (searchError || compareError) return { status: "ERROR", reason: "Error de conexión con el servidor." };
  if (!match) return { status: "NOT_FOUND", reason: "Producto no encontrado en el historial de enComerciales." };
  if (!history) return { status: "UNVERIFIED", reason: "Se encontró un candidato, pendiente de verificar su identidad histórica." };
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    return { status: "MALFORMED", reason: "La respuesta del servidor no tiene un formato válido." };
  }
  if (history.error || history.status === "ERROR" || history.success === false) return { status: "ERROR", reason: String(history.error || history.message || "API_ERROR") };
  if ((history.history != null && !Array.isArray(history.history)) || (history.statistics != null && (typeof history.statistics !== "object" || Array.isArray(history.statistics)))) return { status: "MALFORMED", reason: "La respuesta del servidor no tiene un formato válido." };
  if (!("match" in history) && !("statistics" in history) && !("history" in history) && !("realDiscount" in history)) {
    return { status: "MALFORMED", reason: "La respuesta del servidor no tiene un formato válido." };
  }
  const evidence = historyEvidence(history);
  if (evidence.contradictory) return { status: "CONTRACT_INCONSISTENT", reason: "El API devolvió datos históricos incompatibles con la verificación de identidad." };
  if (!evidence.verified) return { status: "UNVERIFIED", reason: history.match?.reason || "No se pudo verificar una coincidencia histórica confiable." };
  if (!evidence.trustedHistoryReturned) {
    return { status: "INSUFFICIENT", reason: "Historial insuficiente para una comparación confiable." };
  }
  return { status: "AVAILABLE", reason: history.match?.reason || "Identidad histórica verificada." };
}

export function extractionDisplay(product = {}) {
  return {
    name: product.name || "Producto no identificado",
    retailer: product.retailer || "Tienda no identificada",
    price: product.price?.amount ?? null,
    currency: product.price?.currency || "UNKNOWN",
    referencePrice: product.referencePrice?.amount ?? null,
    referenceCurrency: product.referencePrice?.currency || product.price?.currency || "UNKNOWN",
    advertisedDiscountPercent: typeof product.advertisedDiscountPercent === "number" ? product.advertisedDiscountPercent : null
  };
}
