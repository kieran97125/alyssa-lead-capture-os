# Arrival registry authority — approved recovery

Reconstructed from the approved contract on upstream
`90eb31d16c4557427940b8581ffdfaf4c30f44da` after the transient workspace
removed the unpublished review branch. This is a new reviewed commit, not a
claim that the old unpublished commit was recovered.

## Scope

- Managed profile reads lead rows and versioned `_funnel_metrics` in one request.
- Exact schema and identity coverage required before dashboard filtering,
  audit-baseline capture or reporting writes. Provider/body reads are bounded.
- Override only Show/No Show dates from the arrival registry projection.
  Lead=Created At; Book=最後更新日期; no registered-date replacement.
- Preserve legacy callers, permissions, branding, treatment ownership and
  pending booking behavior. Incoherent data renders unavailable, not zero.
- Two-cell Sheet producer change eliminates legacy source-status arrival
  fallback. The version header is derived from the installed formula prefix.
- The separate capture timing patch records static phase names and durations;
  it changes no lock, retry, deduplication or customer-data behavior.

No dependency, environment, migration, CI hook or Trigger.dev change. No old
paused App/Sheet patches or fast-check/Zod review scope is included.

## Verified locally (Node 24.19.0)

- Registry authority/gateway behavioral tests: pass, including 10 malformed
  projection cases, exact coverage, no-phone identities, metadata-only rows,
  source date preservation, future confirmed dates and ignored-abort timeout.
- Existing read-only Google dashboard and streaming regression scripts: pass.
- 12 differential capture scenarios: pass (service calls, lock, append,
  cursor, backoff, exceptions, log failures and no PII in phase logs).
- Next build and all 14 existing contract checks: pass.
- Storybook build and design contract: pass.
- Full tsc: same five known baseline e2e diagnostics; no new diagnostics.
- Focused visual/axe and hosted gates: pending at initial publication.

## Exact producer / instrumentation checks

SHA256 of formula strings, without a terminal newline:

- Existing A2: `7a3db9d7c5425a4d95d0d5301b6bf351389853375835009295cbe1673c280a1a`
- Registry-only A2: `f0a20864612ebd381445a4e6323de5a0e05a41d610b5a01ec3b858a8936e8881`
- Dynamic A1: `168e780d754e305b4adcac136f1b7f051c3118a28cde11e6f2753a682aa69d4c`
- Live bound code before timing: `d16a41e3f2ec7e056886bd472195f641f6ef3e5978f121637b1f2a014513447d`
- Live bound code saved/read back after timing: `f78dc612a87c6f0a645cd2fce92ae0196220b81b2447d5b14e6c4fbdf54ad99f`

## Activation and rollback

User approved publication, hosted gates, coordinated activation and timing.
Do not activate the App/Sheet authority cutover until gates and fresh source
checks succeed. Read the current two producer cells again before replacement;
abort if fingerprints changed. Apply only A1/A2 atomically, preserving all
formatting/validation. Verify no formula errors and full source coverage,
then use the existing protected reporting sync. Never write facts directly or
bypass its lock. Save deployment and before/after aggregate receipts.

Rollback the App release and A1/A2 together (A1=`Identity`, A2 from
formula-before.txt), then run protected reporting reconciliation. Reverse the
timing patch only if its exact after fingerprint remains current. No customer
rows or arrival records are deleted, and no triggers are removed or stopped.

Native Spreadsheet service timeouts remain under investigation. Short timer
completion is not proof of successful work: it can mean busy/backoff. Staff
editing recovery and live App/Sheet parity remain explicit acceptance gates.
