"""Verify QA font glyph coverage. Requires fonttools and Brotli for WOFF2."""

from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    "src/components/reports/ReportGeneratorForm.tsx",
    "src/app/e2e/report-generator/page.tsx",
    "src/lib/reports/googleSlides.ts",
    "e2e/design-quality.spec.ts",
]
required = set(range(32, 127)) | {
    ord(character)
    for source in SOURCES
    for character in (ROOT / source).read_text()
    if ord(character) >= 128
}
supplement = set(TTFont(ROOT / "public/e2e-fonts/report-symbols.woff2").getBestCmap())
for weight in ["Regular", "Bold"]:
    main = ROOT / f"public/report-assets/fonts/NotoSansTC-{weight}.ttf"
    missing = required - set(TTFont(main).getBestCmap()) - supplement
    assert not missing, f"{weight}: missing glyphs {''.join(chr(code) for code in sorted(missing))}"
    print(f"PASS: {weight} report fixture font covers {len(required)} required glyphs.")
