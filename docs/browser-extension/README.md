# enComerciales Browser Extension

The MV3 extension identifies a wine or spirit on supported retailer pages and asks enComerciales for historical price intelligence. It reports current price, low/average/high, best recorded store, rating, history availability, and match confidence.

Supported adapters: Vinoteca, Bodegas Alianza, La Europea, Palacio de Hierro, La Castellana, and Liverpool. Generic JSON-LD, OpenGraph, and DOM extraction also supports experiments on other stores.

Install unpacked using [INSTALLATION.md](INSTALLATION.md). Read [USER_MANUAL.md](USER_MANUAL.md) for use, [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for lifecycle and testing, and [SECURITY.md](SECURITY.md) before deployment.

Development uses the CSV scraper snapshots in `eC_scraperFull`; production integration targets the existing PHP/MariaDB application through `api/php/`. Live database/browser verification still requires the deployment environment.

Roadmap: alerts, watchlists, cross-retailer search, barcode matching, accounts, Firefox/Safari, and community observations.
