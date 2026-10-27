# Test the Firefox build

This branch includes a Firefox-compatible Manifest V3 background configuration. It adds `background.scripts` for Firefox's event page and retains `background.service_worker` for Chromium. The same module is used in both environments. The minimum Firefox version is 121 because earlier Firefox versions did not reliably handle both background entries together.

## Temporary installation

1. Download this branch as a ZIP from its GitHub page and extract it.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Select **This Firefox**, then **Load Temporary Add-on**.
4. Choose `browser-extension/manifest.json` from the extracted folder.

The add-on remains loaded until Firefox closes. Select **Reload** on its card after editing files.

## Manual checks

- Confirm the extension appears in `about:addons` and its toolbar button opens the popup.
- Open Options and use the health check against `https://encomerciales.com/api`.
- Visit and refresh one product page at each available supported retailer; verify the name, price, and retailer detected by the extension.
- Check a product with historical data and one without enough history, if available.
- Restart Firefox and confirm the temporary add-on was removed. Load it again from `about:debugging` when continuing the test.

A temporary installation does not test Mozilla Add-ons signing or permanent distribution. For permanent installation, the extension must be packaged and signed by Mozilla.

## Firefox compatibility details

The add-on uses Firefox's `background.scripts` event page with ES module support and the WebExtensions `chrome.*` compatibility namespace. Firefox provides `storage.session` from Firefox 115, so the manifest sets Firefox 121 as its minimum for the combined background configuration. Product extraction and API calls otherwise use the existing extension code.

See Mozilla's documentation for [background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), and [`storage.session`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session).
