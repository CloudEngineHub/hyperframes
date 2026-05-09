import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const cwd = process.cwd();
mkdirSync("renders", { recursive: true });
mkdirSync("snapshots", { recursive: true });
const server = spawn("./node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", "5188"], {
  cwd,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (d) => {
  logs += d.toString();
});
server.stderr.on("data", (d) => {
  logs += d.toString();
});
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
for (let i = 0; i < 80 && !logs.includes("517") && !logs.includes("5188"); i++) await wait(250);
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://127.0.0.1:5188", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => window.EF_RENDER?.isReady?.(), { timeout: 15000 });
  for (const ms of [1200, 5000, 8500, 9400]) {
    await page.evaluate(async (timeMs) => {
      const tg = document.querySelector("ef-timegroup");
      await tg.seek(timeMs);
    }, ms);
    await page.screenshot({ path: `snapshots/editframe-${ms}ms.png` });
  }
  const support = await page.evaluate(async () => {
    const codecs = [
      ["avc", "avc1.640028"],
      ["vp9", "vp09.00.10.08"],
      ["vp8", "vp8"],
      ["av1", "av01.0.05M.08"],
    ];
    const out = [];
    for (const [name, codec] of codecs) {
      try {
        const result = await VideoEncoder.isConfigSupported({
          codec,
          width: 1920,
          height: 1080,
          bitrate: 8000000,
          framerate: 30,
        });
        out.push({ name, codec, supported: result.supported });
      } catch (error) {
        out.push({ name, codec, supported: false, error: String(error?.message || error) });
      }
    }
    return out;
  });
  writeFileSync("renders/webcodecs-support.json", JSON.stringify(support, null, 2));
  const chunks = [];
  await page.exposeFunction("onRenderChunk", (chunk) => {
    chunks.push(Buffer.from(chunk.data));
  });
  const start = Date.now();
  let renderError = null;
  try {
    await page.evaluate(async () => {
      await window.EF_RENDER.renderStreaming({ fps: 30, codec: "vp9", includeAudio: false });
    });
  } catch (error) {
    renderError = String(error?.message || error);
  }
  const elapsedMs = Date.now() - start;
  writeFileSync(
    "renders/render-vp9-result.json",
    JSON.stringify(
      {
        elapsedMs,
        chunks: chunks.length,
        bytes: chunks.reduce((n, b) => n + b.length, 0),
        renderError,
      },
      null,
      2,
    ),
  );
  if (!renderError && chunks.length > 0)
    writeFileSync("renders/editframe-browser-vp9.mp4", Buffer.concat(chunks));
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGTERM");
}
