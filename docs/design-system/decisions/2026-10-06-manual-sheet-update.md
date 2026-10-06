# Manual Lead Sheet update

Opening or filtering the Dashboard displays the last successfully published Lead Sheet snapshot. A Master can explicitly select “跟 Lead Sheet 更新”; the pending label names the ongoing Sheet read. The existing protected form and disabled/pending behavior remain in place.

The Lead panel says “已同步資料” and shows the snapshot's last successful update time. An absent verified snapshot asks the Master to update, rather than presenting zero KPIs. A failed new update retains the prior snapshot and an error message; it never labels saved data as a current Sheet read.

Existing System controls, layout, tokens and focus behavior are retained. Workshop states cover verified empty data, unavailable authority and a retained previous successful update. Evidence and rollback are recorded with the feature release: revert this feature commit to restore prior labels and page read behavior, without reverting the independent arrival authority release.
