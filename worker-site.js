// PDN website v5 Worker router
// Zorgt dat nette URL's zoals /agenda/<id> en /nieuws/<id> altijd
// naar de juiste HTML-template gaan, zonder redirect-loops.

const API_ORIGIN = 'https://pdn-api.info-fematec.workers.dev';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (path.startsWith('/api/')) {
      return proxyApi(request, path.replace(/^\/api\/?/, ''), env);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    // Oude CMS-pagina URL: /pagina.html?slug=bestuur -> /bestuur
    if (path === '/pagina.html') {
      const slug = cleanSlug(url.searchParams.get('slug') || '');
      if (slug && slug !== 'home') return redirectTo(url, '/' + encodeURIComponent(slug));
      return serveAsset(request, env, '/pagina.html');
    }

    // Oude nieuwsdetail URL: /clubnieuws.html?id=... -> /nieuws/...
    if (path === '/clubnieuws.html' && url.searchParams.get('id')) {
      return redirectTo(url, '/nieuws/' + encodeURIComponent(url.searchParams.get('id')));
    }

    // Oude vaste .html URL's -> nette URL's.
    if (HTML_REDIRECTS[path] && url.search === '') {
      return redirectTo(url, HTML_REDIRECTS[path]);
    }

    // Laat bestaande bestanden/assets ongemoeid.
    if (path === '/' || hasFileExtension(path)) {
      return env.ASSETS.fetch(request);
    }

    // Nette nieuwsdetail-URL: /nieuws/<id> -> clubnieuws.html; JS leest ID uit path.
    if (path.startsWith('/nieuws/')) {
      return serveAsset(request, env, '/clubnieuws.html');
    }

    // Nette agenda detail-URL: /agenda/<id> -> agenda.html; JS leest ID uit path.
    if (path.startsWith('/agenda/')) {
      return serveAsset(request, env, '/agenda.html');
    }

    // Nette vaste URL's.
    if (STATIC_ROUTES[path]) {
      return serveAsset(request, env, STATIC_ROUTES[path]);
    }

    // Veiligheid: /pagina zonder slug toont pagina.html, maar redirect niet door.
    if (path === '/pagina') {
      return serveAsset(request, env, '/pagina.html');
    }

    // Nieuwe CMS-pagina's: /bestuur -> pagina.html; JS haalt slug uit pathname.
    return serveAsset(request, env, '/pagina.html');
  }
};

async function proxyApi(request, rawPath) {
  const url = new URL(request.url);
  const upstreamUrl = `${API_ORIGIN}/${rawPath}${url.search}`;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const headers = new Headers(request.headers);
  ['host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'x-forwarded-proto', 'x-real-ip', 'cookie'].forEach(h => headers.delete(h));
  headers.set('accept', headers.get('accept') || 'application/json');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow'
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(upstreamUrl, init);
    const outHeaders = new Headers(response.headers);
    outHeaders.set('cache-control', 'no-store');
    outHeaders.set('access-control-allow-origin', '*');
    outHeaders.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    outHeaders.set('access-control-allow-headers', 'content-type, authorization');
    outHeaders.delete('set-cookie');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders
    });
  } catch (error) {
    return Response.json({ ok: false, error: 'CMS API niet bereikbaar', detail: String(error && error.message || error) }, {
      status: 502,
      headers: corsHeaders()
    });
  }
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

function serveAsset(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return env.ASSETS.fetch(new Request(url.toString(), request));
}

function redirectTo(sourceUrl, targetPath) {
  const target = new URL(sourceUrl.toString());
  target.pathname = targetPath;
  target.search = '';
  return Response.redirect(target.toString(), 301);
}

function corsHeaders() {
  return {
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization'
  };
}
