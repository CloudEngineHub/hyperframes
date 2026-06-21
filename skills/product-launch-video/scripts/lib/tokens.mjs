// tokens.mjs — shared brand-token parsing + semantic role mapping for frame.md /
// FRAME.md. Used by build-frame.mjs (remix a preset onto brand tokens) and
// captions.mjs (derive caption colors from frame.md). One mapping → frames and
// captions stay consistent. Pure node.

// Collect `key: value` pairs under the top-level `colors:` block (until dedent).
export function parseColors(md) {
  const out = [];
  let inBlock = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^colors:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break; // dedent to a top-level key → end of block
    const m = line.match(
      /^\s+([\w-]+):\s*["']?(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[^"'#\s][^"'\n]*?)["']?\s*$/,
    );
    if (m) out.push([m[1], m[2].trim()]);
  }
  return out;
}

// relative luminance of a #rrggbb (null for non-hex like rgba()).
export function lum(v) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(v).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

// chroma (max−min channel) of a #rrggbb — a cheap "how colorful" proxy; −1 for non-hex.
export function chroma(v) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(v).trim());
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

// Map a list of [key, value] colors to semantic roles. ink = a dark/ink-named
// color (else darkest); canvas = a paper/cream/white-named color (else lightest);
// accents = whatever's left, ranked by chroma (the loudest color is almost always
// the brand accent). For an unkeyed brand list, pass synthetic keys — name matching
// simply no-ops and it falls back to luminance/chroma, which is what we want.
export function semanticColors(colors) {
  if (!colors.length) return {};
  const named = (re) => colors.find(([k]) => re.test(k));
  const hexes = colors.filter(([, v]) => lum(v) != null);
  const byLum = [...hexes].sort((a, b) => (lum(a[1]) ?? 1e9) - (lum(b[1]) ?? 1e9));
  const pick = (m, fallback) => (m ? m[1] : fallback ? fallback[1] : undefined);
  // "ink" must be a whole word-segment so "soft-pink"/"pink" don't match it.
  const ink = pick(
    named(/(?:^|[-_])ink(?:[-_]|$)|black|charcoal|^text(?:-dark)?$|outline|noir/i),
    byLum[0] ?? colors[0],
  );
  const canvas = pick(
    named(/cream|paper|canvas|white|bg|ground|surface|base|sand|parchment|off-?white|bone/i),
    byLum[byLum.length - 1] ?? colors[colors.length - 1],
  );
  const accents = colors
    .filter(([, v]) => v !== ink && v !== canvas)
    .sort((a, b) => chroma(b[1]) - chroma(a[1]))
    .map(([, v]) => v);
  return { ink, canvas, accent: accents[0] ?? ink, accent2: accents[1] ?? accents[0] ?? ink };
}

// Collect role→fontFamily under the top-level `typography:` block; pick a display
// + body family from the usual role names. Returns quoted families (or null).
export function parseFonts(md) {
  const roles = {};
  let inBlock = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^typography:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break;
    const m = line.match(/^\s+([\w-]+):\s*\{[^}]*fontFamily:\s*"([^"]+)"/);
    if (m) roles[m[1]] = m[2];
  }
  const q = (s) => (s ? `"${s}"` : null);
  const body = roles.body ?? roles.subtitle ?? Object.values(roles)[0];
  const display =
    roles.display ??
    roles.headline ??
    roles["card-headline"] ??
    roles["section-headline"] ??
    roles["quote-display"] ??
    body;
  return { display: q(display), body: q(body) };
}
