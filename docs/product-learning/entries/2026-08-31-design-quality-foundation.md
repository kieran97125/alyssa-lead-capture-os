# Design Quality Foundation as a reusable Growth OS capability

- Date: 2026-08-31
- Source issue: Alyssa #74
- Classification: Core + Configurable + Alyssa-only styling

## Learning

A flagship operational product needs a design-quality architecture, not only a component library. The reusable Core is the layered contract: owned primitives, semantic tokens, isolated stories, deterministic visual evidence, accessibility automation, agent rules and rollback documentation.

## Core

- deny-by-default registry policy;
- primitive / system / feature ownership layers;
- Storybook build gate;
- fixed-environment Playwright visual regression;
- axe automation;
- change log, ADR and rollback map.

## Configurable

- component base and style;
- density scale;
- semantic token values;
- screenshot viewports and thresholds;
- required UI states.

## Alyssa-only

- plum, rose, blush and champagne brand values;
- Alyssa wording and examples;
- current admin navigation and business terminology.

## Guardrail

Do not copy Alyssa visual tokens into Growth OS Core. Export the architecture and configuration schema only.
