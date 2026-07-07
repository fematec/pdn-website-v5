// Sprint 4.1 veilige SEO-router voor Cloudflare Pages.
// Bestaande .html-bestanden blijven werken; nette URL's worden intern naar dezelfde HTML gerouteerd.

const STATIC_ROUTES = {
  '/clubnieuws': '/clubnieuws.html',
  '/fotogalerij': '/fotogalerij.html',
  '/over-ons': '/over-ons.html',
  '/disciplines': '/disciplines.html',
  '/geschiedenis': '/geschiedenis.html',
  '/contact': '/contact.html',
  '/boogschieten': '/boogschieten.html',
  '/luchtdruk': '/luchtdruk.html',
  '/vuurwapen-disciplines': '/vuurwapen-disciplines.html'
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = normalizePath(url.pathname);

  // Laat assets, API-proxy en bestaande bestanden ongemoeid.
  if (path === '/' || path.startsWith('/api/') || hasFileExtension(path)) {
    return context.env.ASSETS.fetch(context.request);
  }

  // Nette nieuwsdetail-URL: /nieuws/<id> -> clubnieuws.html; JS leest het ID uit het pad.
  if (path.startsWith('/nieuws/')) {
    return serveAsset(context, '/clubnieuws.html');
  }

  // Nette vaste URL's: /over-ons, /clubnieuws, /fotogalerij enz.
  if (STATIC_ROUTES[path]) {
    return serveAsset(context, STATIC_ROUTES[path]);
  }

  // Nieuwe CMS-pagina's: /bestuur -> pagina.html; JS haalt slug uit location.pathname.
  return serveAsset(context, '/pagina.html');
}

function normalizePath(pathname) {
  const p = String(pathname || '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return p || '/';
}

function hasFileExtension(path) {
  return /\.[a-z0-9]{2,8}$/i.test(path);
}

function serveAsset(context, pathname) {
  const url = new URL(context.request.url);
  url.pathname = pathname;
  url.search = '';
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}
