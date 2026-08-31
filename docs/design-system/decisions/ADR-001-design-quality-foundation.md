# ADR-001: Design Quality Foundation

- Date: 2026-08-31
- Status: Accepted for Phase 1
- Issue: #74

## Context

The application already has a strong data and workflow architecture, but UI decisions are distributed across feature files and a large global stylesheet. This allows spacing, control size, radius and visual weight to drift even when functionality is correct.

## Decision

Adopt a layered foundation:

- Base UI for new accessible interaction primitives;
- shadcn/ui base-nova so component source remains owned by the repository;
- Alyssa semantic tokens rather than a generic shadcn theme;
- Storybook as the approved component workshop;
- Playwright visual baselines in a fixed Ubuntu environment;
- axe-core as an automated accessibility gate;
- deny-by-default registry policy;
- system wrappers for product-specific defaults.

## Why base-nova

Nova gives a compact structural baseline suitable for an operational admin product. Alyssa tokens replace its generic colour identity. Luma was not selected because its softer, more spacious geometry would increase the risk of oversized controls in dense workflows.

## Consequences

- New UI work has more setup evidence but less subjective drift.
- Legacy UI remains until touched; broad rewrites are explicitly avoided.
- Generated primitives are not the product API. System components own Alyssa defaults.
- Visual tests require stable Linux snapshots and deliberate approval when changed.
