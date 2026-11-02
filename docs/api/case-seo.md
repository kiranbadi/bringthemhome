# Canonical missing-person pages

The API remains GET /api/v1/missing-persons/{id}. The browser uses the backend's canonical_path (validated to match the case ID), for example /missing-persons/izaiah-benjamin-alan-moon-nc/{id}. Gallery responses should also include canonical_path for direct canonical links; older responses fall back to ID links, which normalize after loading the detail.

The detail page supplies a unique title, description, canonical link, Open Graph/Twitter metadata, and WebPage/Person/BreadcrumbList JSON-LD. Only public case information is included. Existing discussion and mutation endpoints continue to use the original ID.

## Deploy with crawlable HTML

Use Node 22.22+ (or the version supported by your installed Angular release):

```sh
npm ci
npm run build:ssr
NG_ALLOWED_HOSTS=YOUR_PUBLIC_DOMAIN PUBLIC_SITE_ORIGIN=https://YOUR_PUBLIC_DOMAIN API_ORIGIN=http://127.0.0.1:8000 PORT=4000 npm run serve:ssr
```

NG_ALLOWED_HOSTS must explicitly list the website hostname (comma-separated for multiple hosts); Angular SSR rejects unrecognized Host headers. PUBLIC_SITE_ORIGIN must be the externally visible HTTPS website origin. API_ORIGIN is the backend origin reachable from Node; public detail requests use /api/v1/missing-persons/{id}. Configure environment.production.ts apiUrl separately for browser requests. Reverse-proxy HTTPS traffic to port 4000, including deep links. Do not deploy only dist/bringthemhome/browser when server-rendered SEO is required.

The Node server redirects legacy IDs and outdated slugs to the API's canonical_path with HTTP 301. Valid detail pages return HTML containing public case content and metadata. Missing records return 404, and backend errors return 503 with the retry UI. Other application routes remain client rendered, including account/admin pages. No session cookies are forwarded during the public case prefetch.

The usual npm run build continues to produce the static application. That deployment supports canonical navigation and JavaScript metadata but requires crawler JavaScript execution.

Publish a sitemap containing the current canonical paths from the public case catalog, submit it in Search Console, and allow search engines to fetch public detail pages and application assets. Add your actual domain to the sitemap configuration when deploying. Indexing and rankings are controlled by search engines.

After building SSR, run `npm run test:seo` for an isolated local fixture check of HTML, redirects, and error statuses.

Verify a deployed case without JavaScript:

```sh
curl -i https://YOUR_PUBLIC_DOMAIN/missing-persons/CASE_ID
curl -s https://YOUR_PUBLIC_DOMAIN/missing-persons/PERSON_SLUG/CASE_ID
```

The first request should return 301 with the canonical Location; the second should include the person's name, rel="canonical", and application/ld+json in the response HTML.
