# Response and layout fix — 0.1.1

The popup previously waited for search, history, and comparison to finish before rendering any historical data. A slow optional comparison therefore concealed history already returned by the API. It also checked a global `lastProduct` after requests; detection in another tab could invalidate the active popup. Session writes were awaited before rendering, and continuous DOM changes could indefinitely reset the extraction debounce.

The popup now displays verified history as soon as the history call completes. The optional store comparison updates it later. Detected products are stored by tab, the popup asks the active page for its current product, and obsolete requests are aborted. Timestamp-only detection events do not restart analysis. Navigation and tab closure clear the corresponding session entries.

Verified results are cached per tab for 60 seconds, keyed by product identity, page URL, prices, advertised discount, and API base URL. Partial history can also be restored while comparison is pending. The **Actualizar** button bypasses the cache. Cache and diagnostic writes no longer gate display. Detection runs at most once per 500 ms during continuous changes, including text and price attribute changes.

The default view shows product, retailer, current price, price assessment, historical low/average, and chart. Store comparison, historical maximum, observation count, and the store/date of the minimum are under **Ver detalles**. Unavailable discount cards and duplicate verification/confidence labels were removed. The `hidden` attribute explicitly overrides layout display rules. Errors retain the extracted product and offer **Reintentar**. API identity checks remain in place.

## Validation

- `node --test tests/extension/*.test.mjs`: all five test files pass.
- Regression scenarios include delayed comparison with early history rendering; stale completion; tab isolation; repeated detection; cached reopening; storage write failure; retry availability; navigation cleanup; continuous mutations; and network cancellation.
- Existing identity, currency, response validation, extraction, and settings tests pass.
- JavaScript syntax and manifest parsing checked.
- Live API probe timed out after 12 seconds without a response from this environment; no live latency claim is made.
- Browser visual validation could not run: installed Chromium lacks `libnspr4.so`, NSS, and ALSA runtime libraries.

## Apply locally

Reload the unpacked extension at `chrome://extensions` or `edge://extensions`, then refresh the store pages so they receive the updated content script. Open a product and check both the default view and **Ver detalles**. Reopen within a minute to exercise the cache; use **Actualizar** to force a fresh request. No server deployment is required for these extension changes.
