# Registry Policy

The default policy is deny-by-default.

Only the official shadcn registry is approved, and every install still requires source review. Community registries, visual-effect packs and dashboard blocks are not approved merely because they use the shadcn format.

Before approval, record:

- package and transitive dependencies;
- licence;
- maintenance activity;
- keyboard and accessibility behavior;
- code ownership and update path;
- bundle and runtime impact;
- whether the component preserves Alyssa product direction;
- removal and rollback procedure.

The machine-readable policy is design/registry-allowlist.json.
