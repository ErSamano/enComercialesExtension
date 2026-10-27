# Security

The extension has no database credentials or private API secrets. It sends extracted page data to a configured API and treats all page values as untrusted. The development API validates JSON, required fields, HTTP(S) URLs, and labels writes as `BROWSER_EXTENSION`. Production must use HTTPS, strict origin and retailer allowlists, authentication/rate limits for observation writes, prepared SQL, bounded query parameters, and structured error responses that do not expose SQL, paths, or secrets. Browser observations must remain separate from canonical scraper history until reviewed.
