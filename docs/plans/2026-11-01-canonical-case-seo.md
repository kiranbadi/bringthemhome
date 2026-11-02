# Canonical Case URLs and SEO

Use backend canonical_path as the public URL, validated against the document ID and local detail route. Preserve old links and all backend IDs. Add optional public-case SSR while keeping the existing static build available. Never render private claimant/admin state into public HTML.

1. Test and implement canonical path helpers; extend shared models.
2. Add slug/ID route and canonical normalization; update gallery/share/discussion/admin case links and login return destinations.
3. Add public metadata (title, description, canonical, social, WebPage/Breadcrumb structured data), and noindex error states with cleanup on navigation.
4. Add matching Angular SSR dependencies and opt-in server build, public case-only rendering, safe HTML redirects/statuses and public HTTP transfer cache.
5. Verify routing/API compatibility, metadata, SSR HTML with a local fixture API, full tests and both builds. Document deployment prerequisites and sitemap generation from canonical backend case paths.
