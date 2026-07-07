// Sprint 4.2 SEO-router: nette URL's + veilige redirects.
// Bestaande .html-bestanden blijven werken via 301 redirects naar de nette URL's.

const STATIC_ROUTES = {
  '/clubnieuws': '/clubnieuws.html',
  '/fotogalerij': '/fotogalerij.html',
  '/over-ons': '/over-ons.html',
  '/disciplines': '/disciplines.html',
  '/geschiedenis': '/geschiedenis.html',
  '/contact': '/contact.html',
  '/agenda': '/agenda.html',
  '/boogschieten': '/boogschieten.html',
  '/luchtdruk': '/luchtdruk.html',
  '/vuurwapen-disciplines': '/vuurwapen-disciplines.html'
};

const HTML_REDIRECTS = {
  '/index.html': '/',
  '/clubnieuws.html': '/clubnieuws',
  '/fotogalerij.html': '/fotogalerij',
  '/over-ons.html': '/over-ons',
  '/disciplines.html': '/disciplines',
  '/geschiedenis.html': '/geschiedenis',
  '/contact.html': '/contact',
  '/agenda.html': '/agenda',
  '/boogschieten.html': '/boogschieten',
  '/luchtdruk.html': '/luchtdruk',
  '/vuurwapen-disciplines.html': '/vuurwapen-disciplines'
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = normalizePath(url.pathname);

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return context.env.ASSETS.fetch(context.request);
  }

  // Oude CMS-pagina URL: /pagina.html?slug=bestuur -> /bestuur
  if (path === '/pagina.html') {
    const slug = cleanSlug(url.searchParams.get('slug') || '');
    if (slug && slug !== 'home') return redirectTo(url, '/' + encodeURIComponent(slug));
    return redirectTo(url, '/');
  }

  // Oude nieuwsdetail URL: /clubnieuws.html?id=... -> /nieuws/...
  if (path === '/clubnieuws.html' && url.searchParams.get('id')) {
    return redirectTo(url, '/nieuws/' + encodeURIComponent(url.searchParams.get('id')));
  }

  // Oude vaste .html URL's -> nette URL's.
  if (HTML_REDIRECTS[path] && url.search === '') {
    return redirectTo(url, HTML_REDIRECTS[path]);
  }

  // Laat assets, API-proxy en bestaande bestanden ongemoeid.
  if (path === '/' || path.startsWith('/api/') || hasFileExtension(path)) {
    return context.env.ASSETS.fetch(context.request);
  }

  // Nette nieuwsdetail-URL: /nieuws/<id> -> clubnieuws.html; JS leest het ID uit het pad.
  if (path.startsWith('/nieuws/')) {
    return serveAsset(context, '/clubnieuws.html');
  }

  // Nette agenda detail-URL: /agenda/<id> -> agenda.html; JS leest het ID uit het pad.
  if (path.startsWith('/agenda/')) {
    return serveAsset(context, '/agenda.html');
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

function cleanSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function redirectTo(sourceUrl, targetPath) {
  const target = new URL(sourceUrl.toString());
  target.pathname = targetPath;
  target.search = '';
  return Response.redirect(target.toString(), 301);
}
