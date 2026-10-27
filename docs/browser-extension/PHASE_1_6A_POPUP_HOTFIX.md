# Popup hotfix — preserve extracted product information

This hotfix changes only the browser extension. No PHP API, MariaDB table, or
production deployment was changed.

## Root cause

`browser-extension/popup/popup.js` rendered product name, retailer, and current
price inside the same success path as historical comparison. It then returned
early for `LOW` or `UNKNOWN` search candidates by calling `showError()`, which
hid `#content` and replaced the entire popup with the historical warning.

The extraction succeeded, but the UI treated an unverified historical match as
a fatal extraction error.

## Rendering states

The popup now renders extracted offer data immediately:

- product name;
- retailer;
- current price and currency;
- reference price when supplied by the retailer adapter;
- advertised discount when supplied by the retailer adapter.

Historical comparison is rendered independently. LOW/UNKNOWN candidates,
missing candidates, insufficient history, API errors, and malformed responses
show `Comparación histórica no disponible` with a reason while leaving the
extracted offer visible.

Trusted history additionally enables rating, historical statistics, chart, and
historical Real Discount metrics. The extension never calculates market or
retailer Real Discount from an unverified candidate. Advertised discount remains
visible because it comes from extraction and is separate from historical Real
Discount.

## API diagnostics

`apiStatus: NOT_TESTED` is written by the service worker when a product is
first detected. It is not a health-check result and does not mean the API is
unavailable.

The popup now records:

- `SEARCH_SUCCESS`
- `SEARCH_FAILED`
- `CANDIDATE_UNVERIFIED`
- `HISTORY_NOT_FOUND`
- `HISTORY_INSUFFICIENT`
- `COMPARE_SUCCESS`
- `COMPARE_FAILED`
- `COMPARE_MALFORMED`

The existing session diagnostic remains safe and contains only client-side
request state and generic error messages.

## Files modified

- `browser-extension/popup/popup.js`
- `browser-extension/popup/popup.html`
- `browser-extension/popup/popup.css`
- `browser-extension/utils/popup-state.js`
- `tests/extension/utils.test.mjs`
- `tests/extension/options.test.mjs`

No PHP API files were modified.

## Tests performed

```text
node tests/extension/utils.test.mjs
node tests/extension/options.test.mjs
node --check browser-extension/popup/popup.js
node --check browser-extension/utils/popup-state.js
node --check browser-extension/utils/api.js
```

The tests cover extraction display data, LOW confidence, no candidate,
insufficient history, malformed responses, connection errors, advertised
discounts, missing reference/discount data, existing utility behavior, and
Manifest V3 inline-script/CSP checks.

## Manual installation

From WSL, copy the modified extension files to the Windows unpacked-extension
directory. Replace the paths with the actual Windows destination:

```bash
cp /home/neto/codex/webBrowserExtention/browser-extension/popup/popup.js \
  /mnt/c/Users/<WINDOWS_USER>/path/to/extension/browser-extension/popup/popup.js
cp /home/neto/codex/webBrowserExtention/browser-extension/popup/popup.html \
  /mnt/c/Users/<WINDOWS_USER>/path/to/extension/browser-extension/popup/popup.html
cp /home/neto/codex/webBrowserExtention/browser-extension/popup/popup.css \
  /mnt/c/Users/<WINDOWS_USER>/path/to/extension/browser-extension/popup/popup.css
cp /home/neto/codex/webBrowserExtention/browser-extension/utils/popup-state.js \
  /mnt/c/Users/<WINDOWS_USER>/path/to/extension/browser-extension/utils/popup-state.js
```

Do not copy tests or documentation into the packaged extension unless they are
kept outside the loaded extension directory.

In Brave:

1. Open `brave://extensions`.
2. Enable Developer mode.
3. Find the unpacked enComerciales extension.
4. Click **Reload**.
5. Reopen the retailer tab, allow extraction to run again, and open the popup.

For the Sauza reproduction, confirm the product and advertised price appear
even when the history section says comparison is unavailable. Inspect the
options-page diagnostic after opening the popup to confirm whether the state is
`CANDIDATE_UNVERIFIED`, `HISTORY_INSUFFICIENT`, or a request failure.

## Limitations

The popup still relies on the API’s server-side identity safeguards. This
hotfix does not promote candidates, alter matching, create history, or change
the API contract. A live browser test against the deployed API remains manual.
