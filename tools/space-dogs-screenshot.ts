import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .scriptName("space-dogs-debug")
  .usage("$0 [options]")
  .options({
    url: {
      type: "string",
      default: "http://localhost:3000/space-dogs/asset-debug",
      describe: "Base URL for the asset debug page.",
    },
    asset: {
      type: "string",
      default: "large_asteroid_small_moon_1k.glb",
      describe: "Asset filename to load (relative to the public asset root).",
    },
    scale: {
      type: "number",
      default: 1,
      describe: "Uniform scale applied to the loaded asset.",
    },
    rotX: {
      type: "number",
      default: 0,
      describe: "Rotation around X axis in degrees.",
    },
    rotY: {
      type: "number",
      default: 0,
      describe: "Rotation around Y axis in degrees.",
    },
    rotZ: {
      type: "number",
      default: 0,
      describe: "Rotation around Z axis in degrees.",
    },
    width: {
      type: "number",
      default: 1600,
      describe: "Viewport width in pixels.",
    },
    height: {
      type: "number",
      default: 900,
      describe: "Viewport height in pixels.",
    },
    out: {
      type: "string",
      default: "space-dogs-debug.png",
      describe: "Output filename (stored under the local artifacts directory).",
    },
    delay: {
      type: "number",
      default: 2000,
      describe: "Delay (ms) before capturing to allow assets to load.",
    },
    screenshot: {
      type: "boolean",
      default: false,
      describe: "Capture a full-page screenshot and exit.",
    },
    headless: {
      type: "boolean",
      default: false,
      describe: "Run Chromium without a visible window.",
    },
  })
  .strict()
  .help()
  .parseSync();

const {
  url,
  asset,
  scale,
  rotX,
  rotY,
  rotZ,
  width,
  height,
  out,
  delay,
  screenshot,
  headless,
} = argv;

const OUTPUT_DIR = path.resolve("artifacts/screenshots");
const resolveOutputPath = (filename: string): string => {
  const safeName = path.basename(filename);
  return path.join(OUTPUT_DIR, safeName);
};

const run = async () => {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width, height } });

  try {
    const target = new URL(url);
    target.searchParams.set("asset", asset);
    target.searchParams.set("scale", String(scale));
    target.searchParams.set("rotX", String(rotX));
    target.searchParams.set("rotY", String(rotY));
    target.searchParams.set("rotZ", String(rotZ));
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { state: "attached" });

    if (screenshot) {
      if (delay > 0) {
        await page.waitForTimeout(delay);
      }
      const outputPath = resolveOutputPath(out);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await page.screenshot({ path: outputPath, fullPage: true });
    } else {
      await new Promise<void>((resolve) => {
        browser.on("disconnected", () => resolve());
      });
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
