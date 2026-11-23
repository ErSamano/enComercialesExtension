// Store home page view. It reuses the #state status line, so rendering a product or an error hides it.
export const HOME_PAGE_HINT = 'Selecciona un producto en esta página para ver su historial de precios.';

function safeProductUrl(value) {
  try { return new URL(String(value)).protocol === 'https:' ? String(value) : ''; } catch { return ''; }
}

export function renderHomePage(homePage) {
  const $ = id => document.getElementById(id);
  const parts = [HOME_PAGE_HINT];
  const featured = homePage?.featuredProduct;
  const url = safeProductUrl(featured?.url);
  if (typeof featured?.name === 'string' && featured.name.trim() && url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = featured.name.trim();
    parts.push(document.createElement('br'), 'Producto destacado: ', link);
  }
  $('content').hidden = true;
  $('error').hidden = true;
  $('state').replaceChildren(...parts);
  $('state').hidden = false;
}
