import { createServer } from 'node:http';
import assert from 'node:assert/strict';
process.env.NG_ALLOWED_HOSTS = '127.0.0.1';
process.env.PUBLIC_SITE_ORIGIN = 'https://bringthemhome.example';
const backend = createServer((req, res) => {
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
  console.log('SSR smoke passed: canonical HTML, 301 legacy redirect, 404 and 503 statuses.');
} finally {
  frontend.closeAllConnections();
  frontend.close();
  backend.closeAllConnections();
  backend.close();
}
