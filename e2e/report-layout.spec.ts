import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractText } from "unpdf";

// Compare actual exported pages, rather than an HTML imitation of their tables.
// No browser process or authenticated application is needed for these fixtures.
test("Main and KOL exported-page visual baselines and PDF continuation", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const directory = mkdtempSync(path.join(os.tmpdir(), "kol-report-layout-"));
  try {
    execFileSync(process.execPath, ["scripts/report-kol-visual-fixture.mjs", directory], { timeout: 60_000 });
    const converted = path.join(directory, "converted"); mkdirSync(converted);
    // Pin font substitution to the repository's shipped font files. Host OS
    // fallbacks must not silently change wrapping between local and CI renders.
    const fontConfig = path.join(directory, "fonts.conf");
    const fontDirectory = path.resolve("public/report-assets/fonts").replaceAll("&", "&amp;");
    writeFileSync(fontConfig, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDirectory}</dir><cachedir>${directory}/font-cache</cachedir><alias><family>Arial</family><prefer><family>Noto Sans TC</family></prefer></alias></fontconfig>`);
    execFileSync("soffice", [`-env:UserInstallation=file://${directory}/office-profile`, "--headless", "--convert-to", "pdf", "--outdir", converted, path.join(directory, "normal.pptx")], { timeout: 60_000, env: { ...process.env, FONTCONFIG_FILE: fontConfig } });
    const png = (pdf: string, page: number, name: string) => {
      const prefix = path.join(directory, name);
      execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-scale-to-x", "1440", "-scale-to-y", "810", "-singlefile", "-png", pdf, prefix], { timeout: 30_000 });
      return readFileSync(prefix + ".png");
    };
    for (const [format, file] of [["pdf", path.join(directory, "normal.pdf")], ["pptx", path.join(converted, "normal.pdf")]]) {
      const result = await extractText(new Uint8Array(readFileSync(file)), { mergePages: false });
      for (const [section, title] of [["main", "Alyssa Main 分組成效"], ["kol", "KOL成效"]]) {
        const page = result.text.findIndex(text => text.replace(/\s/g, "").includes(title.replace(/\s/g, ""))) + 1;
        expect(page).toBeGreaterThan(0);
        const image = png(file, page, `${format}-${section}`);
        await testInfo.attach(`${format}-${section}`, { body: image, contentType: "image/png" });
        expect(image).toMatchSnapshot(`${format}-${section}.png`);
      }
    }
    const stressFile = path.join(directory, "stress.pdf");
    const stress = await extractText(new Uint8Array(readFileSync(stressFile)), { mergePages: false });
    const kolPages = stress.text.map((text, index) => ({ text, index })).filter(page => page.text.replace(/\s/g, "").includes("KOL成效"));
    expect(kolPages.length).toBeGreaterThan(1);
    const text = kolPages.map(page => page.text).join("");
    expect(text.replace(/\s/g, "")).toContain("完結標記");
    expect(text.match(/7,777/g)).toHaveLength(1);
    expect(text.match(/療程標記/g)).toHaveLength(1);
    for (const page of [kolPages[0], kolPages.at(-1)!]) {
      const name = page === kolPages[0] ? "pdf-continuation-first" : "pdf-continuation-last";
      const image = png(stressFile, page.index + 1, name);
      await testInfo.attach(name, { body: image, contentType: "image/png" });
      expect(image).toMatchSnapshot(`${name}.png`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
