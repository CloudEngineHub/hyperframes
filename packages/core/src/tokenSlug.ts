/**
 * THE slug for composition-variable ids → CSS custom-property names. Shared
 * by the figma importer (emits `var(--<slug>, literal)`) and the runtime
 * (defines `--<slug>` from declared variables) — one function so the two
 * sides can never drift. The slug is lossy (case-folded, symbol runs
 * collapse to "-"), so distinct ids CAN collide; callers surface
 * detectSlugCollisions() as a warning rather than silently merging.
 */

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "node";
}

export function cssVariableName(id: string): string {
  return `--${slugify(id)}`;
}

/** Groups of distinct ids that collapse to the same CSS variable name. */
export function detectSlugCollisions(ids: Iterable<string>): string[][] {
  const bySlug = new Map<string, string[]>();
  for (const id of ids) {
    const slug = cssVariableName(id);
    const group = bySlug.get(slug);
    if (group) {
      if (!group.includes(id)) group.push(id);
    } else {
      bySlug.set(slug, [id]);
    }
  }
  return [...bySlug.values()].filter((g) => g.length > 1);
}
