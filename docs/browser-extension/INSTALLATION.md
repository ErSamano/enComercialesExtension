# Installation

The [root README](../../README.md#install-in-chrome-or-microsoft-edge) contains the full download, installation, configuration, update, and troubleshooting instructions.

## Quick start

1. Download and extract the repository ZIP, or clone the repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**, click **Load unpacked**, and select `browser-extension/`, the folder containing `manifest.json`.
4. Pin the extension. In **Configuración**, retain the default API URL, `https://encomerciales.com/api`, and click **Probar conexión**.
5. Open or refresh a supported retailer product page, then click the extension icon.

No local server is needed for the default setup. Keep the extracted folder in place. After updating its files, reload the extension and refresh retailer pages.

## Local development

To use the optional CSV adapter, run `python3 api/server.py` from the repository root and change the extension's API URL to `http://127.0.0.1:8080/api`. Click **Guardar**, then **Probar conexión**. External scraper snapshots are required for product results; see the [local API instructions](../../README.md#optional-local-api).

## Production API and store distribution

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for the existing PHP/MariaDB application integration. Browser store distribution is a separate release step; this repository documents manual installation.
