# Lead Sheet update for every colleague

Every authenticated colleague who can open Dashboard or Performance can use the
existing Lead Sheet update form, including viewer, designer and CS roles. The
server action retains the normal session and module checks and records the real
operator identity. Source configuration, Google credentials and other Master-only
actions retain their existing permissions. Dashboard reads remain brand scoped.

The existing button styling, keyboard behavior, pending/disabled states and
last-success timestamp remain. The unavailable-data story now directs the
current colleague to the button. The workshop includes enabled and unavailable
source states. No new component contract or design token is introduced.

The all-role action test exercises the real server action for all seven roles,
unauthenticated/denied callers and protected source administration. Existing
sync and saved-snapshot tests retain exact ownership, previous good snapshots
and brand filtering. Release evidence records the production source validation.

Rollback: revert this permission/UI commit. For the independent native Account
transfer recovery, remove the helper call in oa2ProcessAccount_ and retain the
journaled repaired registry; no Lead/Book/Show dates are changed by the transfer.
