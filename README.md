# enComerciales Price Intelligence

A browser extension that compares wine and spirits prices on Mexican retailer websites with historical prices collected by enComerciales. Open a product page and click the extension to see the detected price, available price history, and comparisons with historical averages and lows.

The extension uses Manifest V3 and has a Spanish interface. This repository contains version **0.1.1**, its API adapters, tests, and development documentation.

## Install in Chrome or Microsoft Edge

**No programming tools, build step, or local server are required to install the extension.** It connects to `https://encomerciales.com/api` by default. Historical comparisons require that service to be reachable and to have a matching product with usable history.

### 1. Download the project

1. Open [this GitHub repository](https://github.com/ErSamano/enComercialesExtension).
2. Click **Code → Download ZIP**, or [download the main branch directly](https://github.com/ErSamano/enComercialesExtension/archive/refs/heads/main.zip).
3. Extract the ZIP into a permanent folder on your computer.
4. Inside the extracted project, locate **`browser-extension`**. This is the folder containing `manifest.json`.

Keep the extracted files in place after installation: the browser loads the extension from that folder.

### 2. Load the extension

| Browser | Open this address |
| --- | --- |
| Google Chrome | `chrome://extensions` |
| Microsoft Edge | `edge://extensions` |

1. Open the extensions address for your browser.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the **`browser-extension` folder**, not the ZIP or the repository's top-level folder.
5. Check that **enComerciales Price Intelligence** appears and is enabled.
6. Open the browser's Extensions menu and pin the extension or choose to show it in the toolbar.

These steps follow the official [Chrome installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) and [Microsoft Edge sideloading guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading). This repository provides manual installation; it does not provide a browser store installation link. Firefox and Safari are not currently supported by this package.

### 3. Verify the connection and try a product

1. Click the extension icon, then **Configuración**.
2. Leave **URL base de API** set to `https://encomerciales.com/api`.
3. Click **Guardar** if you changed the URL, then **Probar conexión**. A successful health check displays **Conectado**; it does not guarantee history for every product.
4. Open an individual wine or spirits product page at a supported retailer. Refresh pages that were already open before installation.
5. Click the extension icon to view the result.

## Supported retailers

| Retailer | Domain |
| --- | --- |
| Vinoteca | `vinoteca.com` |
| Bodegas Alianza | `bodegasalianza.com` |
| La Europea | `laeuropea.com.mx` |
| El Palacio de Hierro | `elpalaciodehierro.com` |
| La Castellana | `lacastellana.com` |
| Liverpool | `liverpool.com.mx` |

The extension runs automatically on these domains and their subdomains. Detection depends on the retailer's page structure; category pages, unsupported products, or website changes may prevent extraction.

## What you can see

- Product name, retailer, current price, and advertised reference price or discount when detected.
- Historical minimum and average, a price history chart, and the last update date when usable history exists.
- Additional details such as historical maximum, observation count, the store with the recorded minimum, and comparisons with this retailer.
- Clear states for missing or insufficient history, uncertain matches, and connection errors.

An advertised discount and a comparison with historical prices are different measures. Recorded historical lows are not guarantees of offers currently available. See the [price rating methodology](docs/PRICE_RATING_METHODOLOGY.md) for more detail.

## Update or uninstall

**Update:** Download and extract the latest version, replace the files in the same project folder, then click the extension's **Reload** button on `chrome://extensions` or `edge://extensions`. Refresh open retailer pages afterward. Manual installations do not automatically receive updates from GitHub.

If you installed with Git, run `git pull --ff-only` in your clone before reloading the extension. Keep any local changes on a separate branch.

**Uninstall:** Click **Remove** on the extension's card in your browser's extensions page. You can then delete the downloaded folder.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| “Manifest file is missing or unreadable” | Extract the ZIP and select the inner `browser-extension` folder containing `manifest.json`. |
| No product is detected | Use an individual product page on a supported retailer, wait for it to load, refresh it, and reopen the popup. |
| API connection fails | Check your internet connection and the API URL in **Configuración**, then use **Probar conexión**. Hosted API availability is independent of installation. |
| Product detected but no history appears | The database may lack a matching product or sufficient trusted observations. Try another product; do not interpret missing history as a good deal. |
| Extension still shows old behavior | Reload the extension and refresh the retailer page after updating files. |
| Developer mode or Load unpacked is unavailable | Your browser may be managed by an organization that restricts extension installation. |

For a reproducible bug, [open an issue](https://github.com/ErSamano/enComercialesExtension/issues) with your browser version, extension version, retailer/product URL, and expected versus actual behavior. Remove personal information from screenshots or diagnostics.

## Permissions and data

The manifest requests `storage` for preferences and session state, access to the enComerciales API hosts and localhost development servers, and content scripts on the six supported retailer domains. The extension extracts product information from those pages and sends product search/comparison parameters to the configured API. Options and diagnostic state are stored in the browser.

Price observation uploads are disabled in the shipped extension (`OBSERVATIONS_ENABLED = false`). The repository does not include the production database, scraper datasets, or database credentials. See [security notes](docs/browser-extension/SECURITY.md) before operating an API.

## Development

Clone the repository:

```sh
git clone https://github.com/ErSamano/enComercialesExtension.git
cd enComercialesExtension
```

Load `browser-extension/` using the installation steps above. The extension is plain JavaScript, HTML, and CSS; there is no dependency installation or bundling step.

### Project layout

```text
browser-extension/   Installable Manifest V3 extension
  background/        Service worker and product state
  content/           Product detection and extraction
  stores/            Retailer adapters
  popup/             Popup and configuration interface
  components/        Price history chart
  utils/             API, matching, pricing, and state helpers
api/server.py        Local development API backed by CSV files
api/php/             API adapter for the existing PHP/MariaDB application
tests/               JavaScript and API tests plus a product page fixture
docs/                Architecture, methodology, and integration notes
```

### Optional local API

Normal installation uses the hosted API. To work on the CSV development adapter, use Python 3 and start it from the repository root:

```sh
python3 api/server.py
```

In **Configuración**, set the API URL to `http://127.0.0.1:8080/api`, click **Guardar**, then **Probar conexión**. Keep the server running while testing. Restore `https://encomerciales.com/api` when finished.

The adapter expects external `*_precios.csv` scraper snapshots. Its default data directory is `../enComerciales/eC_scraperFull/data`, relative to the working directory. To use your own directory on Linux/macOS:

```sh
ENCOMERCIALES_DATA_DIR=/absolute/path/to/data python3 api/server.py
```

CSV fields read by the adapter are `Nombre`, `PrecioNumerico`, `Tienda`, `Fecha` (`YYYY-MM-DD`), `Links`, and `Moneda` (defaults to `MXN`). Without snapshots, health checks can succeed while searches return no products. This adapter is a development stub; its comparison endpoint returns search results and does not implement the full production comparison response.

The PHP API requires the separate enComerciales application and MariaDB configuration. Follow the [production deployment guide](docs/browser-extension/PRODUCTION_DEPLOYMENT.md); those services are not installed by loading this extension.

### Checks

Run the existing JavaScript tests with a Node.js version that supports `node --test`:

```sh
node --test tests/extension/*.test.mjs
```

Check the Python adapter syntax and PHP repository rules:

```sh
python3 -m py_compile api/server.py
php -d zend.assertions=1 -d assert.exception=1 tests/php_repository_test.php
```

The Python API tests require external CSV data containing a product matching `Muga Reserva 750 ml`:

```sh
ENCOMERCIALES_DATA_DIR=/absolute/path/to/data python3 -m unittest discover -s tests -p 'api_test.py'
```

Also perform a browser check after changing detection or popup behavior: reload the extension, refresh a supported product page, verify the extracted price, and test both available-history and no-history states. See the [manual integration checklist](docs/browser-extension/MANUAL_INTEGRATION_TEST.md).

## Contributing and further documentation

Open an issue to report bugs or propose improvements, or create a branch/fork and submit a pull request with the problem, change, and validation performed. Keep credentials, production data, and generated files out of commits.

- [Installation reference](docs/browser-extension/INSTALLATION.md)
- [Developer guide](docs/browser-extension/DEVELOPER_GUIDE.md)
- [Store adapter guide](docs/browser-extension/STORE_ADAPTER_GUIDE.md)
- [Architecture](docs/BROWSER_EXTENSION_ARCHITECTURE.md)
- [Production deployment](docs/browser-extension/PRODUCTION_DEPLOYMENT.md)

Some documents record earlier implementation phases; use this README and the current source for installation defaults. Potential future work includes alerts, watchlists, improved matching, and support for additional browsers.
