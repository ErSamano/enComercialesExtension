# Security assessment

## Current protections

- Manifest V3 requests only `storage`; host permissions are limited to the enComerciales API. Content scripts run only on HTTPS pages of the six supported retailers.
- The background worker accepts product data only from a tab whose HTTPS URL belongs to a supported retailer. It stores a bounded set of scalar fields and uses the tab URL as the product URL, rather than trusting a page-provided URL.
- API settings are checked again when read from storage. Requests require HTTPS, an exact approved API hostname, and no embedded credentials or custom port. Redirects are rejected.
- UI values are rendered as text, and no dynamic HTML insertion or remote code loading is used.
- Observation uploads are disabled. No database credentials or private API secrets are included in the extension.

## Data and limits

The extension sends extracted product details (name, SKU/GTIN, price, currency, and retailer for comparison requests) to the configured enComerciales API. Product pages are untrusted input; their details can be wrong or misleading. The extension does not authenticate the user to that API. The repository does not contain the hosted service's database, historical price data, or server credentials, so this review cannot assess server-side authorization, injection handling, rate limits, TLS configuration, or data retention.

Future observation uploads should require authenticated review, strict origin and retailer allowlists, rate limits, prepared SQL, bounded query parameters, and structured errors that do not expose SQL, paths, or secrets. Browser observations should remain separate from trusted price history until reviewed.
