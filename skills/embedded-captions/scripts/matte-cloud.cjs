#!/usr/bin/env node
/*
 * matte-cloud.cjs — cloud subject matte via HeyGen's Background Removal API (the REAL
 * Bria GPU model): POST /v3/assets (upload) → POST/GET /v3/background-removals. Produces
 * the SAME <project>/frames_fg/f_%04d.png (RGBA) as the local hyperframes remove-background
 * path in matte.cjs, so the downstream composite is unchanged. Opt-in via EC_MATTE=cloud;
 * matte.cjs catches any failure here and falls back to the local engine.
 *
 * SELF-CONTAINED REST — no separate `heygen` binary (the skill ships with the `hyperframes`
 * CLI, which does NOT bundle a heygen CLI and whose `remove-background` is local-only). This
 * mirrors the sibling skill's hyperframes-media/scripts/heygen-tts.mjs: a few fetch() calls to
 * api.heygen.com, resolving the SAME credential the hyperframes CLI uses
 * ($HEYGEN_API_KEY → $HYPERFRAMES_API_KEY → ~/.heygen/credentials; `hyperframes auth login`).
 * Exactly like TTS, a HeyGen capability the hyperframes CLI doesn't expose is reached by REST.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const BASE = "https://api.heygen.com";

// --- credential resolution — mirrors heygen-tts.mjs + the hyperframes CLI auth resolver
//     (packages/cli/src/auth). First usable source wins:
//       1. $HEYGEN_API_KEY        → X-Api-Key
//       2. $HYPERFRAMES_API_KEY   → X-Api-Key  (alias)
//       3. ~/.heygen/credentials  (shared with `hyperframes auth login`; $HEYGEN_CONFIG_DIR
//          overrides the dir): oauth (unexpired) → Bearer · else api_key → X-Api-Key ·
//          legacy single-line plaintext key → X-Api-Key
//     Pure resolution (never throws); returns { headers } | { expired:true } | null. ---
function heygenCredential() {
  const envKey = process.env.HEYGEN_API_KEY || process.env.HYPERFRAMES_API_KEY;
  if (envKey) return { headers: { "X-Api-Key": envKey } };

  const file = path.join(
    process.env.HEYGEN_CONFIG_DIR || path.join(os.homedir(), ".heygen"),
    "credentials",
  );
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  if (!raw.startsWith("{")) return { headers: { "X-Api-Key": raw } };

  let cred;
  try {
    cred = JSON.parse(raw);
  } catch {
    return null;
  }
  const oauth = cred.oauth;
  if (oauth?.access_token) {
    const expired = oauth.expires_at && new Date(oauth.expires_at).getTime() - 60_000 < Date.now();
    if (!expired) return { headers: { Authorization: `Bearer ${oauth.access_token}` } };
    if (!cred.api_key) return { expired: true };
  }
  if (cred.api_key) return { headers: { "X-Api-Key": cred.api_key } };
  return null;
}

const CRED_NUDGE =
  "no HeyGen API key. Get one at https://app.heygen.com/settings/api, then either:\n" +
  "           export HEYGEN_API_KEY=<key>   (shared with the hyperframes CLI), or\n" +
  "           run `hyperframes auth login`  (writes ~/.heygen/credentials)";

// Is the cloud matte usable right now? → {ok:true} | {ok:false, code, reason}
function available() {
  const cred = heygenCredential();
  if (cred?.headers) return { ok: true };
  if (cred?.expired)
    return {
      ok: false,
      code: "expired",
      reason:
        "HeyGen OAuth token expired — run `hyperframes auth refresh` (or `hyperframes auth login`)",
    };
  return { ok: false, code: "no-cred", reason: CRED_NUDGE };
}

// One REST call. Auth header injected per-call; the {data:...} envelope is unwrapped.
// multipart (FormData body) sets its own Content-Type/boundary — never override it.
async function api(method, route, { json, body } = {}) {
  const headers = { ...(heygenCredential()?.headers || {}) };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  const res = await fetch(`${BASE}${route}`, { method, headers, body });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON (e.g. an HTML 4xx page) — handled below */
  }
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || text.slice(0, 160);
    throw new Error(`${method} ${route} → HTTP ${res.status}: ${msg}`);
  }
  return data && data.data !== undefined ? data.data : data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Produce <project>/frames_fg/f_%04d.png (RGBA) from the cloud foreground layer.
// async — matte.cjs awaits this; throws on any failure so matte.cjs falls back to local.
async function toFramesFg({ matteSrc, fps, framesFg }) {
  const av = available();
  if (!av.ok) throw new Error(av.reason);

  // 1) upload the (already CFR-normalized) source as a HeyGen asset → asset_id.
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([fs.readFileSync(matteSrc)], { type: "video/mp4" }),
    path.basename(matteSrc),
  );
  const up = await api("POST", "/v3/assets", { body: fd });
  const assetId = up && (up.asset_id || up.id);
  if (!assetId) throw new Error("asset upload returned no asset_id");

  // 2) create the job — foreground layer only (that IS our matte: subject on transparent).
  const created = await api("POST", "/v3/background-removals", {
    json: { video: { type: "asset_id", asset_id: assetId }, layers: ["foreground"] },
  });
  const jobId = created && created.id;
  if (!jobId) throw new Error("background-removal create returned no job id");

  // 3) poll until completed.
  let layers = null;
  for (let i = 0; i < 200; i++) {
    const job = await api("GET", `/v3/background-removals/${jobId}`);
    const status = job && job.status;
    if (status === "completed") {
      layers = job.layers || {};
      break;
    }
    if (status === "failed" || status === "deleted")
      throw new Error(`job ${status}: ${(job && job.error) || "unknown"}`);
    await sleep(3000);
  }
  if (!layers) throw new Error("job did not complete within the poll window");
  const fgUrl = layers.foreground;
  if (!fgUrl) throw new Error("completed job has no `foreground` layer URL");

  // 4) download the foreground webm (VP9 + alpha) → burst to RGBA pngs at the project rate.
  //    -c:v libvpx-vp9 on the INPUT so ffmpeg decodes the alpha plane (yuva420p).
  const webm = path.join(path.dirname(framesFg), "_matte_cloud.webm");
  const dl = await fetch(fgUrl);
  if (!dl.ok) throw new Error(`download foreground layer → HTTP ${dl.status}`);
  fs.writeFileSync(webm, Buffer.from(await dl.arrayBuffer()));
  fs.mkdirSync(framesFg, { recursive: true });
  cp.execFileSync(
    "ffmpeg",
    [
      "-y",
      "-c:v",
      "libvpx-vp9",
      "-i",
      webm,
      "-vf",
      `fps=${fps}`,
      "-pix_fmt",
      "rgba",
      path.join(framesFg, "f_%04d.png"),
    ],
    { stdio: "ignore" },
  );
  fs.rmSync(webm, { force: true });
}

module.exports = { available, toFramesFg };
