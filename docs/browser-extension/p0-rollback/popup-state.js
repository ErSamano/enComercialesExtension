const LOW_CONFIDENCE = new Set(["LOW", "UNKNOWN"]);

export function classifyHistoryState({ match = null, history = null, searchError = false, compareError = false } = {}) {
  if (searchError || compareError) return { status: "ERROR", reason: "Error de conexión con el servidor." };
  if (!match) return { status: "NOT_FOUND", reason: "Producto no encontrado en el historial de enComerciales." };
  const serverVerifiedCandidate = match.identity?.status === "VERIFIED";
  if (LOW_CONFIDENCE.has(match.matchConfidence) && !serverVerifiedCandidate) {
    return { status: "UNVERIFIED", reason: `Se encontró un candidato (${match.matchConfidence}), pero no se pudo verificar una coincidencia histórica confiable.` };
  }
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    return { status: "MALFORMED", reason: "La respuesta del servidor no tiene un formato válido." };
  }
  if (!("match" in history) && !("statistics" in history) && !("history" in history) && !("realDiscount" in history)) {
    return { status: "MALFORMED", reason: "La respuesta del servidor no tiene un formato válido." };
  }
  if (LOW_CONFIDENCE.has(history.match?.confidence)) {
    return { status: "UNVERIFIED", reason: history.match.reason || "No se pudo verificar una coincidencia histórica confiable." };
  }
  const stats = history.statistics || {};
  const trustedObservations = Number(stats.trustedRecords ?? stats.observations ?? history.history?.length ?? 0);
  const marketAvailable = history.realDiscount?.market?.status === "AVAILABLE";
  if (trustedObservations < 3 && !marketAvailable) {
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
