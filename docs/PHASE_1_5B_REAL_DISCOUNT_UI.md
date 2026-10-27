# Phase 1.5B — Real Discount UI and historical charts

## Scope

This change is limited to `browser-extension/`. It does not modify the PHP API repository, MariaDB, or deployment configuration.

## UI and API mapping

The popup now shows `Descuento real` with separate Mercado and Esta tienda metrics. Values are rendered directly from `realDiscount.marketRealDiscountPercent` and `realDiscount.retailerRealDiscountPercent`; the browser does not recompute historical discounts. Positive, negative, near-zero, unavailable, and currency-mismatch states have distinct text and visual treatment. `advertisedDiscountPercent` is shown separately as `Descuento anunciado`.

`utils/real-discount.js` is the isolated response mapper. It accepts the expected top-level fields and the nested `market.realDiscountPercent` / `retailer.realDiscountPercent` aliases for transition compatibility. The API remains authoritative for the values, reason codes, observation counts, and historical statistics.

The compare request now carries optional `referencePrice`, `referenceCurrency`, and `advertisedDiscountPercent` fields. The API adapter includes them only when extracted; no historical maximum is substituted.

## Reference-price extraction

The existing JSON-LD current price remains the primary current price. Generic DOM extraction and the Vinoteca/Alianza selectors now look conservatively for list/regular/old price elements. Unrelated prices are not searched globally. Reference values must be parsed as valid currency amounts before being sent.

## Chart fix

The old popup had a hard-coded orange diagonal CSS gradient and a canvas renderer without labels, sorting, validation, or reference lines. The new renderer uses an inline SVG, sorts observations by ISO date, removes invalid points, scales against the trusted observations plus current/average reference values, and renders price/date tooltips, axes, current-price and average lines, and a legend. Fewer than two valid observations produce an explicit empty state.

## Confidence and retailer semantics

`Detección del producto` shows the browser extraction method (`Adaptador: Vinoteca`, `JSON-LD`, or `DOM`), not an invented confidence score. `Coincidencia histórica` is the API/server product match confidence. They are not combined. The old ambiguous `Mejor tienda` label is now `Tienda del mínimo histórico`; it is not presented as a currently available retailer price.

## Backward compatibility

When `realDiscount` is absent, both discount cards show `Descuento real no disponible`. Existing API statistics, rating, history, and current-price rendering continue when supplied. If the comparison response itself has no usable legacy or new data, the popup shows a safe error instead of fabricating values. Missing retailer-level data remains unavailable and does not display zero.

## Tests

Run from the repository root:

```sh
node tests/extension/utils.test.mjs
node tests/extension/options.test.mjs
node --check browser-extension/popup/popup.js
node --check browser-extension/components/price-history.js
node --check browser-extension/content/inject.js
git diff --check
```

The utility tests cover positive, negative, neutral, unavailable, currency mismatch, advertised discount mapping, reference-price request mapping, historical ordering, invalid chart points, and formatting. Automated browser rendering still requires manual Brave/Chrome validation.

## Remaining limitations

Phase 1.5A's deployed response contract was not available in this repository during implementation. The extension therefore keeps response mapping isolated and supports the expected illustrative schema plus safe aliases; it does not claim live API support for fields that are not returned. Server-side reason/status strings are displayed when present, while the extension provides a safe fallback explanation otherwise. Reference-price selectors may need adjustment if retailer markup changes.
