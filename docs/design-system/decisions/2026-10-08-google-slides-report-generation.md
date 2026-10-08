# Report generation delivers native Google Slides

- Date: 2026-10-08
- Status: Implemented; live delivery requires the company's explicit Google consent
- Product: Alyssa CS / AD reporting

## Behavior

Google Slides is the default output. The generator uses the approved series deck, imports its editable PPTX into the configured report folder as a native Google Slides presentation, then exposes the verified Google Slides link. It does not download a PPTX. Legacy API callers asking for PPTX follow this same delivery path.

The fixed series already includes its brand and treatment sections. Slides mode hides the optional comparison and breakdown controls, and sends `comparison=false` and `breakdowns=[]`. PDF and text retain their existing controls and delivery behavior.

The primary submit, copy and open actions reuse `SystemButton`. Loading disables submission; a ref also rejects duplicate submits before React re-renders. Success exposes an observed Google link. Authorization and delivery errors stay beside the form without offering a hidden download fallback. Narrow screens retain the same control order.

## Google authorization

Normal Sheets connection remains Sheets-only. The Master-only report connection action requests Sheets and Drive scopes in an explicit Google consent screen. Signed OAuth state carries the request purpose through the callback. Login after an expired session or a Master-required redirect returns report connections to `/reports` and Sheets connections to `/data-sources`. Only approved returned scopes are stored. A declined Drive grant or a report missing its required scope leaves an existing Sheets connection intact.

An existing target folder requires Drive access. This implementation uses explicit full Drive consent because a `drive.file` grant requires a Picker folder grant and the app has no Picker configuration. The connection action describes Google's requested file access before redirecting to Google. The delivery code only writes into the configured folder and never changes sharing.

## Delivery checks

Before uploading, the server checks the configured folder's type, trash state and `canAddChildren` capability. Uploads above 5,000,000 bytes use one resumable session; smaller decks use multipart import. Session URLs must remain on the exact HTTPS Drive upload origin and path before receiving credentials or bytes. Creation is never automatically retried.

After upload, the server reads the created file and checks its native presentation MIME type, exact generated name, configured parent, trash state and observed Google Slides URL. Names use Hong Kong's generation date and the report's start/end dates. Request cancellation and time budgets propagate through OAuth and all Drive calls. An uncertain write asks the operator to check the folder before another generation.

## Evidence

- `scripts/test-google-slides-delivery.mjs`: native conversion, multipart and large resumable import, HKT naming, metadata verification, malicious session rejection, request cancellation, no duplicate creation and permission-protected JSON response.
- `scripts/test-google-report-oauth.mjs`: Sheets-only default consent, explicit report consent, signed purpose, PKCE, scope allowlist, encrypted credentials, declined-grant isolation, Master-only start/callback and Master-only reconnect after token expiry.
- `ReportGeneratorForm.stories.tsx`: default Slides and restricted brand composition.
- `e2e/design-quality.spec.ts`: fixed-date desktop/mobile screenshots, native link success without browser download, keyboard submission and actionable failure; automated WCAG A/AA check.
- `e2e/report-export.spec.ts`: retained PDF/text delivery and selectable breakdown controls.
- The report fixture pins Latin/CJK typography with scoped local `@font-face` declarations and a 9,456-byte OFL supplement for missing punctuation/Cantonese glyphs. `scripts/verify-report-fixture-fonts.py` confirms 311 required glyphs across both weights. The fixture CSS does not match product pages; screenshots wait for `document.fonts.ready`.
- Final `npm run build`, `npm run verify:design-system-contract`, and `npm run build:storybook` passed. The build includes report rendering/data contracts and both Google delivery/OAuth suites.
- The four report baselines were regenerated after pinning local fonts, visually reviewed, and replayed without Fontconfig overrides. The final combined desktop/mobile report and PDF/text run passed **4 tests** (including authentication setup): `npx playwright test e2e/design-quality.spec.ts e2e/report-export.spec.ts --config /workspace/scratch/57e7b0863b98/qa-browser-runtime/playwright.config.ts --grep 'Google Slides|supports composable'`. The temporary config only selects an available browser and starts the already-built app; it is outside the repository.

Local full-suite run with fallback Chromium 149.0.7827.0: **9 passed, 6 failed**. The six failures compare unrelated appointment/settings/design-foundation snapshots against a different system font/browser environment (2–6% pixel differences). Those baselines remain unchanged. New report typography is now pinned to local assets for reproducible baselines; the official Ubuntu/Chromium CI remains the authority for the complete visual gate. Local browser acquisition required a scratch-only Chromium package because the Playwright CDN download returned a truncated archive. No runtime/configuration override or extra browser dependency is part of the repository.

Official PR #125 CI at `c3a8aa9`: **Design Quality Gate** and **Alyssa CRM Playwright** both passed, including the complete visual gate in the standard environment.

Live verification must confirm a native presentation in the configured folder with the application's authorized Google identity. Connector folder visibility alone does not prove application OAuth access.

## Product learning

Classification: **Configurable**. Approved presentation rendering, scoped snapshot construction, native artifact conversion and verified delivery links are reusable. The folder, template, report grouping, business identity and Google connection remain client-specific. This implementation must be abstracted and reviewed before inclusion in Growth OS Core.

Canonical learning was published in the private source repository: [entries/2026-10-08-approved-editable-report-template.md at ec5fb328](https://github.com/kieran97125/leadhub-source-os/blob/ec5fb32827845bd7b0b662c58b450a42f474e07f/entries/2026-10-08-approved-editable-report-template.md).

## Rollback

Revert the report delivery UI/API/helper and the report-specific OAuth changes together. Keep historical immutable report snapshots. Revert only the new report visual baselines; leave unrelated design screenshots intact. No database migration is required because snapshot storage records the underlying PPTX artifact format. Rollback cannot revoke a Google scope already granted by a user; Google account access must be managed separately by that account holder.
