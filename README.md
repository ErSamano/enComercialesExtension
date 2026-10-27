# enComerciales Price Intelligence

A browser extension that compares wine and spirits prices on supported Mexican retailer websites with historical price data from enComerciales. Open a product page, click the extension, and review the detected price and available historical comparisons.

The project uses Manifest V3 and connects to the hosted service at `https://encomerciales.com/api`. The repository does not include a local API server or require users to configure a database. Historical results depend on the service being available and having usable records for the product.

## Install in Chrome, Edge, Brave, or Opera

The current package can be loaded as an unpacked extension in these Chromium based desktop browsers.

### 1. Download the extension

1. Open the [GitHub repository](https://github.com/ErSamano/enComercialesExtension).
2. Choose **Code → Download ZIP**, or [download the main branch ZIP](https://github.com/ErSamano/enComercialesExtension/archive/refs/heads/main.zip).
3. Extract the ZIP into a folder that you will keep on your computer.
4. Open the extracted folder and locate **`browser-extension`**, which contains `manifest.json`.

The browser loads the extension directly from this folder, so do not delete or move it after installation.

### 2. Open the extensions page

| Browser | Address |
| --- | --- |
| Google Chrome | `chrome://extensions` |
| Microsoft Edge | `edge://extensions` |
| Brave | `brave://extensions` |
| Opera | `opera://extensions` |

In each browser, enable **Developer mode**, choose **Load unpacked** (Opera may label this **Load Extension**), and select the `browser-extension` folder. Do not select the ZIP or the repository's top level folder. Confirm that **enComerciales Price Intelligence** is enabled, then pin its icon to your toolbar if you like.

These steps use each browser's local extension development feature. See the official [Chrome unpacked extension guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [Microsoft Edge sideloading guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading), [Brave extension help](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave), and [Opera testing guide](https://help.opera.com/en/extensions/testing/).

This repository does not currently provide a Chrome Web Store, Edge Add-ons, Brave, or Opera store listing. Unpacked installations are manual and do not update automatically.

### 3. Check the connection and use the extension

1. Open the extension's **Options** page and check that the API URL is `https://encomerciales.com/api`.
2. Use the connection test on that page. A successful health check confirms the API responds; it does not guarantee that every product has price history.
3. Open an individual product page at one of the supported stores below. Refresh the page if it was already open before installation.
4. Click the enComerciales toolbar icon to view the result.

## Firefox compatibility

Firefox is not currently supported by the package in this repository. Although Firefox supports Manifest V3, this extension's manifest uses a Chromium service worker background, which needs a Firefox compatible background configuration before the add-on can be loaded reliably. There is no Firefox installation path or Firefox Add-ons listing yet. Firefox support requires a separate compatibility change and testing; downloading the current ZIP is not enough.

## Supported retailers

| Store | Domain |
| --- | --- |
| Vinoteca | `vinoteca.com` |
| Bodegas Alianza | `bodegasalianza.com` |
| La Europea | `laeuropea.com.mx` |
| El Palacio de Hierro | `elpalaciodehierro.com` |
| La Castellana | `lacastellana.com` |
| Liverpool | `liverpool.com.mx` |

Product detection runs on these domains and their subdomains. Changes to a store's product pages, or pages that do not contain recognizable product information, can affect detection.

## What the extension shows

Depending on the product and available data, the extension can show the product name, store, current price, advertised reference price or discount, historical low and average, price chart, last update, and store with the lowest recorded price. It also displays when product matching is uncertain, when there is not enough history, and when the API cannot be reached.

Advertised discounts and historical price comparisons measure different things. A historical low is not a guarantee that the same offer is available today. See the [price rating methodology](docs/PRICE_RATING_METHODOLOGY.md) for details.

## Update or remove

To update, download and extract the latest ZIP, replace the files in your existing project folder, reload the extension on the browser's extensions page, and refresh any open product pages. If the browser does not pick up replaced files, remove the old unpacked extension and load the updated `browser-extension` folder again.

To remove the extension, choose **Remove** on its card on the browser's extensions page. You can then delete the downloaded project folder.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| The manifest cannot be found | Extract the ZIP and select the inner `browser-extension` folder containing `manifest.json`. |
| No product is detected | Open an individual product page at a supported store, wait for it to finish loading, refresh it, and open the extension again. |
| The connection check fails | Check your internet connection and confirm the API URL is `https://encomerciales.com/api`. Availability of the hosted service is separate from installing the extension. |
| No price history is shown | The hosted service may not have a matching product or enough recorded prices. Missing history is not evidence of a good deal. |
| The updated extension still looks unchanged | Reload the extension and refresh the product page. |
| Developer mode is unavailable | Your browser or device may be managed by an organization that restricts unpacked extensions. |

To report a reproducible problem, [open an issue](https://github.com/ErSamano/enComercialesExtension/issues) and include your browser version, extension version, supported store, and expected versus actual behavior. Remove personal information from screenshots or diagnostics.

## Permissions and data

The extension uses browser storage for preferences and session state, connects to the enComerciales API, and reads product information on the six supported retailer domains. Extracted product details are sent to the configured API to request comparisons. Price observation uploads are disabled in this release. This repository does not contain the production database, historical price dataset, or database credentials. See the [security notes](docs/browser-extension/SECURITY.md).

## Repository contents

- `browser-extension/` — installable browser extension.
- `api/php/` — API integration for the existing enComerciales website service.
- `docs/` — product behavior, price methodology, and service integration documentation.
- `tests/` — automated checks and sample product pages.

The hosted website service and its historical data are operated separately from this public repository. For changes or feature requests, [open a GitHub issue](https://github.com/ErSamano/enComercialesExtension/issues).
