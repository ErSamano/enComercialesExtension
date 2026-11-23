import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createAnalysisRunner, productKey, analysisKey } from '../../browser-extension/utils/analysis.js';
import { renderExtractedProduct, renderPending, renderResult, renderFatal } from '../../browser-extension/popup/render.js';
import { renderHomePage, HOME_PAGE_HINT } from '../../browser-extension/popup/home-page.js';

const read = path => fs.readFileSync(new URL(`../../browser-extension/${path}`, import.meta.url), 'utf8');

function runContentScript({ href, elements = {}, jsonLd = [] }) {
  const sent = [];
  let messageListener;
  const document = {
    body: {},
    querySelector(selector) { return elements[selector] || null; },
    querySelectorAll(selector) { return selector === 'script[type="application/ld+json"]' ? jsonLd.map(value => ({ textContent: JSON.stringify(value) })) : []; }
  };
  const location = { href, hostname: new URL(href).hostname };
  const context = {
    document, URL, location,
    chrome: { runtime: { sendMessage(message) { sent.push(structuredClone(message)); return Promise.resolve(); }, onMessage: { addListener(fn) { messageListener = fn; } } } },
    window: { setTimeout() { return 1; }, clearTimeout() {} },
    MutationObserver: class { observe() {} }
  };
  vm.runInNewContext(read('content/inject.js'), context);
  const getProduct = () => { let response; messageListener({ type: 'GET_PRODUCT' }, {}, value => { response = value; }); return JSON.parse(JSON.stringify(response)); };
  return { sent, getProduct };
}
const card = (name, href) => ({ textContent: name, closest: selector => (selector === 'a[href]' ? { getAttribute: () => href } : null) });

test('store home page reports a featured product with its own link instead of a page product', () => {
  const { sent, getProduct } = runContentScript({
    href: 'https://www.liverpool.com.mx/tienda/home',
    elements: { 'h1, h3.a-card-description': card(' Chivas Regal 12 Años 750 ml ', '/tienda/pdp/chivas-regal-12/1234') }
  });
  assert.equal(sent.length, 0, 'home pages must not emit PRODUCT_DETECTED');
  assert.deepEqual(getProduct(), { product: null, homePage: { featuredProduct: { name: 'Chivas Regal 12 Años 750 ml', url: 'https://www.liverpool.com.mx/tienda/pdp/chivas-regal-12/1234' } } });
  assert.equal(sent.length, 0);
});

test('featured product needs a link to a product on the same store', () => {
  const headingOnly = runContentScript({ href: 'https://www.vinoteca.com/', elements: { '.vtex-product-identifier-0-x-productName, h1': { textContent: 'Ofertas de temporada' } } });
  assert.deepEqual(headingOnly.getProduct(), { product: null, homePage: { featuredProduct: null } });
  const otherStore = runContentScript({ href: 'https://www.vinoteca.com/', jsonLd: [{ '@type': 'Product', name: 'Malbec', url: 'https://example.com/malbec/p' }] });
  assert.equal(otherStore.getProduct().homePage.featuredProduct, null);
  const homeLink = runContentScript({ href: 'https://www.vinoteca.com/', elements: { '.vtex-product-identifier-0-x-productName, h1': card('Banner', '/') } });
  assert.equal(homeLink.getProduct().homePage.featuredProduct, null);
  const structured = runContentScript({ href: 'https://www.vinoteca.com/', jsonLd: [{ '@type': 'ItemList', itemListElement: [{ item: { '@type': 'Product', name: 'Malbec Reserva', url: '/malbec-reserva/p' } }] }] });
  assert.deepEqual(structured.getProduct().homePage.featuredProduct, { name: 'Malbec Reserva', url: 'https://www.vinoteca.com/malbec-reserva/p' });
  // VTEX home pages list products with their URL in @id instead of url.
  const vtex = runContentScript({ href: 'https://www.vinoteca.com/', jsonLd: [{ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', position: 1, item: { '@type': 'Product', '@id': 'https://www.vinoteca.com/vino-tinto-muga-reserva-750-ml/p', name: 'Vino Tinto Muga Reserva 750 ml' } }] }] });
  assert.deepEqual(vtex.getProduct().homePage.featuredProduct, { name: 'Vino Tinto Muga Reserva 750 ml', url: 'https://www.vinoteca.com/vino-tinto-muga-reserva-750-ml/p' });
});

test('product pages keep reporting the page product', () => {
  const { sent, getProduct } = runContentScript({ href: 'https://www.vinoteca.com/malbec-reserva/p', elements: { '.vtex-product-identifier-0-x-productName, h1': { textContent: 'Malbec Reserva' } } });
  assert.equal(sent.length, 1);
  const response = getProduct();
  assert.equal(response.product.name, 'Malbec Reserva');
  assert.equal(response.homePage, undefined);
});

test('popup shows the home page hint always and links the featured product when there is one', async () => {
  class Element {
    hidden = false; disabled = false; textContent = ''; dataset = {}; children = [];
    addEventListener() {} append(child) { this.children.push(child); } replaceChildren(...children) { this.children = children; }
  }
  const ids = new Set([...read('popup/popup.html').matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const elements = new Map();
  globalThis.document = { getElementById(id) { assert.ok(ids.has(id), `Missing popup element: ${id}`); if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, createElement(tagName) { return Object.assign(new Element(), { tagName }); } };
  const source = read('popup/popup.js').replace(/^import .*;\n/gm, '');
  let analyses = 0;
  const open = async response => {
    elements.clear();
    const chrome = { tabs: { async query() { return [{ id: 1 }]; }, async sendMessage() { return response; } }, storage: { session: { async get() { return {}; } }, onChanged: { addListener() {} } } };
    vm.runInNewContext(`{${source}}`, { document: globalThis.document, chrome, console, AbortController, window: { addEventListener() {} }, getSettings: async () => ({}), analyzeProduct: async () => { analyses += 1; return null; }, createAnalysisRunner, productKey, analysisKey, renderExtractedProduct, renderPending, renderResult, renderFatal, renderHomePage });
    await new Promise(resolve => setImmediate(resolve));
  };

  await open({ product: null, homePage: { featuredProduct: { name: 'Malbec Reserva', url: 'https://www.vinoteca.com/malbec-reserva/p' } } });
  const state = elements.get('state');
  assert.equal(state.hidden, false);
  assert.equal(state.children[0], HOME_PAGE_HINT);
  const link = state.children.at(-1);
  assert.equal(link.tagName, 'a');
  assert.equal(link.textContent, 'Malbec Reserva');
  assert.equal(link.href, 'https://www.vinoteca.com/malbec-reserva/p');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(elements.get('content').hidden, true);
  assert.equal(elements.get('error').hidden, true);
  assert.equal(elements.get('retry').hidden, true);
  assert.equal(analyses, 0, 'a featured product is linked, not analyzed');

  await open({ product: null, homePage: { featuredProduct: null } });
  assert.deepEqual(elements.get('state').children, [HOME_PAGE_HINT]);

  await open({ product: null, homePage: { featuredProduct: { name: 'Bad link', url: 'javascript:alert(1)' } } });
  assert.deepEqual(elements.get('state').children, [HOME_PAGE_HINT]);
});
