# Bounded staff row read

A fresh production edit took 309.278 seconds: provider sheet-name 56.133s, header 75.364s, row updates 60.159s, commit 58.491s, ownership projection 45.150s. A concurrent edit spent 48.683s in provider name lookup and then failed its 30.060s lock admission. Static durations only; no customer content is exported.

Change: one bounded getValues for the edited rectangle replaces repeated Account/Brand/Created/status/offer/treatment/campaign cell reads. Preserve sparse writes, status date rules, dynamic header resolution, stable source checks, journal, rollback markers, queue binding, all triggers and background work. Exactly two existing functions change and one helper is added; the core commit coordinator is byte identical. Fourteen differential cases yield the same values and sparse writes; scoped journal recovery test passes including interrupted commit.

The bound script has been saved, reloaded and copied back exactly matching the candidate. This establishes installation and behavior, not universal provider latency recovery. A separate direct-reference identity-bridge candidate is unapplied because fresh connector reads timed out. Never claim the latter was released or clear the known unrelated schedule conflict.

Rollback is fingerprint guarded: reverse change.patch only if the live after hash still matches and no intervening work would be overwritten. Never reset Properties, history, registry or triggers.
