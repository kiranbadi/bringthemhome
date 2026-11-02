/** Public URL only; API operations always retain the opaque document ID. */
export function casePath(person: {
  _id: string;
  canonical_path?: string | null;
  slug?: string | null;
}): string {
  const fallback = `/missing-persons/${encodeURIComponent(person._id)}`;
  const candidate = person.canonical_path;
  if (!candidate || /[\\?#\s\u0000-\u001f]/.test(candidate)) return fallback;
  const parts = candidate.split('/');
  if (parts.length !== 4 || parts[0] !== '' || parts[1] !== 'missing-persons') return fallback;
  try {
    const slug = decodeURIComponent(parts[2]);
    if (
      !slug ||
      slug === '.' ||
      slug === '..' ||
      /[\\/#?]/.test(slug) ||
      decodeURIComponent(parts[3]) !== person._id
    )
      return fallback;
  } catch {
    return fallback;
  }
  return candidate;
}
