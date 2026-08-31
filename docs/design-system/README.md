# Alyssa Growth OS Design Quality Layer

## Purpose

This layer reduces subjective UI drift by making design decisions reusable, testable and reviewable. It does not replace product judgement; it creates constraints so every new screen begins from an approved foundation.

## Architecture

1. **Base UI** supplies accessible interaction primitives.
2. **shadcn/ui base-nova** places owned component source in this repository.
3. **Alyssa semantic tokens** define brand, density, radius, elevation and control hierarchy.
4. **System components** wrap primitives with Alyssa product rules.
5. **Storybook** exposes approved states in isolation.
6. **Playwright screenshots** detect visual drift in a fixed Linux environment.
7. **axe-core** blocks automatically detectable WCAG A/AA regressions.
8. **Agent rules and registry allowlist** prevent uncontrolled component imports.

## Commands

- npm run storybook
- npm run build:storybook
- npm run verify:design-system-contract
- npm run test:design
- npm run test:design:update
- npm run design:ci

## Adding a component

1. Confirm the product need and check existing System components.
2. Review official shadcn documentation and registry source.
3. Add only the required primitive with the shadcn CLI.
4. Wrap it under src/components/system when product-level defaults are needed.
5. Add stories for normal, compact, disabled, loading, empty and error states as relevant.
6. Add or update deterministic screenshots.
7. Run the design contract, Storybook build, visual test and axe test.
8. Record the decision in CHANGELOG.md and an ADR when the architecture changes.

## Current boundary

Foundation v1 does not rewrite legacy pages. New work should use the new layer; touched legacy surfaces should be migrated deliberately instead of through broad cosmetic replacements.
