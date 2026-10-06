# Bounded staff row read

A fresh production edit took 309.278 seconds: provider sheet-name 56.133s, header 75.364s, row updates 60.159s, commit 58.491s, ownership projection 45.150s. A concurrent edit spent 48.683s in provider name lookup and then failed its 30.060s lock admission. Static durations only; no customer content is exported.

Change: one bounded getValues for the edited rectangle replaces repeated Account/Brand/Created/status/offer/treatment/campaign cell reads. Preserve sparse writes, status date rules, dynamic header resolution, stable source checks, journal, rollback markers, queue binding, all triggers and background work. Exactly two existing functions change and one helper is added; the core commit coordinator is byte identical. Fourteen differential cases yield the same values and sparse writes; scoped journal recovery test passes including interrupted commit.

The bound script has been saved, reloaded and copied back exactly matching the candidate. Twelve native assertions passed in a newly created synthetic workbook, including source preservation, date/time roundtrip, stable sorting/outcome binding, future-outcome rejection and retry deduplication. Native edited-row samples were 393ms (booking status), 236ms (CS ownership) and 226ms (appointment date). These samples exercise the row reader, not full production edit latency.

The separate direct-reference identity-bridge formula was applied after a fresh exact-formula comparison. It replaces twelve dynamic source-field calls with direct INDEX/MATCH references while preserving all current source bounds and guards. All 7,502 output rows were identical immediately before and after. The earlier stale candidate remains review context only; the applied formula preserves an intervening source-row deletion. This establishes installation and behavior, not universal provider latency recovery. Do not clear the known unrelated schedule conflict.

Rollback is fingerprint guarded: reverse change.patch only if the live after hash still matches and no intervening work would be overwritten. Never reset Properties, history, registry or triggers.
