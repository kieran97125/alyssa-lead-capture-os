# Component Rules

## Ownership layers

- src/components/ui: generated or reviewed primitives. Avoid product-specific copy and business logic.
- src/components/system: Alyssa defaults, density, status language and composition.
- feature folders: business behavior assembled from System components.

## Mandatory rules

1. Search Storybook before creating a new control.
2. Do not create a second Button, Dialog, Toggle, Table or Empty State contract in a feature folder.
3. Do not install a third-party registry unless it is added to the allowlist after code, license and dependency review.
4. Do not use raw hex colours in System components.
5. Do not use arbitrary pixel values for recurring control height, radius or spacing.
6. Every shared component requires a story.
7. Every meaningful UI change requires visual evidence at desktop and mobile where relevant.
8. Accessibility automation must pass; manual keyboard and focus review remains required.
9. Loading, empty, error, disabled and permission-denied states are part of the component contract.
10. Product direction must stay Alyssa-specific; avoid generic dashboard blocks and chatbot-wrapper layouts.
