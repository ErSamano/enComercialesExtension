# Store adapter guide

Adapters are deliberately small. Copy this template into `stores/adapters.js` and add the store domain in `content/detector.js`:

```js
ExampleStore: {
  name: "ExampleStore",
  detectProductPage: () => Boolean(document.querySelector("h1.product-title")),
  extractProductName: () => document.querySelector("h1.product-title")?.textContent.trim() || "",
  extractPrice: () => document.querySelector(".sale-price, .regular-price")?.textContent.trim() || "",
  extractionMethod: "adapter:ExampleStore"
}
```

Register the adapter, verify the canonical URL/domain, selectors, sale precedence, and a JSON-LD fallback with a saved fixture. Never rely on a live retailer in automated tests. Use the popup debug setting and the browser console to inspect extraction method, raw values, and API status.
