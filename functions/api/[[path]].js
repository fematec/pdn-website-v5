const API_ORIGIN = 'https://pdn-api.info-fematec.workers.dev';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const rawPath = context.params.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');
  const upstreamUrl = `${API_ORIGIN}/${path}${url.search}`;

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const headers = new Headers(context.request.headers);
  ['host','cf-connecting-ip','cf-ipcountry','cf-ray','x-forwarded-proto','x-real-ip','cookie'].forEach(h => headers.delete(h));
  headers.set('accept', headers.get('accept') || 'application/json');

  const init = {
    method: context.request.method,
    headers,
    redirect: 'follow'
  };

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = await context.request.arrayBuffer();
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

function corsHeaders() {
  return {
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization'
  };
}
