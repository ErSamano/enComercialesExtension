# Security

The extension contains no database credentials or private API secrets. It sends extracted product details to the configured HTTPS enComerciales API and treats page values as untrusted. The extension accepts API URLs only on `encomerciales.com` and `www.encomerciales.com` over HTTPS. The repository does not contain the hosted service's database, historical price data, or server credentials.

Observation uploads are disabled in the shipped extension. Any future observation feature should require authenticated review, strict origin and retailer allowlists, rate limits, prepared SQL, bounded query parameters, and structured errors that do not expose SQL, paths, or secrets. Browser observations should remain separate from trusted price history until reviewed.
