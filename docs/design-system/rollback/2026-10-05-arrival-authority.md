# Arrival authority availability

The managed lead dashboard must not present a failed or unverified arrival
projection as zero customers. Reuse DashboardRegionState and SystemButton;
preserve the requested filter values in the retry link. Verified empty data
still renders the usual zero metrics, separate from unavailable data.

Evidence: focused authority/gateway and capture differential scripts, Next
build contract checks, Storybook Unavailable/VerifiedEmpty, desktop/mobile
screenshots and axe checks. Release-specific results are recorded in
release-evidence/arrival-registry-v1/README.md.

Rollback is coordinated: restore the prior App release and the two saved
_funnel_metrics producer cells, then run the existing protected reporting sync.
Never delete source customer rows, reset identity bridges, change permissions,
or bypass sync locks. The static capture timing patch can be reversed
independently against its exact saved hash; no trigger replacement is needed.
