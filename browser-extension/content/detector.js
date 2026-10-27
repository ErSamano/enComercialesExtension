export function retailerForHost(hostname = location.hostname) {
  const host = hostname.toLowerCase();
  const entries = [["vinoteca.com", "Vinoteca"], ["bodegasalianza.com", "Alianza"], ["laeuropea.com.mx", "La Europea"], ["elpalaciodehierro.com", "Palacio de Hierro"], ["lacastellana.com", "La Castellana"], ["liverpool.com.mx", "Liverpool"]];
  return entries.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || "Unknown retailer";
}

export function isLikelyProductPage() {
  return Boolean(document.querySelector('script[type="application/ld+json"]')?.textContent?.includes("Product") || document.querySelector("h1, [itemprop='name']"));
}
