const STOP_WORDS = new Set(["vino", "wine", "licor", "liqueur", "botella", "bottle", "con", "c"]);

export function normalizeProductName(value) {
  return String(value || "")
    // Search/history payloads have historically contained UTF-8-as-Latin-1 text.
    // Repair only display-name mojibake; opaque API identifiers are never touched.
    .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í").replace(/Ã³/g, "ó").replace(/Ãº/g, "ú").replace(/Ã±/g, "ñ").replace(/â€™/g, "'")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/(\d+)\s*(ml|cl|l|litro|litros)\b/g, "$1 $2")
    .replace(/\b(ml|cl|l|litro|litros)\b/g, " $1 ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function productTokens(value) {
  return normalizeProductName(value).split(" ").filter((token) => token && !STOP_WORDS.has(token));
}

export function productMatchConfidence(candidate, match) {
  if (!candidate || !match) return "UNKNOWN";
  if (candidate.gtin && match.gtin && candidate.gtin === match.gtin) return "EXACT";
  if (candidate.sku && match.sku && candidate.sku === match.sku) return "EXACT";
  const leftName = normalizeProductName(candidate.name);
  const rightName = normalizeProductName(match.name);
  const leftYears = leftName.match(/\b(?:19|20)\d{2}\b/g) || [];
  const rightYears = rightName.match(/\b(?:19|20)\d{2}\b/g) || [];
  if (leftYears.length && rightYears.length && leftYears[0] !== rightYears[0]) return "LOW";
  const size = (value) => (String(value).toLowerCase().match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/g) || []).map((item) => item.replace(/\s+/g, ""));
  const leftSizes = size(candidate.name); const rightSizes = size(match.name);
  if (leftSizes.length && rightSizes.length && leftSizes[0] !== rightSizes[0]) return "LOW";
  const pack = (value) => value.match(/\b(\d+)\s*x\s*\d+/g) || [];
  const leftPacks = pack(leftName); const rightPacks = pack(rightName);
  if (leftPacks.length && rightPacks.length && leftPacks[0] !== rightPacks[0]) return "LOW";
  const left = new Set(productTokens(candidate.name));
  const right = new Set(productTokens(match.name));
  if (!left.size || !right.size) return "UNKNOWN";
  const overlap = [...left].filter((token) => right.has(token)).length / Math.max(left.size, right.size);
  return overlap >= 0.9 ? "HIGH" : overlap >= 0.65 ? "MEDIUM" : overlap >= 0.35 ? "LOW" : "UNKNOWN";
}
