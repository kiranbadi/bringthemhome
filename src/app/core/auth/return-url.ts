/** Only explicit local workflow destinations can override the established post-login dashboard. */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || /[\\\r\n]/.test(value)) return null;
  return /^\/missing-persons\/(?:[^/?#]+\/)?[^/?#]+(?:#case-claims)?$/.test(value) ||
    value === '/admin/case-claims' ||
    value === '/missing-person-report'
    ? value
    : null;
}
