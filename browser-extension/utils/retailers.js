// Supported retailers shown to users in the popup.
// TODO: unify the supported retailer list here. The same domains are still
// duplicated in manifest.json, content/inject.js, content/detector.js and
// background/background.js. Content scripts cannot import ES modules, so
// inject.js needs a generated copy or a build step to share this list.
export const SUPPORTED_RETAILERS = Object.freeze([
  { name: 'Vinoteca', url: 'https://www.vinoteca.com/' },
  { name: 'Bodegas Alianza', url: 'https://www.bodegasalianza.com/' },
  { name: 'La Europea', url: 'https://laeuropea.com.mx/' },
  { name: 'El Palacio de Hierro', url: 'https://www.elpalaciodehierro.com/' },
  { name: 'La Castellana', url: 'https://lacastellana.com/' },
  { name: 'Liverpool', url: 'https://www.liverpool.com.mx/' }
]);
