import { createServer } from 'node:http';
import assert from 'node:assert/strict';
process.env.NG_ALLOWED_HOSTS = '127.0.0.1';
process.env.PUBLIC_SITE_ORIGIN = 'https://bringthemhome.example';
const backend = createServer(async (req, res) => {
  if (req.url.startsWith('/bringthemhome/')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Set-Cookie', ['session=example; HttpOnly', 'csrf=example']);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      url: req.url,
      method: req.method,
      cookie: req.headers.cookie,
      csrf: req.headers['x-csrf-token'],
      origin: req.headers.origin,
      body: Buffer.concat(chunks).toString(),
    }));
    return;
  }
  if (req.url.endsWith('/gone')) {
    res.writeHead(404).end();
    return;
  }
  if (req.url.endsWith('/down')) {
    res.writeHead(503).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      _id: 'case-1',
      full_name: 'JANE DOE',
      canonical_path: '/missing-persons/jane-doe-nc/case-1',
      missing_from_state: 'NC',
      agency: 'County Police',
    }),
  );
});
await new Promise((r) => backend.listen(0, '127.0.0.1', r));
process.env.API_ORIGIN = `http://127.0.0.1:${backend.address().port}`;
const { reqHandler } = await import(
  new URL('../dist/bringthemhome/server/server.mjs', import.meta.url)
);
const frontend = createServer(reqHandler);
await new Promise((r) => frontend.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${frontend.address().port}`;
try {
  const api = await fetch(origin + '/api/v1/missing-persons?page_size=1');
  assert.equal(api.status, 200);
  assert.equal((await api.json())._id, 'case-1');
  const uploadPath = '/bringthemhome/api/v2/person-reports/media/upload?draft=1';
  const body = '--media\r\nContent-Disposition: form-data; name="file"\r\n\r\nimage\r\n--media--\r\n';
  const upload = await fetch(origin + uploadPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=media',
      Cookie: 'session=example',
      'X-CSRF-Token': 'example',
      Origin: origin,
    },
    body,
  });
  assert.equal(upload.status, 201);
  assert.deepEqual(upload.headers.getSetCookie(), ['session=example; HttpOnly', 'csrf=example']);
  assert.deepEqual(await upload.json(), {
    url: uploadPath, method: 'POST', cookie: 'session=example', csrf: 'example', origin, body,
  });
  const legacy = await fetch(origin + '/missing-persons/case-1', { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/missing-persons/jane-doe-nc/case-1');
  const canonical = await fetch(origin + '/missing-persons/jane-doe-nc/case-1');
  const html = await canonical.text();
  assert.equal(canonical.status, 200);
  assert.match(html, /<title>Jane Doe/);
  assert.match(html, /rel="canonical"[^>]*https:\/\/bringthemhome.example/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<h1[^>]*>Jane Doe/);
  assert.match(html, /County Police/);
  for (const [id, status] of [
    ['gone', 404],
    ['down', 503],
  ]) {
    const r = await fetch(origin + '/missing-persons/' + id);
    assert.equal(r.status, status);
    assert.match(await r.text(), /noindex,follow/);
  }
  const discussion = await fetch(origin + '/missing-persons/case-1/discussions');
  assert.equal(discussion.status, 200);
  assert.doesNotMatch(await discussion.text(), /<title>Jane Doe/);
  console.log('SSR smoke passed: API forwarding, canonical HTML, redirects, and error statuses.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  frontend.closeAllConnections();
  frontend.close();
  backend.closeAllConnections();
  backend.close();
}
