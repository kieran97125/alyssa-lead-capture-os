import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

// This command intentionally requires an explicit approved source file. It never
// retrieves customer reports or includes their original data in the repository.
const SOURCE_SHA256 = "03d0d17c81c0b963128211ba211e5da08209e4d3cadeba76a8c78c7819c656d3";
const VERSION = "cs-ad-series-v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "assets", "report-templates", `${VERSION}.pptx`);
const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/prepare-report-series-template.mjs <approved-source.pptx>");

const NS = {
  drawing: "http://schemas.openxmlformats.org/drawingml/2006/main",
  presentation: "http://schemas.openxmlformats.org/presentationml/2006/main",
  relationship: "http://schemas.openxmlformats.org/package/2006/relationships",
  contentTypes: "http://schemas.openxmlformats.org/package/2006/content-types",
};
const parse = (xml) => new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ""), "application/xml");
const serialize = (document) => new XMLSerializer().serializeToString(document);
const descendants = (element, namespace, name) => Array.from(element.getElementsByTagNameNS(namespace, name));
const directChildren = (element, namespace, name) => Array.from(element.childNodes).filter(
  (node) => node.nodeType === 1 && node.namespaceURI === namespace && node.localName === name,
);
function setText(element, value) {
  const runs = descendants(element, NS.drawing, "t");
  if (!runs.length) {
    if (value) throw new Error("Expected an existing editable text run");
    return;
  }
  runs.forEach((run, index) => { run.textContent = index === 0 ? value : ""; });
}
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const PERIOD_SHAPE = { 1: 38, 2: 185, 3: 196, 4: 55, 5: 66, 6: 76, 7: 89, 8: 102, 9: 115, 10: 125, 11: 135, 12: 145, 13: 155, 14: 165, 15: 175, 16: 207, 17: 218, 18: 228 };
const PAGE_SHAPE = { 2: 186, 3: 197, 4: 56, 5: 67, 6: 77, 7: 90, 8: 103, 9: 116, 10: 126, 11: 136, 12: 146, 13: 156, 14: 166, 15: 176, 16: 208, 17: 219, 18: 229 };
const COVER_METRICS = { 40: "{{lead}}", 42: "{{book}}", 44: "{{show}}", 46: "{{noShow}}" };
const EMPTY_NOTES = new Set([188, 199, 58, 210]);
const STATIC_SHAPES = {
  1: [36, 37, 39, 41, 43, 45, 47],
  2: [183, 184], 3: [194, 195], 4: [53, 54], 5: [64, 65],
  6: [74, 75, 78, 80], 7: [87, 88, 91, 93], 8: [100, 101, 104, 106],
  9: [113, 114], 10: [123, 124], 11: [133, 134], 12: [143, 144],
  13: [153, 154], 14: [163, 164], 15: [173, 174], 16: [205, 206],
  17: [216, 217], 18: [226, 227],
};
const removedPart = (name) => /^(?:docProps\/|ppt\/notesSlides\/|ppt\/notesMasters\/)/.test(name);
const removedRelationship = (element) => {
  const target = element.getAttribute("Target") ?? "";
  const type = element.getAttribute("Type") ?? "";
  return /\/(?:notesSlide|notesMaster|core-properties|extended-properties|custom-properties|thumbnail)$/.test(type)
    || /(?:^|\/)(?:docProps|notesSlides|notesMasters)\//.test(target)
    || element.getAttribute("TargetMode") === "External";
};

const sourceBytes = await fs.readFile(source);
if (digest(sourceBytes) !== SOURCE_SHA256) throw new Error("Source does not match the approved series template");
const zip = await JSZip.loadAsync(sourceBytes);
const sourceParts = new Map();
for (const [name, entry] of Object.entries(zip.files)) {
  if (!entry.dir) sourceParts.set(name, await entry.async("nodebuffer"));
}
const slideParts = Array.from(sourceParts.keys()).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
if (slideParts.length !== 18) throw new Error("Approved template must have 18 slides");

let tableCount = 0;
let dynamicCellCount = 0;
for (const name of slideParts) {
  const slide = Number(name.match(/slide(\d+)\.xml$/)[1]);
  const document = parse(sourceParts.get(name).toString("utf8"));
  for (const shape of descendants(document, NS.presentation, "sp")) {
    const id = Number(descendants(shape, NS.presentation, "cNvPr")[0]?.getAttribute("id"));
    if (id === PERIOD_SHAPE[slide]) setText(shape, "{{period}}");
    else if (id === PAGE_SHAPE[slide]) setText(shape, "{{page}}");
    else if (slide === 1 && id in COVER_METRICS) setText(shape, COVER_METRICS[id]);
    else if (EMPTY_NOTES.has(id)) setText(shape, "");
    else if (!STATIC_SHAPES[slide]?.includes(id)) throw new Error(`Unclassified shape ${slide}:${id}`);
  }
  for (const table of descendants(document, NS.drawing, "tbl")) {
    tableCount += 1;
    const rows = directChildren(table, NS.drawing, "tr");
    rows.slice(1).forEach((row) => {
      for (const cell of directChildren(row, NS.drawing, "tc")) {
        setText(cell, "{{cell}}");
        dynamicCellCount += 1;
      }
    });
  }
  zip.file(name, serialize(document));
}
if (tableCount !== 20) throw new Error("Expected 20 editable tables across the 17 content slides");

for (const name of Object.keys(zip.files)) {
  if (removedPart(name)) zip.remove(name);
}
for (const [name, entry] of Object.entries(zip.files)) {
  if (entry.dir) continue;
  if (name.endsWith(".rels")) {
    const document = parse(await entry.async("string"));
    for (const relationship of descendants(document, NS.relationship, "Relationship")) {
      if (removedRelationship(relationship)) relationship.parentNode.removeChild(relationship);
    }
    zip.file(name, serialize(document));
  }
}
const presentation = parse(await zip.file("ppt/presentation.xml").async("string"));
for (const element of descendants(presentation, NS.presentation, "notesMasterIdLst")) element.parentNode.removeChild(element);
zip.file("ppt/presentation.xml", serialize(presentation));
const types = parse(await zip.file("[Content_Types].xml").async("string"));
for (const override of descendants(types, NS.contentTypes, "Override")) {
  if (removedPart(override.getAttribute("PartName").replace(/^\//, ""))) override.parentNode.removeChild(override);
}
zip.file("[Content_Types].xml", serialize(types));

// Prove text replacement leaves every editable object's geometry, formatting,
// native table structure and paragraph/run structure intact.
function blankDrawingText(xml) {
  const document = parse(xml);
  for (const node of descendants(document, NS.drawing, "t")) node.textContent = "";
  return serialize(document);
}
for (const name of slideParts) {
  const actual = await zip.file(name).async("string");
  if (blankDrawingText(actual) !== blankDrawingText(sourceParts.get(name).toString("utf8"))) {
    throw new Error(`Template geometry or formatting changed in ${name}`);
  }
}
for (const [name, bytes] of sourceParts) {
  if (/^ppt\/(?:fonts|slideMasters|slideLayouts|theme)\//.test(name) && !name.endsWith(".rels")) {
    if (digest(await zip.file(name).async("nodebuffer")) !== digest(bytes)) throw new Error(`Protected template part changed: ${name}`);
  }
}
const forbiddenText = /(?:20\d{2}[.年/\-]|\b\d+(?:,\d{3})*(?:\.\d+)?\b|https?:\/\/|@|\/workspace\/|supabase|beautytrialhk|[0-9]{8})/i;
for (const [name, entry] of Object.entries(zip.files)) {
  if (entry.dir) continue;
  if (removedPart(name)) throw new Error("Private source metadata remains");
  if (name.endsWith(".xml")) {
    const document = parse(await entry.async("string"));
    for (const node of descendants(document, NS.drawing, "t")) {
      if (forbiddenText.test(node.textContent)) throw new Error(`Unapproved source text remains in ${name}`);
    }
  }
}

// Fix archive timestamps to produce a reproducible, reviewable template asset.
for (const entry of Object.values(zip.files)) entry.date = new Date("2000-01-01T00:00:00Z");
const output = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, output);
console.log(JSON.stringify({ version: VERSION, sha256: digest(output), slides: 18, tables: tableCount, dynamicCells: dynamicCellCount, bytes: output.length }));
