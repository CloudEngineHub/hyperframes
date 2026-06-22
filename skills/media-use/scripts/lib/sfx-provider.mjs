import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SFX_DIR = join(SKILL_DIR, "hyperframes-media", "assets", "sfx");
const MANIFEST_PATH = join(SFX_DIR, "manifest.json");

let manifest = null;

function loadManifest() {
  if (manifest) return manifest;
  if (!existsSync(MANIFEST_PATH)) return {};
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  return manifest;
}

function findMatch(intent) {
  const m = loadManifest();
  const lower = intent.toLowerCase();

  // exact key match
  if (m[lower]) return { key: lower, ...m[lower] };

  // substring match in key or description
  for (const [key, entry] of Object.entries(m)) {
    if (key.includes(lower) || lower.includes(key)) return { key, ...entry };
    if (entry.description?.toLowerCase().includes(lower)) return { key, ...entry };
  }

  // word overlap
  const words = lower.split(/\s+/);
  for (const [key, entry] of Object.entries(m)) {
    const desc = (key + " " + (entry.description || "")).toLowerCase();
    if (words.some((w) => w.length > 2 && desc.includes(w))) return { key, ...entry };
  }

  return null;
}

export const sfxProvider = {
  async search(intent) {
    const match = findMatch(intent);
    if (!match) return null;
    const filePath = join(SFX_DIR, match.file);
    if (!existsSync(filePath)) return null;
    return {
      localPath: filePath,
      source: "search",
      ext: ".mp3",
      metadata: {
        description: match.description || match.key,
        duration: match.duration,
        provider: "bundled_sfx",
        provenance: { library_key: match.key },
      },
    };
  },
};
