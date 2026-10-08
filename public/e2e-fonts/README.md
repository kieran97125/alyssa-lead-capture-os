# Report fixture typography

The guarded `/e2e/report-generator` page pins its Latin and Chinese typography to the application's existing `NotoSansTC-Regular.ttf` and `NotoSansTC-Bold.ttf` assets. Product pages retain their existing typography.

`report-symbols.woff2` supplies the fullwidth punctuation and two Cantonese characters missing from those fonts. Its Unicode range is restricted in the fixture CSS. The font family was renamed to **Report QA Symbols** after subsetting. Its font license and copyright are preserved in the binary and the adjacent `OFL.txt`.

Source: **Noto Sans CJK TC Regular, Version 2.004** (`NotoSansCJKtc-Regular.otf`), Copyright 2014–2021 Adobe, SIL Open Font License 1.1. The source SHA-256 is `dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4`.

The subset keeps `喺嘅／：；，｜～？！（）％－＋［］｛｝` and the source glyphs required to shape them. It was generated using FontTools `pyftsubset` with Brotli, preserving original license/name metadata and then renaming the modified font family. `python scripts/verify-report-fixture-fonts.py` checks both pinned weights plus this supplement cover all printable ASCII and all non-ASCII characters in the generator, fixture, delivery errors and design-test text. This optional artifact check requires `fonttools` and `Brotli`; it adds no application dependency.

Screenshots await `document.fonts.ready`. This makes new fixture baselines independent of Ubuntu/system CJK fallback fonts; live product appearance must still be checked in the normal product browser.
