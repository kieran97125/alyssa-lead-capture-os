# Campaign-derived landing copy and public event authority

- Date: 2026-11-16
- Scope: public campaign copy and visitor telemetry validation; no operational records or page versions are rewritten.

## Behavior

Public landing pages derive fallback brand, treatment, branch and price text from the connected campaign context. The generic renderer no longer advertises a fixed brand, location, treatment, price or first-visit eligibility. Existing explicitly authored hero, introduction, badge and CTA content takes precedence. Explicit zero/invalid promotional prices use enquiry copy rather than advertising a different original price. Both form-image layouts and the quick registration CTA consume the same copy helper.

The public events endpoint accepts a deliberately limited set of visitor telemetry events. Successful persisted registration, CRM, appointment, payment and arrival outcomes remain server-owned. Anonymous requests cannot attach lead, contact or source-snapshot foreign keys. The existing browser redirect no longer sends duplicate registration-success telemetry after the server has already recorded the success.

The boundary uses the repository's pinned Zod runtime schema, a streamed request-byte limit, a payload-byte limit and bounded nesting/strings/collections. Browser records are explicitly marked as public telemetry. These events are untrusted engagement evidence, not confirmed conversions. The separate thank-you and lead-submission routes retain their existing contracts.

## Verification

- `node scripts/test-public-landing-copy.mjs` renders the real landing route against isolated campaign configurations for four brands, different prices and both image layouts; checks for cross-brand/price/location leakage and retained authored copy.
- `node scripts/test-public-events-boundary.mjs` exercises the real route with an isolated storage adapter; rejects forbidden outcomes and database references before admin access, rejects malformed/oversized streamed JSON, and preserves accepted browser events, no-op and failure behavior.
- Shared component appearance, spacing, focus and interaction remain unchanged. No second visual component contract is introduced. Full design-system, Storybook and visual gates are run by the release owner.

## Rollback

Revert the public copy helper/wiring, event validator/route and the matching browser duplicate-success removal together. No database or customer-data rollback is needed. Restoring the prior public event route reopens the authority boundary and must be explicitly reviewed.
