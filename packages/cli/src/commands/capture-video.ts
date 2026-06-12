import { defineCommand } from "citty";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { c } from "../ui/colors.js";
import type { Example } from "./_examples.js";

export const examples: Example[] = [
  ["Download the hero video (index 0) from a captured project's manifest", "capture-video ./my-project --index 0"],
  ["Download a specific video by exact URL", "capture-video ./my-project --url https://cdn.example.com/hero.mp4"],
  ["List entries in the manifest without downloading", "capture-video ./my-project --list"],
];

/**
 * The capture pipeline writes capture/extracted/video-manifest.json listing
 * every <video> element on the source page (URL, dimensions, heading, caption,
 * preview PNG) but deliberately does NOT download the mp4s — sites with
 * dozens of feature videos would balloon the capture size to hundreds of MB.
 *
 * This command lets agents pull just the ONE video a beat needs (e.g.
 * heygen.com's "Orb" hero animation at index 0) on demand. The downloaded
 * file lands at capture/assets/videos/<filename-from-manifest> so beat
 * compositions can reference it as `capture/assets/videos/<filename>` —
 * same pattern as the captured SVGs and rasters.
 */
async function fetchToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} for ${url}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

function safeFilename(name: string): string {
  // Manifest filenames sometimes carry URL-encoded chars (e.g.
  // "Frame-2147227325%20(1).mp4"). Decode and replace anything that
  // could be hostile on disk while keeping the extension intact.
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  return decoded.replace(/[^A-Za-z0-9._-]+/g, "_");
}

export default defineCommand({
  meta: {
    name: "capture-video",
    description:
      "Download a video referenced in capture/extracted/video-manifest.json (on-demand; the capture pipeline only writes the manifest + preview PNGs)",
  },
  args: {
    project: {
      type: "positional",
      description: "Path to the captured project directory",
      required: true,
    },
    index: {
      type: "string",
      description: "Manifest entry index to download (0-based)",
    },
    url: {
      type: "string",
      description: "Exact video URL to download (must match a manifest entry)",
    },
    list: {
      type: "boolean",
      description: "List manifest entries (index, dimensions, heading) and exit",
    },
  },
  async run({ args }) {
    const projectDir = resolve(String(args.project));
    const manifestPath = join(projectDir, "capture", "extracted", "video-manifest.json");
    if (!existsSync(manifestPath)) {
      console.error(
        `${c.error("✗")} no video-manifest.json at ${manifestPath}\n` +
          `  Was this directory produced by \`hyperframes capture\`?`,
      );
      process.exitCode = 1;
      return;
    }
    type Entry = {
      index: number;
      url: string;
      filename: string;
      width: number;
      height: number;
      heading: string;
      caption: string;
      ariaLabel: string;
      preview: string;
    };
    let manifest: Entry[];
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    } catch (e) {
      console.error(`${c.error("✗")} video-manifest.json is malformed: ${(e as Error).message}`);
      process.exitCode = 1;
      return;
    }

    if (args.list) {
      if (manifest.length === 0) {
        console.log(c.dim("(manifest is empty — no <video> elements on the captured page)"));
        return;
      }
      console.log(`${manifest.length} video entr${manifest.length === 1 ? "y" : "ies"} in ${manifestPath}:`);
      for (const e of manifest) {
        console.log(
          `  ${c.bold(`[${e.index}]`)} ${e.filename} — ${e.width}×${e.height}` +
            (e.heading ? `\n      heading: "${e.heading}"` : "") +
            `\n      url: ${e.url}`,
        );
      }
      return;
    }

    let entry: Entry;
    if (args.index != null) {
      const i = Number(args.index);
      if (!Number.isInteger(i) || i < 0 || i >= manifest.length) {
        console.error(
          `${c.error("✗")} --index ${args.index} out of range (manifest has ${manifest.length} entries; valid: 0..${manifest.length - 1})`,
        );
        process.exitCode = 1;
        return;
      }
      entry = manifest[i]!;
    } else if (args.url != null) {
      const found = manifest.find((e) => e.url === args.url);
      if (!found) {
        console.error(
          `${c.error("✗")} no manifest entry with url=${args.url}\n` +
            `  Run with --list to see what's available.`,
        );
        process.exitCode = 1;
        return;
      }
      entry = found;
    } else {
      console.error(
        `${c.error("✗")} specify --index <N> or --url <URL> (or --list to see what's in the manifest)`,
      );
      process.exitCode = 1;
      return;
    }

    const outDir = join(projectDir, "capture", "assets", "videos");
    mkdirSync(outDir, { recursive: true });
    const fname = safeFilename(entry.filename || basename(entry.url));
    const outPath = join(outDir, fname);
    const relPath = `capture/assets/videos/${fname}`;

    if (existsSync(outPath)) {
      console.log(`${c.warn("⚠")}  already downloaded: ${relPath} (skipping)`);
      console.log(`     Delete the file and re-run to refetch.`);
      return;
    }

    console.log(`${c.accent("▸")} downloading [${entry.index}] ${entry.filename} (${entry.width}×${entry.height})`);
    console.log(`     from: ${entry.url}`);
    try {
      const buf = await fetchToBuffer(entry.url);
      writeFileSync(outPath, buf);
      const sizeKb = Math.round(buf.length / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)}MB` : `${sizeKb}KB`;
      console.log(`${c.success("◇")}  wrote ${relPath} (${sizeStr})`);
      console.log(
        `     Reference it from a beat composition as:\n` +
          `       <video src="${relPath}" data-start="0" data-duration="${entry.width === entry.height ? 5 : 4}" data-track-index="0" autoplay muted loop></video>`,
      );
    } catch (e) {
      console.error(`${c.error("✗")} download failed: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  },
});
