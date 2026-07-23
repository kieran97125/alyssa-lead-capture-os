# Demand Signals rollout

## Scope

Demand Signals is implemented natively inside Alyssa LaunchHub and CRM. Kairvo was used only as a product reference. There is no Kairvo API, database, identifier, link, foreign table, or runtime dependency.

The module captures explicit first-party customer wording from:

- inbound WhatsApp messages selected by a CRM user;
- an optional per-form question;
- manual CRM/LaunchHub entry.

Every signal is brand-scoped, keeps auditable source lineage, and starts in a human-review workflow. Creative Brief, FAQ, Ad Hook, Offer Idea, Landing Page Message, and System Card outputs are local drafts only. Nothing is auto-published.

## Existing treatment and form coverage

- All existing active treatments and forms appear in the Demand Signals filters and manual-capture selectors through the current LaunchHub configuration.
- Existing forms remain unchanged after the migration because the question is disabled by default.
- Enabling the question is a per-form setting and does not change its token or require replacement Wix embed code.
- New answers link to the existing lead, contact, form, and treatment, then inherit booking/show/payment/revenue outcomes from the existing CRM data.
- Existing historical leads are not automatically mined or backfilled. This avoids inventing signals from old free text without review.

## Production gate

Do not enable production capture until all of the following are complete:

1. Merge only after GitHub Actions and Vercel Preview pass.
2. Apply `20260720000100_create_demand_signals.sql` to the production Supabase project.
3. Verify all five tables have RLS enabled and forced, `anon`/`authenticated` have no table grants, and `service_role` has the required grants.
4. Open the module and verify real brands, treatments, and forms load without fixture mode.
5. Capture one inbound WhatsApp message, review it, and create a draft; confirm no content is published.
6. Enable the optional question on one low-risk pilot form, submit an end-to-end test, and confirm the lead, booking request, UTM snapshot, CRM case, and source lineage are unchanged and linked correctly.
7. Keep the question optional initially and compare form conversion before considering a required field.

## Rollback

- Disable the question on any form immediately; existing form and lead capture continue normally.
- Roll back the application release if needed. The five additive tables can remain without affecting existing LaunchHub or CRM workflows.
- Do not drop captured evidence during a rollback unless a separate reviewed data-retention decision authorizes it.
