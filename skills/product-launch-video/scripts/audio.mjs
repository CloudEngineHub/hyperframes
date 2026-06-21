#!/usr/bin/env node
// audio.mjs — product-launch audio pipeline (HeyGen, self-contained). 3 modes:
//
//   (default / no subcommand)  generate  — TTS each spoken SCRIPT.md line → wav +
//        word timings; retrieve a BGM track by mood. Writes audio_meta.json. Runs
//        in the background during Step 4 (parallel with visual design).
//   sync-durations  — write the real voice durations from audio_meta into each
//        frame's `duration` in STORYBOARD.md (real wins; silent frames keep estimate).
//   fetch-sfx       — retrieve each frame's named `sfx` → assets/sfx/; merge the
//        cues into audio_meta.json.
//
// HeyGen REST via ./lib/heygen.mjs — TTS `/v3/voices/speech` (word_timestamps +
// duration in the response, so no separate transcribe pass), sounds `/v3/audio/
// sounds` (retrieval, not generation). Credential = ~/.heygen or $HEYGEN_API_KEY.
//
// TODO (v1 is HeyGen-only): fall back to `hyperframes tts` (Kokoro) + `hyperframes
// transcribe` when no HeyGen credential is present.
//
//   node audio.mjs --script ./SCRIPT.md --storyboard ./STORYBOARD.md --hyperframes . --out ./audio_meta.json
//   node audio.mjs sync-durations --audio-meta ./audio_meta.json --storyboard ./STORYBOARD.md
//   node audio.mjs fetch-sfx --storyboard ./STORYBOARD.md --hyperframes .

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseStoryboard } from "./lib/storyboard.mjs";
import {
  downloadTo,
  heygenAuthHeaders,
  heygenJSON,
  loadEnvFromDir,
  searchSounds,
} from "./lib/heygen.mjs";

const flag = (argv, name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";
const pad2 = (n) => String(n).padStart(2, "0");
const r3 = (x) => Number(x.toFixed(3));

// SCRIPT.md → [{ frame, text }]. Tolerant: a `## … (Frame N)` header opens a
// line; `**key:**` rows are metadata; the indented block is the spoken text
// (the only part fed to TTS — per hyperframes-core script-format.md).
function parseScript(md) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.text.trim()) out.push({ frame: cur.frame, text: cur.text.trim() });
    cur = null;
  };
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{2,3}\s+.*?\(frame\s+(\d+)\)/i);
    if (h) {
      flush();
      cur = { frame: Number(h[1]), text: "" };
      continue;
    }
    if (!cur) continue;
    if (/^\s*\*\*/.test(line)) continue; // **Time:** / **Delivery:** metadata
    const m = line.match(/^(?: {4,}|\t)(.+)$/); // indented spoken text
    if (m) cur.text += (cur.text ? " " : "") + m[1].trim();
  }
  flush();
  return out;
}

// ffmpeg: mp3 bytes → wav 44.1k mono at destWav.
function transcodeToWav(mp3Bytes, destWav, die) {
  const td = mkdtempSync(join(tmpdir(), "pl-audio-"));
  const tmp = join(td, "a.mp3");
  writeFileSync(tmp, mp3Bytes);
  mkdirSync(dirname(destWav), { recursive: true });
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", tmp, "-ar", "44100", "-ac", "1", destWav],
    { stdio: "inherit" },
  );
  rmSync(td, { recursive: true, force: true });
  if (ff.status !== 0 || !existsSync(destWav))
    die("ffmpeg transcode failed (install ffmpeg on PATH)");
}

async function fetchBytes(url, die) {
  const res = await fetch(url);
  if (!res.ok) die(`audio download failed (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// First English public starfish voice, unless --voice pins one.
async function resolveVoice(headers, userVoice, die) {
  if (userVoice) return userVoice;
  const payload = await heygenJSON(`/voices?engine=starfish&type=public&limit=50`, { headers });
  const voices = payload.data ?? payload.voices ?? [];
  const pick = voices.find((v) => v.language === "English") ?? voices[0];
  if (!pick) die("no public starfish voice to default to — pass --voice");
  return pick.voice_id;
}

// ── generate ────────────────────────────────────────────────────────────────
async function runGenerate(argv) {
  const die = (m) => {
    console.error(`✗ audio generate: ${m}`);
    process.exit(1);
  };
  const hyperframesDir = resolve(flag(argv, "hyperframes", "."));
  const storyboardPath = resolve(flag(argv, "storyboard", join(hyperframesDir, "STORYBOARD.md")));
  const scriptPath = resolve(flag(argv, "script", join(hyperframesDir, "SCRIPT.md")));
  const outPath = resolve(flag(argv, "out", join(hyperframesDir, "audio_meta.json")));
  const userVoice = flag(argv, "voice", null);
  const speed = Number(flag(argv, "speed", "1.0")) || 1.0;

  loadEnvFromDir(hyperframesDir);
  let headers;
  try {
    headers = heygenAuthHeaders();
  } catch (e) {
    die(e.message);
  }
  if (!existsSync(storyboardPath)) die(`STORYBOARD.md not found at ${storyboardPath}`);
  const manifest = parseStoryboard(readFileSync(storyboardPath, "utf8"));

  // ── voices (TTS) ──
  const voices = [];
  if (existsSync(scriptPath)) {
    const scriptLines = parseScript(readFileSync(scriptPath, "utf8"));
    if (scriptLines.length) {
      const voiceId = await resolveVoice(headers, userVoice, die);
      console.error(`· voice ${voiceId} · ${scriptLines.length} line(s)`);
      for (const { frame, text } of scriptLines) {
        const payload = await heygenJSON(`/voices/speech`, {
          method: "POST",
          headers,
          body: { text, voice_id: voiceId, speed },
        });
        const inner = payload.data ?? payload;
        if (!inner.audio_url) die(`frame ${frame}: speech response had no audio_url`);
        const rel = `assets/voice/${pad2(frame)}.wav`;
        transcodeToWav(await fetchBytes(inner.audio_url, die), join(hyperframesDir, rel), die);
        const words = Array.isArray(inner.word_timestamps)
          ? inner.word_timestamps
              .filter(
                (w) => w && typeof w.word === "string" && isFinite(w.start) && isFinite(w.end),
              )
              .filter((w) => !/^<.*>$/.test(w.word.trim()))
              .map((w, i) => ({ id: `w${i}`, text: w.word, start: w.start, end: w.end }))
          : [];
        const duration_s =
          typeof inner.duration === "number"
            ? r3(inner.duration)
            : words.length
              ? r3(words[words.length - 1].end)
              : null;
        voices.push({ frame, path: rel, duration_s, words });
        console.error(`  voice f${frame}: ${rel} (${duration_s}s, ${words.length} words)`);
      }
    }
  } else {
    console.error(`· no SCRIPT.md — silent film (BGM only)`);
  }

  // ── BGM (mood retrieval) ──
  let bgm = null;
  const g = manifest.globals;
  const query = (g.extra && g.extra.music) || g.message || g.arc || "calm cinematic underscore";
  try {
    const results = await searchSounds(query, "music", headers, { limit: 5 });
    if (results.length) {
      const top = results[0];
      const rel = `assets/bgm/track.mp3`;
      await downloadTo(top.audio_url, join(hyperframesDir, rel));
      bgm = {
        path: rel,
        volume: voices.length ? 0.8 : 0.9,
        query,
        duration_s: typeof top.duration === "number" ? r3(top.duration) : null,
      };
      console.error(
        `  bgm: ${rel} (query "${query}"${top.score != null ? `, score ${top.score}` : ""})`,
      );
    } else {
      console.error(`  ! no BGM match for "${query}" — skipping`);
    }
  } catch (e) {
    console.error(`  ! BGM search failed: ${e.message} — skipping`);
  }

  const meta = { bgm, voices, sfx: [] };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(meta, null, 2));
  console.log(
    `✓ audio generate: ${voices.length} voice + ${bgm ? "1 bgm" : "no bgm"} → ${outPath}`,
  );
}

// ── sync-durations ────────────────────────────────────────────────────────────
function runSyncDurations(argv) {
  const die = (m) => {
    console.error(`✗ audio sync-durations: ${m}`);
    process.exit(1);
  };
  const hyperframesDir = resolve(flag(argv, "hyperframes", "."));
  const audioMetaPath = resolve(flag(argv, "audio-meta", join(hyperframesDir, "audio_meta.json")));
  const storyboardPath = resolve(flag(argv, "storyboard", join(hyperframesDir, "STORYBOARD.md")));
  if (!existsSync(audioMetaPath)) die(`audio_meta.json not found at ${audioMetaPath}`);
  if (!existsSync(storyboardPath)) die(`STORYBOARD.md not found at ${storyboardPath}`);

  const meta = JSON.parse(readFileSync(audioMetaPath, "utf8"));
  const durByFrame = new Map();
  for (const v of meta.voices ?? []) {
    if (v.frame != null && v.duration_s) durByFrame.set(v.frame, v.duration_s);
  }

  const lines = readFileSync(storyboardPath, "utf8").split(/\r?\n/);
  const FRAME_RE = /^#{2,3}\s+(?:frame|beat|scene)\b.*?(\d+)/i;
  let curFrame = null;
  let updated = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(FRAME_RE);
    if (h) {
      curFrame = Number(h[1]);
      continue;
    }
    if (curFrame != null && durByFrame.has(curFrame)) {
      const m = lines[i].match(/^(\s*[-*]\s+duration\s*:\s*).*/i);
      if (m) {
        lines[i] = `${m[1]}${durByFrame.get(curFrame)}s`;
        durByFrame.delete(curFrame);
        updated++;
      }
    }
  }
  writeFileSync(storyboardPath, lines.join("\n"));
  const missing = [...durByFrame.keys()];
  console.log(
    `✓ audio sync-durations: ${updated} frame duration(s) updated` +
      (missing.length ? ` · no \`- duration:\` line for frame(s) ${missing.join(", ")}` : ""),
  );
}

// ── fetch-sfx ─────────────────────────────────────────────────────────────────
async function runFetchSfx(argv) {
  const die = (m) => {
    console.error(`✗ audio fetch-sfx: ${m}`);
    process.exit(1);
  };
  const hyperframesDir = resolve(flag(argv, "hyperframes", "."));
  const storyboardPath = resolve(flag(argv, "storyboard", join(hyperframesDir, "STORYBOARD.md")));
  const audioMetaPath = resolve(flag(argv, "audio-meta", join(hyperframesDir, "audio_meta.json")));

  loadEnvFromDir(hyperframesDir);
  let headers;
  try {
    headers = heygenAuthHeaders();
  } catch (e) {
    die(e.message);
  }
  if (!existsSync(storyboardPath)) die(`STORYBOARD.md not found at ${storyboardPath}`);
  const manifest = parseStoryboard(readFileSync(storyboardPath, "utf8"));

  const sfx = [];
  const seen = new Set();
  for (const f of manifest.frames) {
    const names = (f.extra?.sfx ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) {
      const key = `${f.number}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        // SFX matches score low — good hits land ~0.52–0.67, below the API's
        // default min_score of 0.7, which silently drops most named cues (only
        // whoosh/swoosh-family hits clear 0.7). Floor it to 0.4 so click/pop/
        // ding/sparkle/notification/impact/etc. resolve. (BGM keeps the default;
        // music scores high.)
        const results = await searchSounds(name, "sound_effects", headers, {
          limit: 3,
          minScore: 0.4,
        });
        if (!results.length) {
          console.error(`  ! no SFX match for "${name}" (frame ${f.number}) — skipped`);
          continue;
        }
        const top = results[0];
        const file = `assets/sfx/${slug(name)}.mp3`;
        await downloadTo(top.audio_url, join(hyperframesDir, file));
        sfx.push({
          frame: f.number,
          file,
          offset_s: 0,
          duration_s: typeof top.duration === "number" ? r3(top.duration) : 1.0,
          volume: 0.35,
        });
        console.error(`  sfx f${f.number}: "${name}" → ${file}`);
      } catch (e) {
        console.error(`  ! SFX "${name}" failed: ${e.message}`);
      }
    }
  }

  const meta = existsSync(audioMetaPath)
    ? JSON.parse(readFileSync(audioMetaPath, "utf8"))
    : { bgm: null, voices: [], sfx: [] };
  meta.sfx = sfx;
  mkdirSync(dirname(audioMetaPath), { recursive: true });
  writeFileSync(audioMetaPath, JSON.stringify(meta, null, 2));
  console.log(`✓ audio fetch-sfx: ${sfx.length} SFX cue(s) → ${audioMetaPath}`);
}

// ── dispatch ──────────────────────────────────────────────────────────────────
const sub = process.argv[2];
if (sub === "sync-durations") runSyncDurations(process.argv.slice(3));
else if (sub === "fetch-sfx") await runFetchSfx(process.argv.slice(3));
else await runGenerate(process.argv.slice(2)); // default: generate
