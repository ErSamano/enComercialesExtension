# enComerciales Browser Extension — Codex Handoff

**Status:** Phase 1 and most Phase 1.1 implementation work is complete. The remaining blocker is live validation against the hosted/local MariaDB and a real Chrome/Edge session.

This document is the authoritative starting point for a new Codex conversation. It intentionally contains no passwords, tokens, private keys, or production credentials.

## Project Objective

The enComerciales Browser Extension gives a shopper price intelligence while viewing wine and liquor product pages. It should detect the product and current price on a supported retailer page, send the extracted information to an enComerciales API, match it against trusted historical scraper data, calculate historical statistics and a transparent price rating, and display the result in a lightweight Chrome/Edge popup.

The extension must never connect directly to MariaDB. The browser communicates only with an API; database credentials and SQL remain server-side.

## Architecture

### Production architecture

```text
Windows Chrome/Edge
        ↓
Manifest V3 browser extension
        ↓ HTTPS API request
enComerciales.com web/API layer
        ↓ existing PHP connection layer
MariaDB: ec_raw_reportdata historical pricing table
```

The production API is designed to reuse the existing PHP application's connection mechanism rather than introduce a second database configuration or a new historical schema.

### Local development architecture

```text
WSL Ubuntu / local project
  ├─ browser-extension/       MV3 source
  ├─ api/server.py             CSV-backed development API
  ├─ api/php/                  production PHP API source
  ├─ tests/                    offline tests and fixtures
  └─ docs/browser-extension/   documentation

Chrome/Edge on Windows
        ↓ Load unpacked
browser-extension/
        ↓ configured localhost URL
api/server.py                  development mode
```

WSL Ubuntu is the Codex development environment and contains the editable project at `/home/neto/codex/webBrowserExtention`. It is useful for source changes, Python/Node/PHP syntax checks, unit tests, and CSV-backed API checks. It does not currently have a reachable MariaDB service, hosted PHP server, or Chrome/Edge runtime. The user performs the final live test on the Windows/server environment.

The audited source of the existing scraper project is `/home/neto/codex/enComerciales/eC_scraperFull`. The separately located local copy of the hosted PHP site is under the Windows-mounted project path ending in `public_html`. Codex has not modified that external production/local hosted copy.

## Current Status

### Phase 1

#### IMPLEMENTED

- Manifest V3 extension for Chrome and Edge.
- Modular extraction architecture.
- Six retailer adapters: Vinoteca, Alianza/Bodegas Alianza, La Europea, Palacio de Hierro, La Castellana, and Liverpool.
- Generic JSON-LD, OpenGraph, and DOM extraction logic.
- Product normalization and confidence levels: `EXACT`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`.
- Transparent price categories: `GREAT DEAL`, `GOOD DEAL`, `NORMAL PRICE`, `EXPENSIVE`, `INSUFFICIENT DATA`.
- Popup UI, options page, diagnostic storage, and price-history chart.
- CSV-backed development API.
- Browser observation path separated from trusted history.
- User, developer, adapter, security, troubleshooting, installation, architecture, and deployment documentation.

#### TESTED / OFFLINE VERIFIED

- Extension utility tests for currency parsing, normalization, matching, and rating.
- CSV repository/API contract tests.
- Manifest JSON validation.
- JavaScript syntax checks.
- Python syntax checks.
- PHP syntax checks.
- Existing scraper test suite: 15 tests passing.

#### NOT LIVE TESTED

- Loading the unpacked extension in Chrome or Edge.
- A live retailer page in a real browser.
- A live HTTP/PHP server from this environment.
- Live MariaDB connectivity.
- A complete retailer → browser → PHP API → MariaDB → popup demonstration.

### Phase 1.1

#### IMPLEMENTED

- Audit documentation in `docs/browser-extension/PHASE_1_1_AUDIT.md`.
- PHP `DatabaseRepository` targeting the existing `ec_raw_reportdata` table.
- Prepared statements for database values and generic API error responses.
- SQL-side low, high, average, 30-day, 90-day, one-year, latest-date, latest-by-store, and low-price-store calculations.
- Opaque URL-safe product IDs rather than exposing internal database IDs.
- Vintage, bottle-size, and pack-size mismatch protection.
- Standard API intelligence response structure.
- `/health`, search, history, compare, and gated observation endpoints.
- Explicit `CSVRepository` façade for local development.
- Manifest permission reduction: only `storage` is requested; `<all_urls>` and `activeTab` were removed.
- Bounded/debounced MutationObserver handling for dynamic retailer pages.
- Popup history chart wiring.
- Observation submission flow through the service worker.
- Observation writes disabled by default in production using `EC_ENABLE_BROWSER_OBSERVATIONS`.
- Connectivity test in the options page.
- Manual integration and production deployment procedures.

#### TESTED / OFFLINE VERIFIED

- PHP repository matching/rating tests, including year, bottle-size, and pack-size mismatches.
- CSV API contract test with real local CSV snapshots.
- API URL/origin/retailer validation tests.
- PHP `php -l` checks.
- JavaScript `node --check` checks.
- Existing 15-test scraper suite.
- Standard response smoke test against CSV data.

#### NOT LIVE TESTED

- The PHP repository against the real MariaDB server.
- Health response with a live database connection.
- CORS from a real extension origin.
- Real Chrome/Edge content-script execution.
- Real retailer HTML and current selectors after deployment.
- SFTP upload, web-server routing, HTTPS, or production rollback.

#### NOT IMPLEMENTED

- Alerts, watchlists, accounts, notifications, AI matching, recommendations, mobile app, Firefox/Safari implementations, and store publishing.
- A production authentication workflow for browser observation writes.
- A database migration for browser observations. This is intentional; observations are kept outside canonical history.

## Browser Extension

### Location and lifecycle

The extension source is in `browser-extension/`.

- `manifest.json`: MV3 manifest, permissions, content-script matches, service worker, popup, and options page.
- `content/inject.js`: import-free content-script runtime bundle. MV3 content scripts are classic scripts, so this file must not use ES module imports.
- `content/detector.js`: testable retailer-domain detection helpers.
- `content/extractor.js`: testable generic JSON-LD/OpenGraph/DOM extraction helpers.
- `stores/adapters.js`: modular selectors for the six trusted retailers.
- `background/background.js`: MV3 service worker; stores detections and forwards observations.
- `popup/`: user-facing popup and options page.
- `components/price-history.js`: small canvas history chart.
- `utils/`: API, currency, normalization, and rating utilities.

### Manifest and permissions

The manifest requests only `storage`. It needs this for API configuration, debug data, and the current detected-product snapshot. No `tabs`, `activeTab`, or broad `<all_urls>` permission is used.

Host permissions cover localhost development, the two enComerciales production hostnames, and the six retailer content-script domains. If production uses another API hostname, the manifest and options validation must be updated deliberately and reviewed before packaging.

### Detection and adapters

Trusted adapters are independent and selected by retailer domain. Adapter extraction has the form `adapter:Vinoteca`, etc. The generic path looks for JSON-LD Product/Offer data first, then OpenGraph/meta data, then common product DOM elements. The content runtime is self-contained because content-script imports are not supported by the current manifest arrangement.

The runtime uses a debounced `MutationObserver` to re-check dynamic product pages without continuously scanning the DOM. It sends only when the product signature changes.

### Normalization and matching

Normalization lowercases, removes accents, standardizes whitespace/punctuation, and preserves meaningful product attributes. Matching proceeds through exact normalized name and then token overlap. The existing database has no explicit SKU/UPC/product-master table, so SKU/GTIN values are used when available in browser data but cannot currently be authoritative database keys.

Vintage/year differences, bottle sizes, and pack quantities are treated as material. Examples that must not become confirmed matches:

- `Wine XYZ 2019` vs `Wine XYZ 2021`.
- `750 ml` vs `1.5 L`.
- `6 x 750 ml` vs `1 x 750 ml`.

Low and unknown matches are not shown as confirmed history in the popup. The API returns confidence and a reason/method.

### Price rating and history

The rating is deterministic and documented in `docs/PRICE_RATING_METHODOLOGY.md`. At least three trusted observations are required. The popup shows current price, historical low/average/high, best store, confidence, update date, rating reason, and a simple history chart. Missing statistics remain null or display as unavailable.

### Configuration and diagnostics

The options page stores the API base URL and debug preference. It accepts localhost HTTP URLs for development and HTTPS URLs only for the declared enComerciales production hosts. The **Probar conexión** button calls `/health` and displays only safe status/version information.

The latest session diagnostic records retailer, raw and normalized product names, adapter/extraction method, URL, price, API status, database match, and confidence. It does not intentionally record secrets.

## API

### Development API

`api/server.py` is a standard-library Python server over the existing CSV snapshots. It provides `CSVRepository`, validates CORS and observation URLs, returns the shared intelligence contract, and exposes `/health` with `database: csv`.

Typical development command:

```bash
python3 api/server.py
```

The sandbox may prohibit socket binding; this command must be run on a normal local machine for browser testing.

### Production PHP API

`api/php/index.php` is the production entry point and `api/php/repository.php` contains `DatabaseRepository`. It reuses the existing site's connection mechanism by requiring the deployed `scripts/connect.php` through the `EC_PUBLIC_HTML` environment variable. It does not contain database credentials.

`api/php/router.php` is only a convenience router for PHP's built-in development server. Production should configure the existing web server to route the API paths to `index.php`.

### API contract

Expected endpoints:

- `GET /health`: safe status, API version, and database availability.
- `GET /api/products/search?name=&sku=&gtin=&limit=`: candidate products and match confidence.
- `GET /api/products/history?id=&confidence=`: product, match, current, statistics, rating, history, and latest-by-store data.
- `GET /api/products/compare?name=&sku=&gtin=&limit=`: candidate/comparison data; production can expand this without changing the extension boundary.
- `POST /api/prices/observe`: explicitly disabled unless `EC_ENABLE_BROWSER_OBSERVATIONS=1`; writes are stored separately and labeled `BROWSER_EXTENSION`.

The PHP API returns generic `SERVICE_UNAVAILABLE` errors to clients and logs diagnostic details server-side. It must never return credentials, SQL statements, filesystem paths, or raw database errors.

### Production configuration

The deployed API expects:

- `EC_PUBLIC_HTML`: absolute path to the existing hosted `public_html` directory.
- Existing site database configuration via `EC_DB_HOST`, `EC_DB_NAME`, `EC_DB_USER`, and `EC_DB_PASSWORD` or the existing local configuration mechanism.
- `EC_EXTENSION_ORIGINS`: exact allowed extension origins, never `*` in production.
- `EC_ENABLE_BROWSER_OBSERVATIONS=1` only after a separate authenticated review process.
- `EC_BROWSER_OBSERVATIONS_PATH` only when observation storage is intentionally enabled, outside the public document root.

## Database

The actual production structure identified during audit is:

- Table: `ec_raw_reportdata`.
- Columns used by existing application code: `ptype`, `pname`, `plink`, `sale`, `price`, `date`, `store`.
- Existing PHP connection: `scripts/connect.php`, which calls `ec_db_connect()`.
- Existing configuration: `config/ec_config.php`, using environment variables with a local configuration fallback.

Existing import code indicates that `price` is the current/discounted numeric price imported from `Precios`, while `sale` is the regular/previous price imported from `Anterior`. Product rows do not expose a dedicated product-master, SKU, UPC, source, or observation column in the audited schema.

No database migration has been created. Browser observations must not be inserted into `ec_raw_reportdata` automatically. The production repository uses bound parameters and SQL aggregation. Indexes may be considered after a production query-plan review, but none should be added automatically by Codex.

## Tests

Latest known results:

- Existing scraper project: **15 tests passing**.
- `tests/extension/utils.test.mjs`: passing; currency, normalization, confidence, and rating cases.
- `tests/api_test.py`: passing; CSV repository contract, CORS/origin, and retailer URL validation.
- `tests/php_repository_test.php`: passing; PHP matching and rating rules.
- `node --check`: passing for extension JavaScript files checked.
- `php -l`: passing for `api/php/index.php`, `api/php/repository.php`, and `api/php/router.php`.
- `python3 -m py_compile api/server.py`: passing.
- Manifest JSON and least-privilege assertions: passing.

These are offline or local-data checks. They do not prove a real MariaDB connection, web-server route, Chrome/Edge load, retailer page extraction, or end-to-end popup rendering.

## Important Design Decisions

### No direct MariaDB connection from the extension

Browser-distributed JavaScript cannot safely contain database credentials. The API is the trust boundary for validation, matching, aggregation, CORS, error handling, and future authentication.

### HTTPS in production

Product names, URLs, and pricing data must not be sent over an untrusted remote HTTP connection. HTTP is accepted only for localhost development.

### Reuse existing PHP/MariaDB infrastructure

The existing enComerciales application already owns database configuration and historical import behavior. Reusing it avoids duplicate schemas, divergent data interpretation, and scraper breakage.

### Keep CSV/Python useful

CSV snapshots are available locally and make deterministic tests possible without a live database. The Python API lets the browser UI be developed before hosted infrastructure is available. It is not the production source of truth.

### Separate browser observations

Browser-observed prices are untrusted page input. They are labeled `BROWSER_EXTENSION` and kept outside canonical scraper history so a retailer markup error or malicious page cannot silently alter trusted analytics.

### Production observation writes disabled

Observation ingestion requires an explicit environment flag. Read-only production integration should be validated first, and an authenticated review/approval workflow should exist before enabling writes.

### Confidence levels instead of silent fuzzy matches

Retailer names vary, but vintage, size, and pack quantity can change the product identity. The UI must communicate uncertainty and refuse to present `LOW`/`UNKNOWN` candidates as confirmed history.

## Current Deployment Model

Codex does **not** modify the production server directly.

The safe workflow is:

```text
Local project
  → Codex modifies local files
  → local validation
  → user reviews changes
  → user manually uploads selected files using SFTP
  → production validation
```

The local Windows-mounted hosted-project copy is an audit/reference source. It must not be treated as authorization to upload or edit production files.

## Current Task / Next Phase

The immediate next task is:

> Integrate the production read-only PHP API into the local copy of the hosted enComerciales website.

Initial endpoints:

- `GET /api/health`
- `GET /api/products/search`
- `GET /api/products/history`
- `GET /api/products/compare`

Browser observation writes must remain disabled until read-only production integration is validated.

The next Codex conversation should first inspect the target local PHP copy, decide the routing location, copy or link the API files locally, run PHP checks from that copy, and only then prepare an SFTP manifest for user review.

## SFTP Requirement

Before any upload, the next Codex session must provide an exact, user-reviewable deployment manifest in this format:

| Local file | Remote destination | Action | Purpose | Backup required? |
|---|---|---|---|---|
| `api/php/index.php` | `/public_html/<approved-api-route>/index.php` | NEW or REPLACE | Read-only API entry point | Yes if replacing existing file |
| `api/php/repository.php` | `/public_html/<approved-api-route>/repository.php` | NEW | MariaDB repository and aggregates | No existing file must be confirmed first |
| `api/php/router.php` | Not uploaded by default | DO NOT UPLOAD | Local PHP built-in-server helper only | No |

The exact remote destination must be confirmed from the local hosted-site copy and existing web-server routing before upload. Do not guess it.

The manifest must also list:

- Any `.htaccess` or web-server routing file proposed for change.
- Any configuration/environment change proposed.
- Files requiring a timestamped backup before replacement.
- Files explicitly not to upload, including `.env`, local configuration, credentials, test fixtures, `observations.jsonl`, Python development code, `.venv`, and generated caches.
- Database migrations. Current status: **none**.
- Rollback instructions: restore every backed-up replaced file, remove newly uploaded API files, revert routing changes, and confirm `/health` no longer routes to the new API.

No SFTP upload should occur automatically.

## Remaining Validation

The following must still be performed by the user or in an environment with the required services:

1. Confirm MariaDB is running and reachable by the existing PHP connection configuration.
2. Integrate the API into the local hosted PHP copy and run the health endpoint.
3. Verify read-only search/history/compare queries against real `ec_raw_reportdata` rows.
4. Verify generic errors do not expose SQL, credentials, or paths.
5. Verify CORS using the actual unpacked/published extension origin.
6. Load `browser-extension/` unpacked in Chrome and Edge.
7. Test the Vinoteca page first because its existing VTEX scraper and adapter selectors are the clearest initial path.
8. Confirm detection, current price, API connection, database candidate, confidence, statistics, rating, and chart.
9. Test a year mismatch, bottle-size mismatch, and insufficient-history case.
10. Confirm browser observations remain disabled unless deliberately enabled and reviewed.
11. Only after read-only validation, review packaging and any user-approved SFTP upload.

## Important Files

### Extension

- `browser-extension/manifest.json`: MV3 manifest and least-privilege permissions.
- `browser-extension/content/inject.js`: import-free runtime extraction and controlled dynamic-page observation.
- `browser-extension/content/extractor.js`: testable generic extraction implementation.
- `browser-extension/stores/adapters.js`: retailer adapter selectors.
- `browser-extension/background/background.js`: service worker and observation forwarding.
- `browser-extension/popup/popup.html`, `popup.js`, `popup.css`: user interface and API/history rendering.
- `browser-extension/popup/options.html`: endpoint configuration, health test, and diagnostics.
- `browser-extension/utils/api.js`: API client.
- `browser-extension/utils/product-normalizer.js`: normalization and confidence helpers.
- `browser-extension/utils/rating.js`: transparent client-side rating.
- `browser-extension/components/price-history.js`: chart rendering.

### API and tests

- `api/server.py`: CSV-backed local API and `CSVRepository`.
- `api/php/index.php`: production PHP API entry point.
- `api/php/repository.php`: MariaDB `DatabaseRepository`.
- `api/php/router.php`: local PHP built-in-server router; normally not deployed.
- `tests/extension/utils.test.mjs`: JavaScript utility tests.
- `tests/api_test.py`: CSV/API validation tests.
- `tests/php_repository_test.php`: PHP matching/rating tests.
- `tests/fixtures/product-page.html`: static product-page diagnostic fixture.

### Documentation

- `docs/BROWSER_EXTENSION_ARCHITECTURE.md`: Phase 1 architecture/audit.
- `docs/PRICE_RATING_METHODOLOGY.md`: rating rules.
- `docs/browser-extension/PHASE_1_1_AUDIT.md`: Phase 1.1 findings and permissions audit.
- `docs/browser-extension/MANUAL_INTEGRATION_TEST.md`: Windows/manual live-test procedure.
- `docs/browser-extension/PRODUCTION_DEPLOYMENT.md`: deployment/configuration guidance.
- `docs/browser-extension/SECURITY.md`: security policy.
- `docs/browser-extension/README.md`: concise extension overview.

## Known Risks / Issues

- Live MariaDB access is not available in the current WSL environment, so the PHP repository has not executed against real rows here.
- Chrome/Edge cannot be launched in the current environment, so unpacked-extension and visual popup validation are unverified.
- The existing database has no dedicated product identity/SKU/UPC master table. Matching relies primarily on names and explicit attribute mismatch rules.
- The production API route has not yet been integrated into the local hosted PHP copy. Its exact remote SFTP destination is therefore intentionally unspecified.
- Production API reads are designed as read-only, but deployment routing/CORS still require review in the hosted environment.
- The production observation path is feature-flagged but should remain disabled until an authenticated review workflow exists.
- Retailer selectors can change and require manual fixture/live-page revalidation.
- The current manifest intentionally supports only the six audited retailer domains; unsupported-retailer generic discovery is not enabled.

## Next Recommended Steps

1. Start or obtain a safe local/test MariaDB service with a read-only account, or use the hosted local-copy environment supplied by the user.
2. Confirm the existing PHP site's routing and choose a local API directory that does not overwrite unrelated application files.
3. Integrate `api/php/index.php` and `api/php/repository.php` into that local copy only.
4. Run `php -l`, the health endpoint, and read-only search/history/compare requests against real data.
5. Confirm the response fields and CORS behavior from a real extension origin.
6. Load the unpacked extension in Chrome and test Vinoteca first.
7. Resolve any selector, route, or match-confidence issues using the diagnostic output.
8. Run the full test suites again, including the untouched scraper suite.
9. Prepare the exact SFTP deployment manifest with backup and rollback steps.
10. Wait for explicit user review before any production upload.
11. Keep browser observation writes disabled until the read-only path is proven and separately approved.

