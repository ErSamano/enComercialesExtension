# Troubleshooting

If detection fails, confirm the page is a product page, reload the extension, and inspect the content-script console. If price is wrong, inspect JSON-LD and the adapter selector; retailer markup may have changed. If history is absent, verify the API URL and search match confidence. If the chart is empty, fewer than two history points may exist. For CORS or manifest errors, inspect the Network and Extensions pages and confirm the API allowlist and host permissions. Do not treat a low or unknown-confidence match as a confirmed identity.
