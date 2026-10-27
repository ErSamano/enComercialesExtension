import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const extensionRoot = path.join(root, "browser-extension");

const popupHtml = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(extensionRoot, "popup/popup.js"), "utf8");
assert.match(popupHtml, /id="product-name"/);
assert.match(popupHtml, /id="reference-price"/);
assert.match(popupHtml, /id="history-status"/);
assert.match(popupHtml, /id="market-discount"/);
assert.match(popupHtml, /id="retailer-discount"/);
assert.doesNotMatch(popupJs, /return showError\(/);
assert.match(popupJs, /renderExtractedProduct\(lastProduct\)/);
assert.match(popupJs, /CANDIDATE_UNVERIFIED/);

for (const file of fs.readdirSync(extensionRoot, { recursive: true })) {
  if (!file.endsWith(".html")) continue;
  const htmlPath = path.join(extensionRoot, file);
  const html = fs.readFileSync(htmlPath, "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i, `${file} has inline JavaScript`);
  assert.doesNotMatch(html, /\bon(?:click|change|submit|input|load)\s*=/i, `${file} has an inline event handler`);
  assert.doesNotMatch(html, /javascript\s*:/i, `${file} has a javascript: URL`);

  for (const [, source] of html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    assert.equal(fs.existsSync(path.resolve(path.dirname(htmlPath), source)), true, `${file} references missing ${source}`);
  }
}

const elements = new Map(["api", "debug", "save", "test", "status", "diagnostic"].map((id) => [id, {
  id,
  value: "",
  checked: false,
  textContent: id === "diagnostic" ? "Sin datos" : "",
  disabled: false,
  listeners: {},
  addEventListener(type, listener) { this.listeners[type] = listener; },
  async click() { return this.listeners.click?.(); }
}]));
const localStorage = { apiBaseUrl: "https://encomerciales.com/api", debug: false };
const sessionStorage = {};
const requests = [];
const context = {
  AbortController, setTimeout, clearTimeout,
  URL,
  TypeError,
  console,
  document: { getElementById: (id) => elements.get(id) },
  chrome: {
    storage: {
      local: {
        async get(defaults) { return { ...defaults, ...localStorage }; },
        async set(values) { Object.assign(localStorage, values); }
      },
      session: {
        async get() { return sessionStorage; }
      }
    }
  },
  fetch: async (url) => {
    requests.push(url);
    return { ok: true, async json() { return { status: "ok", apiVersion: "test" }; } };
  }
};
vm.runInNewContext(fs.readFileSync(path.join(extensionRoot, "popup/options.js"), "utf8"), context);
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(elements.get("api").value, "https://encomerciales.com/api");
elements.get("api").value = "https://encomerciales.com/api///";
elements.get("debug").checked = true;
await elements.get("save").click();
assert.deepEqual(localStorage, { apiBaseUrl: "https://encomerciales.com/api", debug: true });
assert.equal(elements.get("status").textContent, "Configuración guardada.");

await elements.get("test").click();
assert.deepEqual(requests, ["https://encomerciales.com/api/health"]);
assert.match(elements.get("status").textContent, /Conectado/);
assert.match(elements.get("diagnostic").textContent, /apiVersion/);
console.log("extension options CSP and behavior ok");
