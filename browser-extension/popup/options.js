const DEFAULT_API_URL = "https://encomerciales.com/api";

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isValidApiBaseUrl(value) {
  try {
    const url = new URL(value);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    const production = url.protocol === "https:" && ["encomerciales.com", "www.encomerciales.com"].includes(url.hostname);
    return local || production;
  } catch {
    return false;
  }
}

function buildHealthUrl(apiBaseUrl) {
  const url = new URL(normalizeApiBaseUrl(apiBaseUrl));
  url.search = "";
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/health`;
  return url.toString();
}

function setDiagnostic(element, value) {
  element.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function describeError(error) {
  if (error instanceof TypeError) return "No se pudo conectar. Revisa la URL y tu conexión a internet.";
  return error?.message || "Error desconocido al consultar el API.";
}

async function loadOptions() {
  const api = document.getElementById("api");
  const debug = document.getElementById("debug");
  const save = document.getElementById("save");
  const test = document.getElementById("test");
  const status = document.getElementById("status");
  const diagnostic = document.getElementById("diagnostic");

  if (!api || !debug || !save || !test || !status || !diagnostic) return;

  const values = await chrome.storage.local.get({ apiBaseUrl: DEFAULT_API_URL, debug: false });
  api.value = values.apiBaseUrl || DEFAULT_API_URL;
  debug.checked = Boolean(values.debug);

  const last = await chrome.storage.session.get(["lastProduct", "analysisResult"]);
  const product = last.lastProduct;
  const key = JSON.stringify([product?.tabId, product?.detectedAt, product?.url, product?.name, product?.retailer, product?.price, product?.referencePrice, product?.sku, product?.gtin]);
  const stableKey = JSON.stringify([product?.tabId, product?.url, product?.name, product?.retailer, product?.price, product?.referencePrice, product?.sku, product?.gtin, product?.advertisedDiscountPercent]);
  if (product) setDiagnostic(diagnostic, { ...product, ...(last.analysisResult?.analysisKey === stableKey || last.analysisResult?.productKey === key ? last.analysisResult : {}) });

  save.addEventListener("click", async () => {
    const apiBaseUrl = normalizeApiBaseUrl(api.value);
    if (!isValidApiBaseUrl(apiBaseUrl)) {
      status.textContent = "URL no válida: usa localhost en desarrollo o el dominio HTTPS de enComerciales.";
      return;
    }

    try {
      await chrome.storage.local.set({ apiBaseUrl, debug: debug.checked });
      api.value = apiBaseUrl;
      status.textContent = "Configuración guardada.";
    } catch (error) {
      status.textContent = `No se pudo guardar la configuración: ${describeError(error)}`;
    }
  });

  test.addEventListener("click", async () => {
    const apiBaseUrl = normalizeApiBaseUrl(api.value);
    if (!isValidApiBaseUrl(apiBaseUrl)) {
      status.textContent = "URL no válida: usa localhost en desarrollo o el dominio HTTPS de enComerciales.";
      setDiagnostic(diagnostic, { ok: false, error: "INVALID_API_URL" });
      return;
    }

    test.disabled = true;
    status.textContent = "Probando conexión…";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(buildHealthUrl(apiBaseUrl), { signal: controller.signal, headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok) throw new Error(`API_${response.status}`);
      setDiagnostic(diagnostic, result);
      status.textContent = `✓ Conectado · API ${result.apiVersion || "disponible"}`;
    } catch (error) {
      setDiagnostic(diagnostic, { ok: false, error: describeError(error) });
      status.textContent = `✗ No se pudo conectar con el API: ${describeError(error)}`;
    } finally {
      clearTimeout(timer);
      test.disabled = false;
    }
  });
}

loadOptions().catch((error) => {
  const status = document.getElementById("status");
  if (status) status.textContent = `No se pudo cargar la configuración: ${describeError(error)}`;
});
