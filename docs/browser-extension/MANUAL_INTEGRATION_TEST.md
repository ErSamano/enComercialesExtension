# Manual integration test

Perform this on the Windows machine that hosts the enComerciales PHP site and has MariaDB access.

## Start the API

Set the existing site root and database environment without putting credentials in the extension:

```powershell
$env:EC_PUBLIC_HTML = 'C:\path\to\encomerciales\public_html'
$env:EC_EXTENSION_ORIGINS = 'chrome-extension://YOUR_EXTENSION_ID'
php -S 127.0.0.1:8080 api/php/router.php
```

Also set `EC_BROWSER_OBSERVATIONS_PATH` to a writable path outside the public document root and `EC_ENABLE_BROWSER_OBSERVATIONS=1` if testing observation submission. Production should route `/health` and `/api/*` to `api/php/index.php` through the existing web server.

## Verify API

Open `http://127.0.0.1:8080/health`. Expected safe response:

```json
{"status":"ok","apiVersion":"1.1","database":"available"}
```

The response does not reveal host, username, password, SQL, or filesystem paths. A `503` means the server cannot load the existing connection configuration or connect to MariaDB.

## Install and configure the extension

1. Open `chrome://extensions`.
2. Enable Developer mode and choose **Load unpacked**.
3. Select this repository's `browser-extension` directory.
4. Open **Configuration**, enter `http://127.0.0.1:8080/api`, save, and choose **Probar conexión**.
5. Use the extension ID shown on the extensions page in `EC_EXTENSION_ORIGINS` if the API rejects the origin.

## First retailer and product

Test Vinoteca first. Its existing scraper has explicit VTEX selectors and the extension adapter mirrors those selectors. Open a Vinoteca product URL such as one from the current scraper CSV, for example the Muga product URL in `eC_scraperFull/data/vinoteca_precios.csv`.

Click the extension icon. Confirm the current price, retailer `Vinoteca`, adapter extraction method, and product name. The search result's `matchConfidence` must be visible in the popup; `LOW` or `UNKNOWN` must not be treated as confirmed history.

## Verify database and history

The API search response identifies the matched `pname` through an opaque URL-safe ID. The history response should contain SQL-derived low, high, average, 30-day, 90-day, and one-year values when enough dated rows exist, plus store and date-of-low information. Compare the returned name with `ec_raw_reportdata.pname` using the existing admin/report tooling; do not edit production rows for this test.

## Debug failures

* Popup: API error, match confidence, and displayed metrics.
* Service worker: extension page → Service worker → Inspect.
* Page DevTools: Console for the content script and extracted product.
* API logs: PHP/web-server error log; only generic errors should reach the browser.
* Health endpoint: distinguishes connectivity/configuration from matching problems.
* Configuration page: enable debug and inspect the last extracted product without secrets.
