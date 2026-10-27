import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { searchProducts } from '../../browser-extension/utils/api.js';
import { normalizeProductName } from '../../browser-extension/utils/product-normalizer.js';

const read = path => fs.readFileSync(new URL(`../../browser-extension/${path}`, import.meta.url), 'utf8');

test('background stores each tab separately and cleans up navigation/closed tabs', async () => {
  const storage = {};
  let onMessage, onRemoved, onUpdated;
  const chrome = {
    runtime: { onMessage: { addListener(fn) { onMessage = fn; } } },
    storage: { session: { async set(values) { Object.assign(storage, structuredClone(values)); }, async remove(keys) { keys.forEach(key => delete storage[key]); } } },
    tabs: { onRemoved: { addListener(fn) { onRemoved = fn; } }, onUpdated: { addListener(fn) { onUpdated = fn; } } }
  };
  vm.runInNewContext(read('background/background.js').replace(/^import .*;\n/gm, ''), { chrome, normalizeProductName });
  await new Promise(resolve => onMessage({ type: 'PRODUCT_DETECTED', product: { name: 'First bottle' } }, { tab: { id: 1 } }, resolve));
  await new Promise(resolve => onMessage({ type: 'PRODUCT_DETECTED', product: { name: 'Second bottle' } }, { tab: { id: 2 } }, resolve));
  assert.equal(storage['product:1'].name, 'First bottle');
  assert.equal(storage['product:2'].name, 'Second bottle');
  assert.equal(storage.lastProduct.name, 'Second bottle');
  storage['analysis:1'] = { result: 'old' };
  onUpdated(1, { status: 'loading' });
  assert.equal(storage['product:1'], undefined);
  assert.equal(storage['analysis:1'], undefined);
  assert.equal(storage['product:2'].name, 'Second bottle');
  onRemoved(2);
  assert.equal(storage['product:2'], undefined);
});

test('continuous DOM changes cannot starve extraction and price-only changes emit', async () => {
  let name = 'Chivas Regal 12 Años 750 ml';
  let price = '475';
  let observer, messageListener;
  let nextId = 0;
  const timers = new Map();
  const sent = [];
  const document = {
    body: {},
    querySelector(selector) {
      if (selector === 'h1, .vtex-store-components-3-x-productNameContainer') return { textContent: name };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') return [{ textContent: JSON.stringify({ '@type': 'Product', name, offers: { price, priceCurrency: 'MXN' } }) }];
      return [];
    }
  };
  const context = {
    document, URL, location: { hostname: 'www.bodegasalianza.com', href: 'https://www.bodegasalianza.com/bottle/p' },
    chrome: { runtime: { sendMessage(message) { sent.push(structuredClone(message)); return Promise.resolve(); }, onMessage: { addListener(fn) { messageListener = fn; } } } },
    window: { setTimeout(fn) { timers.set(++nextId, fn); return nextId; }, clearTimeout(id) { timers.delete(id); } },
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} }
  };
  vm.runInNewContext(read('content/inject.js'), context);
  assert.equal(sent.length, 1);
  for (let n = 0; n < 100; n++) observer();
  assert.equal(timers.size, 1);
  const id = [...timers.keys()][0];
  price = '450';
  timers.get(id)(); timers.delete(id);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].product.price.amount, 450);
  let response;
  messageListener({ type: 'GET_PRODUCT' }, {}, value => { response = value; });
  assert.equal(response.product.price.amount, 450);
  assert.equal(response.product.url, context.location.href);
  // A fresh page request still responds when the product signature hasn't changed.
  assert.equal(sent.length, 3);
});

test('cancellation aborts the actual network request', async () => {
  globalThis.chrome = { storage: { local: { async get(defaults) { return defaults; } } } };
  let requestSignal;
  globalThis.fetch = (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  };
  const controller = new AbortController();
  const pending = searchProducts({ name: 'Bottle' }, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
});
