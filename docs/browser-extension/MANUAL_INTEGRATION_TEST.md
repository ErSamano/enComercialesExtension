# Manual browser integration check

This checklist verifies the extension against the hosted enComerciales API. It does not start a local API server.

1. Load the `browser-extension/` directory as an unpacked extension in Chrome, Edge, Brave, or Opera.
2. Confirm the extension's API URL is `https://encomerciales.com/api` and use its health check.
3. Open or refresh a supported retailer product page and open the extension popup.
4. Confirm the detected product name, retailer, and price match the page.
5. Check the product's returned match confidence and history state.
6. Repeat with a product that has no usable history, if one is available. Confirm the popup explains that history is unavailable or insufficient.
7. Check browser extension and service logs for errors; do not include private user data or credentials in reports.

A successful health check verifies API availability. It does not guarantee matching history for every product.
