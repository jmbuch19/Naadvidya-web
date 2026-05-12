// Slug helpers — used for teacher profile URLs (/teachers/[slug]).

export function toSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'guru';
}

// Append a short random suffix if the base slug is already taken.
// Returns a slug guaranteed unique by checking via the provided `exists` function.
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = toSlug(base);
  if (!(await exists(baseSlug))) return baseSlug;

  for (let i = 0; i < 6; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${baseSlug}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely fallthrough
  return `${baseSlug}-${Date.now().toString(36)}`;
}
