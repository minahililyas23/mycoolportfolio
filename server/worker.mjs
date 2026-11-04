/* Original server entry. The build embeds this site's own static files. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    if (pathname === '/' || pathname === '/about' || pathname === '/about.html') pathname = '/index.html';
    if (['/interests', '/portfolio', '/contact'].includes(pathname)) pathname += '.html';
    const asset = Object.hasOwn(STATIC_FILES, pathname) ? STATIC_FILES[pathname] : null;
    const selected = asset || STATIC_FILES['/404.html'];
    const headers = {
      'Content-Type': selected.type,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com",
    };
    let body = null;
    if (request.method !== 'HEAD') {
      body = selected.encoding === 'base64'
        ? Uint8Array.from(atob(selected.body), (character) => character.charCodeAt(0))
        : selected.body;
    }
    return new Response(body, {
      status: asset ? 200 : 404,
      headers,
    });
  },
};
