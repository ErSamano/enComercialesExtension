export function parseCurrency(value, defaultCurrency = "MXN") {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u00a0/g, " ").trim();
  if (!text) return null;
  const currency = /\b(USD|MXN|EUR|CAD)\b|US\s*\$/i.exec(text)?.[1]?.toUpperCase() || defaultCurrency;
  let number = text.replace(/[^0-9,.-]/g, "");
  if (number.includes(",") && number.includes(".")) number = number.replace(/,/g, "");
  else if (number.includes(",")) number = number.replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  const amount = Number.parseFloat(number);
  return Number.isFinite(amount) ? { amount, currency } : null;
}

export function formatCurrency(amount, currency = "MXN") {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return "Sin datos";
  if (!/^(MXN|USD|EUR|CAD)$/.test(String(currency).toUpperCase())) {
    return `${Number(amount).toLocaleString("es-MX")} (moneda desconocida)`;
  }
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(amount));
}
