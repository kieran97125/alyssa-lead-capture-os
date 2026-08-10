import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const expectedPngs = [
  ["src/app/apple-icon.png", 180, 180],
  ["public/icons/growth-os-192.png", 192, 192],
  ["public/icons/growth-os-512.png", 512, 512],
  ["public/icons/growth-os-maskable-512.png", 512, 512],
];

for (const [path, expectedWidth, expectedHeight] of expectedPngs) {
  const buffer = await readFile(`${root}${path}`);
  assert.equal(buffer.toString("hex", 0, 8), "89504e470d0a1a0a", `${path} must be a PNG`);
  assert.equal(buffer.readUInt32BE(16), expectedWidth, `${path} width must match its metadata`);
  assert.equal(buffer.readUInt32BE(20), expectedHeight, `${path} height must match its metadata`);
}

const favicon = await readFile(`${root}src/app/favicon.ico`);
assert.equal(favicon.readUInt16LE(0), 0, "favicon must use the ICO reserved header");
assert.equal(favicon.readUInt16LE(2), 1, "favicon must be an icon resource");
assert.ok(favicon.readUInt16LE(4) >= 3, "favicon must include multiple raster sizes");

await access(`${root}src/app/icon.svg`);
const icon = await readFile(`${root}src/app/icon.svg`, "utf8");
const manifest = await readFile(`${root}src/app/manifest.ts`, "utf8");
const layout = await readFile(`${root}src/app/layout.tsx`, "utf8");

assert.match(icon, />GO<\/text>/, "the browser icon must retain the recognizable GO monogram");
assert.match(icon, /#5a2348/, "the icon must use the Growth OS primary color");
assert.match(manifest, /short_name: "Growth OS"/);
assert.match(manifest, /purpose: "maskable"/);
assert.match(manifest, /start_url: "\/dashboard"/);
assert.match(layout, /applicationName: "Alyssa Growth OS"/);
assert.match(layout, /themeColor: "#5a2348"/);

console.log("Growth OS favicon, install icon, and manifest contracts verified.");
