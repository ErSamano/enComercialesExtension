import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { analyzeProduct, createAnalysisRunner, productKey, analysisKey } from '../../browser-extension/utils/analysis.js';
import { classifyHistoryState, historyEvidence, extractionDisplay } from '../../browser-extension/utils/popup-state.js';
import { normalizeComparisonResponse, applyVerifiedHistoryFallback, describeRealDiscount, formatPercent, isCurrencyCompatible } from '../../browser-extension/utils/real-discount.js';
import { formatCurrency } from '../../browser-extension/utils/currency.js';
import { ratePrice } from '../../browser-extension/utils/rating.js';
import { renderPriceHistory } from '../../browser-extension/components/price-history.js';
import { searchProducts, getProductHistory } from '../../browser-extension/utils/api.js';
import { renderExtractedProduct, renderPending, renderResult, renderFatal } from '../../browser-extension/popup/render.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../docs/browser-extension/p0-evidence/${name}.json`, import.meta.url)));
const chivas = read('chivas'), jack = read('jack');
const clone = value => structuredClone(value);
const product = { name: 'Chivas Regal 12 Años 750 ml', retailer: 'Bodegas Alianza', price: { amount: 475, currency: 'MXN' }, tabId: 1, detectedAt: 'a' };
const candidate = chivas.search.response.products[0];
const trusted = chivas.history.response;
globalThis.chrome = { storage: { local: { async get(defaults) { return defaults; } } } };
const requests = [];
function responses(search, history, comparison = chivas.comparison.response) {
  requests.length = 0;
  globalThis.fetch = async url => {
    requests.push(new URL(url));
    const data = String(url).includes('/search?') ? search : String(url).includes('/history?') ? history : comparison;
    if (data instanceof Error) throw data;
    return { ok: true, status: 200, async json() { return clone(data); } };
  };
}
for (const confidence of ['MEDIUM', 'LOW']) for (const verified of [true, false]) {
  test(`${confidence} search followed by ${verified ? 'verified' : 'rejected'} history`, async () => {
    responses({ products: [{ ...candidate, matchConfidence: confidence }] }, verified ? trusted : jack.history.response);
    const result = await analyzeProduct(product);
    assert.equal(result.state.status, verified ? 'AVAILABLE' : 'UNVERIFIED');
    assert.equal(requests[1].searchParams.get('confidence'), confidence);
  });
}
test('HTTP 200 API error remains an error and retains HTTP diagnostic', async () => {
  responses({ error: 'DATABASE_UNAVAILABLE' });
  const diagnostics = [];
  await assert.rejects(searchProducts(product, { onDiagnostic: d => diagnostics.push(d) }), /DATABASE_UNAVAILABLE/);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].httpStatus, 200);
  assert.equal(diagnostics[0].trustedHistoryReturned, false);
  assert.equal(classifyHistoryState({ match: candidate, history: { error: 'FAIL' } }).status, 'ERROR');
});
test('real trusted observations vs empty or contradictory history', () => {
  assert.equal(historyEvidence(trusted).trustedHistoryReturned, true);
  assert.equal(historyEvidence(jack.history.response).trustedHistoryReturned, false);
  assert.equal(historyEvidence({ history: [] }).trustedHistoryReturned, false);
  assert.equal(classifyHistoryState({ match: candidate, history: { match: trusted.match, history: [] } }).status, 'INSUFFICIENT');
  assert.equal(classifyHistoryState({ match: candidate, history: { ...trusted, match: jack.history.response.match } }).status, 'CONTRACT_INCONSISTENT');
});
test('missing optional fields do not discard explicitly verified observations', async () => {
  responses({ products: [candidate] }, { match: { identity: { status: 'VERIFIED' } }, history: trusted.history.slice(0, 2) }, {});
  const result = await analyzeProduct(product);
  assert.equal(result.state.status, 'AVAILABLE');
  assert.deepEqual(result.history.statistics, {});
});
test('Unicode and mojibake preserve API ID unchanged', async () => {
  responses(jack.search.response, jack.history.response);
  const name = 'Whiskey Jack Daniel’s Old No. 7 de 700 ml';
  await analyzeProduct({ ...product, name });
  assert.equal(requests[0].searchParams.get('name'), name);
  const id = jack.search.response.products[0].id;
  assert.equal(requests[1].searchParams.get('id'), id);
  assert.equal(Buffer.from(id, 'base64url').toString('utf8'), jack.search.response.products[0].name);
  assert.notEqual(Buffer.from(name).toString('base64url'), id);
  await getProductHistory('opaque/+é=?&', 'LOW');
  assert.equal(requests.at(-1).searchParams.get('id'), 'opaque/+é=?&');
});
test('missing candidate ID fails without constructing one', async () => {
  responses({ products: [{ name: 'Example', matchConfidence: 'MEDIUM' }] });
  assert.equal((await analyzeProduct(product)).state.status, 'NOT_FOUND');
  assert.equal(requests.length, 1);
});
test('comparison rejection or failure cannot overwrite verified history', async () => {
  for (const comparison of [jack.comparison.response, new Error('offline'), { ...chivas.comparison.response, product: { id: 'other' } }]) {
    responses(chivas.search.response, trusted, comparison);
    const result = await analyzeProduct(product);
    assert.equal(result.state.status, 'AVAILABLE');
    assert.equal(result.history.statistics.trustedRecords, 111);
    assert.ok(result.comparisonWarning);
  }
});
test('Chivas live response regression; Jack remains safely rejected', async () => {
  responses(chivas.search.response, trusted);
  const positive = await analyzeProduct(product);
  assert.equal(positive.history.statistics.historicalLow, 429);
  assert.equal(positive.history.statistics.historicalHigh, 900);
  assert.equal(positive.history.realDiscount.market.source, 'VERIFIED_HISTORY_FALLBACK');
  assert.equal(positive.comparisonWarning, 'COMPARISON_PRODUCT_MISMATCH');
  responses(jack.search.response, jack.history.response);
  assert.equal((await analyzeProduct(product)).state.status, 'NOT_FOUND');
});

test('verified history for a different product is blocked even when API says VERIFIED', async () => {
  const mismatched = clone(trusted);
  mismatched.product.name = 'Whisky Johnnie Walker Black Label 12 Años 750 ml';
  mismatched.match.identity.status = 'VERIFIED';
  responses(chivas.search.response, mismatched);
  const result = await analyzeProduct(product);
  assert.equal(result.state.status, 'CONTRACT_INCONSISTENT');
  assert.equal(result.history.realDiscount, null);
});

test('verified history fallback requires sufficient trusted sample and matching currency', () => {
  const normalized = normalizeComparisonResponse({ statistics: { historicalAverage: 900, trustedRecords: 14, sampleStatus: 'SUFFICIENT', currency: 'MXN' } });
  const fallback = applyVerifiedHistoryFallback(normalized, { currentPrice: 475, currentCurrency: 'MXN' });
  assert.equal(fallback.realDiscount.market.source, 'VERIFIED_HISTORY_FALLBACK');
  assert.equal(Math.round(fallback.realDiscount.marketRealDiscountPercent), 47);
  assert.equal(applyVerifiedHistoryFallback(normalized, { currentPrice: 475, currentCurrency: 'USD' }).realDiscount.marketRealDiscountPercent, null);
});
test('matching verified comparison restores both discounts from API fields', async () => {
  const comparison = clone(chivas.comparison.response);
  comparison.product.id = candidate.id;
  comparison.realDiscount.retailer = { status: 'AVAILABLE', currency: 'MXN', realDiscountPercent: 12 };
  responses(chivas.search.response, trusted, comparison);
  const result = await analyzeProduct(product);
  assert.equal(result.history.realDiscount.marketRealDiscountPercent, 33.14);
  assert.equal(result.history.realDiscount.retailerRealDiscountPercent, 12);
});
test('out-of-order completion and stale analyses are discarded', async () => {
  const runner = createAnalysisRunner();
  let finish;
  const blocked = new Promise(resolve => { finish = resolve; });
  let n = 0;
  globalThis.fetch = async url => {
    if (++n === 1) await blocked;
    return { ok: true, status: 200, async json() { return String(url).includes('/search?') ? chivas.search.response : String(url).includes('/history?') ? trusted : chivas.comparison.response; } };
  };
  const first = analyzeProduct(product, { isCurrent: runner.begin() });
  await new Promise(resolve => setImmediate(resolve));
  const second = await analyzeProduct(product, { isCurrent: runner.begin() });
  finish();
  assert.equal(second.state.status, 'AVAILABLE');
  assert.equal(await first, null);
  const stale = runner.begin(); runner.invalidate();
  assert.equal(stale(), false);
  assert.notEqual(productKey(product), productKey({ ...product, detectedAt: 'b' }));
  assert.notEqual(productKey(product), productKey({ ...product, tabId: 2 }));
});

test('verified history is delivered before a stalled comparison', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let preview;
  globalThis.fetch = async url => {
    if (String(url).includes('/compare?')) await pending;
    return { ok: true, status: 200, async json() { return clone(String(url).includes('/search?') ? chivas.search.response : String(url).includes('/history?') ? trusted : chivas.comparison.response); } };
  };
  let completed = false;
  const job = analyzeProduct(product, { onResult: value => { preview = value; } }).then(value => { completed = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(preview.state.status, 'AVAILABLE');
  assert.equal(preview.history.statistics.historicalLow, 429);
  assert.equal(completed, false);
  release();
  assert.equal((await job).state.status, 'AVAILABLE');
});

test('popup renders, caches, isolates tabs, cancels stale work and survives storage failure', async () => {
  class Element {
    hidden = false; textContent = ''; dataset = {}; children = []; listeners = {};
    closest() { return this; } addEventListener(type, fn) { this.listeners[type] = fn; } setAttribute() {}
    append(child) { this.children.push(child); } replaceChildren() { this.children = []; }
  }
  const ids = new Set([...fs.readFileSync(new URL('../../browser-extension/popup/popup.html', import.meta.url), 'utf8').matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const elements = new Map();
  const document = { getElementById(id) { assert.ok(ids.has(id), `Missing popup element: ${id}`); if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, createElementNS() { return new Element(); } };
  globalThis.document = document;
  let change;
  let failWrites = false;
  const storage = { 'product:1': product };
  const chrome = { tabs: { async query() { return [{ id: 1 }]; }, async sendMessage() { return { product: storage['product:1'] }; } }, storage: { session: { async get() { return clone(storage); }, async set(value) { if (failWrites) throw new Error('storage unavailable'); Object.assign(storage, clone(value)); } }, onChanged: { addListener(listener) { change = listener; } } } };
  let finishOld;
  let oldSignal;
  let runs = 0;
  const goodResult = { match: candidate, history: normalizeComparisonResponse({ ...trusted, realDiscount: chivas.comparison.response.realDiscount }), state: { status: 'AVAILABLE' } };
  const context = { document, chrome, console: { ...console, warn() {} }, AbortController, window: { addEventListener() {} }, getSettings: async () => ({ apiBaseUrl: 'https://encomerciales.com/api' }), analyzeProduct: async (_product, options) => {
    if (++runs === 2) { oldSignal = options.signal; await new Promise(resolve => { finishOld = resolve; }); }
    return goodResult;
  }, createAnalysisRunner, productKey, analysisKey, renderExtractedProduct, renderPending, renderResult, renderFatal };
  const source = fs.readFileSync(new URL('../../browser-extension/popup/popup.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const detect = async value => { storage['product:1'] = value; change({ 'product:1': { newValue: value } }, 'session'); await tick(); };
  vm.runInNewContext(`{${source}}`, context);
  await tick();
  assert.equal(elements.get('history-statistics').hidden, false);
  assert.match(elements.get('low').textContent, /429/);
  assert.match(elements.get('high').textContent, /900/);
  assert.match(elements.get('average').textContent, /624/);
  assert.equal(elements.get('observations').textContent, 111);
  assert.equal(elements.get('chart').children.length, 1);
  assert.equal(elements.get('history-details').open, false);
  assert.equal(runs, 1);
  change({ 'product:2': { newValue: { ...product, tabId: 2 } } }, 'session'); await tick();
  assert.equal(runs, 1);
  await detect({ ...product, detectedAt: 'timestamp-only-change' });
  assert.equal(runs, 1);
  // Reopening the popup uses the saved result without any API work.
  vm.runInNewContext(`{${source}}`, context); await tick();
  assert.equal(runs, 1);
  await detect({ ...product, price: { amount: 476, currency: 'MXN' } });
  await detect({ ...product, name: 'New product', detectedAt: 'new' });
  assert.equal(oldSignal.aborted, true);
  finishOld(); await tick();
  assert.equal(elements.get('product-name').textContent, 'New product');
  assert.equal(storage.analysisResult.productKey, productKey(storage['product:1']));
  context.analyzeProduct = async () => ({ match: candidate, history: jack.history.response, state: { status: 'UNVERIFIED', reason: 'Rejected by server' } });
  await detect({ ...product, name: 'Rejected product' });
  assert.equal(elements.get('history-statistics').hidden, true);
  assert.equal(elements.get('chart').hidden, true);
  assert.equal(elements.get('history-reason').textContent, 'Rejected by server');
  context.analyzeProduct = async () => { throw new Error('offline'); };
  await detect({ ...product, name: 'Offline product' });
  assert.equal(elements.get('content').hidden, false);
  assert.equal(storage.analysisResult.apiStatus, 'API_ERROR');
  assert.equal(elements.get('retry').disabled, false);
  failWrites = true;
  context.analyzeProduct = async () => goodResult;
  await detect({ ...product, name: 'Storage failure product' });
  assert.equal(elements.get('history-summary').hidden, false);
  assert.match(elements.get('low').textContent, /429/);
  await detect(null);
  assert.equal(elements.get('content').hidden, true);
});
