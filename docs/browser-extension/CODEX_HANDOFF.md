# Project maintenance notes

This repository contains the enComerciales price comparison browser extension and the PHP integration used by the hosted website service. The standalone CSV based Python API has been removed; this project uses the hosted HTTPS API at `https://encomerciales.com/api`.

## Browser extension

The installable extension is in `browser-extension/`. It uses Manifest V3, extracts wine and spirits product details from supported retailer pages, and requests matches and historical prices from the hosted API. Its manifest grants access only to the hosted enComerciales domains and supported retailer pages. Options accept only the approved HTTPS service URL. Price observation uploads are disabled.

Install and use the extension by following the [root README](../../README.md). The current package supports unpacked installation in Chrome, Edge, Brave, and Opera. Firefox needs a compatible manifest and background implementation before it can be supported.

## Hosted service integration

`api/php/` contains the PHP API entry point and repository adapter for the existing enComerciales application. It uses the application's database configuration and parameterized MariaDB queries. Do not commit database configuration, credentials, production records, or exported datasets. Follow [production deployment](PRODUCTION_DEPLOYMENT.md) when working on the hosted integration.

The browser extension never connects directly to the database. Product and price information must be returned through the HTTPS API. Keep CORS restricted to published extension origins and preserve separate review for any future user submitted observations.

## Project layout

- `browser-extension/` — installable Manifest V3 browser extension.
- `api/php/` — hosted PHP API integration.
- `docs/` — architecture, price methodology, security, and deployment notes.
- `tests/extension/` — JavaScript tests for extraction, matching, popup, and API behavior.

To verify extension behavior, use `node --test tests/extension/*.test.mjs` and manually check a supported product page with the hosted service. Do not configure a localhost API URL: the extension is configured for the published HTTPS service.
