# P0 integration recovery — 2026-10-21

Client corrections and regression tests are complete. The Jack Daniel’s production
case is **not resolved end to end**: the API explicitly rejects its identity and
returns no observations. Displaying statistics for it would bypass verification.
No PHP, extraction code, manifest, database or deployed files were changed.

## Root cause and complete flow

1. The manifest loads `content/inject.js` (the classic runtime bundle, not the
   module `extractor.js`). Structured data/retailer selectors extract the name;
   price selection prefers the selected Shopify variant, primary DOM, then
   structured data. The Alianza adapter supplies the retailer and reference price.
2. `PRODUCT_DETECTED` reaches `background/background.js`, which stores the raw
   name, separately normalized name, price, tab ID and detection time.
3. Popup search sends the **raw** name, SKU and GTIN, with limit 5. It ranks the
   response's `products` by search confidence; this is candidate discovery only.
4. The returned `id` is passed unchanged to history, with URL percent encoding.
   The extension neither constructs Base64 IDs nor normalizes a candidate ID.
5. Previously LOW/UNKNOWN search candidates returned before history verification.
   MEDIUM candidates reached history. Jack's HTTP-200 history response has
   `match.confidence: "UNKNOWN"`, `match.identity.status: "NOT_FOUND"`, and reason
   `No database product matched the selected identity.` The old
   `classifyHistoryState` LOW/UNKNOWN-history branch returned `UNVERIFIED`, which
   popup mapped to `CANDIDATE_UNVERIFIED`. This is the exact observed transition.
6. The diagnostic used `Boolean(body.statistics || body.history || body.realDiscount)`.
   An object with all-null statistics or even `history: []` is truthy. Thus
   `trustedHistoryReturned: true` was a false positive, not evidence of lost data.
7. New classification requires history's explicit `match.identity.status ===
   "VERIFIED"`, no identity conflicts, and positive numeric trusted observations
   (`statistics.trustedRecords`, then `observations`, then usable history points).
   Search confidence cannot veto a verified history response or authorize an
   unverified one. Explicit errors, malformed bodies, empty history and
   contradictory trust/data have distinct safe states. One verified observation
   may display statistics; rating/chart/discount availability remain independent.
8. Actual fields `historicalLow/low`, `historicalHigh/high`,
   `historicalAverage/average`, `trustedRecords/observations`, and `history` feed
   the existing popup and chart. Missing optional values remain unavailable.
9. The old popup never called comparison, and history has no Real Discount fields.
   The recovery requests comparison only after verified history. It uses returned
   discount percentages only when comparison is verified, its product ID matches
   the selected ID exactly, and each metric's status is `AVAILABLE`. It never
   computes these metrics from candidate prices. Failed/rejected/different-product
   comparison preserves verified history and records `comparisonWarning`.

## Actual public API evidence

Full sanitized requests and parsed responses, including HTTP status and capture
time, are in `p0-evidence/jack.json` and `p0-evidence/chivas.json`. Only public
product data and request parameters are included; no credentials or cookies.
Comparison was captured for investigation even though the original popup did not
use that endpoint. The captured Chivas offer (475/600 MXN) is a diagnostic input,
not a newly observed retailer price.

| Field | Actual JSON type | Jack | Chivas history |
| --- | --- | --- | --- |
| search.products | array of objects | 5 candidates | 5 candidates |
| candidate.id/name/matchConfidence | string | mojibake name, MEDIUM | Grabado candidate, MEDIUM |
| candidate.identity | object | REVIEW_REQUIRED | see capture |
| identity.canonicalProductId | null | null | null |
| history.product | object | name string | name string |
| history.match | object | confidence UNKNOWN | confidence EXACT |
| history.match.identity.status | string | NOT_FOUND | VERIFIED |
| statistics | object | 0 observations, null metrics | numeric metrics |
| statistics.observations | number | 0 | 111 |
| statistics.trustedRecords | number when present | absent | 111 |
| statistics.historicalLow | number or null | null | 429 |
| statistics.historicalHigh | number or null | null | 900 |
| statistics.historicalAverage | number or null | null | 624.5127927927929 |
| history | array of objects | empty | date/string, price/number, store/string |
| comparison.realDiscount | object | percentages null | numeric market percentage |
| comparison.realDiscount.*.status | string | INSUFFICIENT_DATA | market AVAILABLE, retailer INSUFFICIENT_DATA |

All six captured calls returned HTTP 200. That is transport success only.

## Encoding findings and contract inconsistencies

The public search JSON already contains `Danielâ€™s`. Decoding the returned ID as
Base64url UTF-8 reproduces that exact mojibake name. Encoding the correctly spelled
`Daniel’s` produces a different ID. The extension's normalizer is not involved in
the history request. The local PHP snapshot also uses name-based Base64url IDs,
but it predates the deployed identity fields and cannot explain the deployed
server internals. No character substitutions or ID reconstruction were added.
There is no usable stable canonical ID in these responses (`canonicalProductId`
is null); the candidate's returned `id` remains the only provided lookup handle.

Remaining upstream issues:

- Jack search advertises an ID that history returns as PRODUCT_NOT_FOUND. Compare
  also rejects it. Encoding corruption is present upstream, but the precise
  deployed lookup/database failure cannot be proven from these public responses.
- Chivas search limit 5 selects `Whisky Chivas Regal 12 AÃ±os 750 ml Grabado`.
  Comparison independently selects `Whisky Chivas Regal 12 AÃ±os, 750 ml` with a
  different ID, minimum 655.85, maximum 1009, average 710.3905405405401 and market
  discount 33.14%. These cannot be attached to the selected history. The client
  records `COMPARISON_PRODUCT_MISMATCH` and keeps the 429/900 history. Retailer
  discount is explicitly unavailable in the live comparison as well.
- A candidate's discovery identity may say REVIEW_REQUIRED while history/compare
  subsequently says VERIFIED. The endpoint's final `match.identity` is the
  decision used; discovery metadata is not treated as a final rejection.

These conditions need API-owner investigation; no PHP changes or bypasses were
made. Restoring Jack statistics requires a server-authorized response.

## State management

Each load has a generation token and checks product identity, detection time,
tab ID and active tab after asynchronous work and before rendering. Storage
changes start a fresh load; closing the popup invalidates pending work. Search
and history are sequential per operation. Late responses and late errors are
discarded. A product from another active tab is not shown.

Analysis diagnostics now live in `chrome.storage.session.analysisResult`, keyed
to the detected product. They do not rewrite `lastProduct`. Options merges only
the matching diagnostic record. This removes the old stale-error overwrite of
extraction storage. Loading and unavailable states hide prior history while
leaving the current extracted offer visible. Comparison cannot clear history.

## Modified files and Windows copy manifest

Source root: `/home/neto/codex/webBrowserExtention/browser-extension/`.
Destination root: the existing Windows **unpacked extension directory containing
manifest.json**, as shown by Brave. Its absolute path is not available in this
workspace; do not assume a Windows username or installation path.

Copy precisely these paths, preserving directories:

| Source relative to source root | Windows destination relative to extension root |
| --- | --- |
| utils/api.js | utils\api.js |
| utils/analysis.js (new) | utils\analysis.js |
| utils/popup-state.js | utils\popup-state.js |
| utils/real-discount.js | utils\real-discount.js |
| popup/popup.js | popup\popup.js |
| popup/options.js | popup\options.js |

`P0_COPY_MANIFEST.json` includes absolute source paths and SHA-256 checksums.
No HTML, CSS, manifest, background, extraction or PHP file needs copying.
Non-runtime changes: `tests/extension/p0-integration.test.mjs` (new),
`tests/extension/utils.test.mjs` (explicit identity fixtures), this report,
the copy manifest, two captured response fixtures, and five pre-edit backups in
`p0-rollback/`. CleanUI guidance preserved the existing visual layout and states.

## Verification

`node --test tests/extension/*.test.mjs`: all four test files pass.
`node tests/extension/p0-integration.test.mjs`: all 14 grouped tests pass.
JavaScript syntax checks pass for popup and analysis. Coverage includes every
requested regression category: MEDIUM/LOW followed by verified/rejected history;
HTTP-200 errors/trusted responses; empty history; optional fields; Unicode and
mojibake; opaque/missing IDs; out-of-order completions and stale analyses;
Chivas and Jack live fixtures; existing options/CSP, price extraction, formatting,
chart and popup behavior. Popup DOM tests check min/max/average/count, chart,
rejected/error states, stale rendering, active-tab rejection and disabled observe.
Matching-ID fixtures test both Real Discount mappings; the captured Chivas
comparison intentionally tests the mismatched-ID rejection.

Browser verification is still manual. Tests do not claim live Jack is fixed.

## Manual Brave validation

1. Back up the five existing destination files listed above. Copy all six files
   together. Do not copy tests, captures, backups or PHP into the extension.
2. Open `brave://extensions`, enable Developer mode, find enComerciales and Reload.
3. Refresh the Bodegas Alianza Jack Daniel’s page and reopen the popup. Confirm
   the extracted name, 378 MXN and 540 MXN reference remain visible. Given the
   captured API contract, history must remain unavailable, with the server reason.
4. Open extension Options. Diagnostics should show HTTP 200, identity NOT_FOUND,
   zero observations and `trustedHistoryReturned: false`, with
   `CANDIDATE_UNVERIFIED`. Inspect session `analysisResult` for the raw record.
5. Test Chivas Regal 12 Años 750 ml. Where the API returns the captured candidate,
   verify 429 minimum, 900 maximum, approximately 624.51 average, 111 observations
   and a chart. Data may change after capture. A different comparison ID must
   leave discounts unavailable and record COMPARISON_PRODUCT_MISMATCH.
6. With a same-ID, server-verified comparison, verify Market and Retailer Real
   Discount independently follow the API's AVAILABLE status and actual values.
   Do not expect the captured Chivas retailer discount to be available.
7. Throttle requests in popup DevTools; navigate/change product during requests,
   switch tabs, close/reopen popup, and simulate offline. Old results must not
   replace the current product. A rejected comparison must not erase its chart.
8. Confirm Options save/health-check still work, no CSP errors appear, and price
   observation remains disabled. No automated Windows copying/deployment occurred.

## Git and rollback evaluation

`git status` and `git log` fail because the supplied `.git` directory is empty.
There is no accessible commit history or verifiable last-known-working revision.
The prior `PHASE_1_6A_POPUP_HOTFIX.md` documents the LOW/UNKNOWN short-circuit but
does not establish a working commit. Do not attribute this regression to a commit
or reset unrelated work. A minimal client correction is safer than an unverified
rollback, especially because older confidence-only logic could admit unverified
data and cannot fix the live Jack server rejection.

For selective rollback of **this patch**, restore these pre-edit snapshots:

| Snapshot under docs/browser-extension/p0-rollback/ | Target under browser-extension/ |
| --- | --- |
| api.js | utils/api.js |
| popup-state.js | utils/popup-state.js |
| real-discount.js | utils/real-discount.js |
| popup.js | popup/popup.js |
| options.js | popup/options.js |

Then remove only the newly added `utils/analysis.js` if desired (it is harmless
when unreferenced). For Windows, restore your matching pre-copy backups and reload
Brave. Preserve all extraction files and unrelated edits. These backups are the
pre-task state, **not** certified known-good versions; rollback restores its
misleading diagnostic and confidence gates. No rollback was executed.
