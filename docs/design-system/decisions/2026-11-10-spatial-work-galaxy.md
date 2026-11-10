# Spatial work galaxy

## Trigger and product direction

The operator reported that the first graph felt flat, its crossing lines were difficult to follow, and the canvas was too narrow. The observed production arrangement also extended vertically, forcing fit-to-view to shrink planets and labels.

The main view now presents an interactive three-dimensional galaxy. A deterministic horizontal constellation layout groups brands, workstreams and connected collaborators/resources. Lit, textured spheres, thin orbital curves, a layered starfield and perspective establish depth. Labels remain DOM controls with stable readable type; geometry carries the spatial effect. The graph does not add perpetual decorative animation.

The canvas uses the full available page width. The inspector is initially closed and floats over the scene on selection. A dedicated focus mode uses the full viewport and exits with Escape; covered navigation is inert, keyboard focus stays in the visible workspace and is restored on exit. Existing Jobs and source views remain available below/outside the scene.

## Interaction and persistence

- Rotate empty space, zoom, select planets, and move planets on the camera-facing plane. Keyboard arrows also adjust a focused planet.
- Related curves are shown by default; an explicit switch reveals the remaining graph with lower visual emphasis. Relations can still be added/edited through the inspector.
- The existing React Flow editor remains available as `2D 編排`. Its routes use direction-appropriate handles and straight segments rather than long backtracking curves.
- Optional `Planet.space` coordinates are validated finite, bounded values in the existing v1 document. Absent coordinates use the new presentation layout; existing 2D positions and business records are preserved. Explicit 3D moves, arrange and undo use the existing private autosave/revision/draft-recovery path.
- Arrange clears spatial overrides and places the 2D graph in the same horizontal grouping, as one undoable edit.
- WebGL failure falls back to the fully editable 2D scene with a visible explanation. It does not block Jobs or data access.

## Dependency and component review

Pinned runtime additions: `three@0.187.0`, `@react-three/fiber@9.8.2`, and `@react-three/drei@10.7.9`, all MIT. `@types/three@0.187.0` is development-only. Three supplies geometry/materials/WebGL; Fiber owns React scene lifecycle and demand rendering; Drei supplies maintained camera controls and screen-space-width curves. Labels remain in the application React root and are projected from the camera without per-frame React state updates. This adds 48 resolved packages. No remote component registry, postprocessing pack, external textures, CDN fonts or analytics are introduced.

Both 3D and 2D renderers are lazy-loaded. The 3D scene renders on demand, caps pixel ratio at 1.5, uses deterministic geometry/stars, and disposes resources on unmount. No client credentials, data-source permissions or access policy change.

Existing SystemButton, existing dialogs and feature-scoped semantic variables remain the control system. Dark scene controls inherit scene foreground instead of the surrounding plum page text. Shared System contracts and global brand tokens are unchanged.

## Verification

TypeScript, the owner/model checks, production build, Storybook and design contract are required. Hosted qualification records and then normally compares updated desktop/mobile baselines, exercises actual WebGL rendering, 3D coordinate reload/undo, full viewport focus, optional inspector, 2D editing and unsupported-WebGL fallback.

The cloud preview browser has WebGL disabled; its full-width 2D fallback and focus interaction were visually inspected. Actual 3D evidence comes from the isolated GitHub CI runner using Chromium's documented software WebGL mode. Its SwiftShader flags apply only to CI test browsers with fixture data and blank database credentials, not the user's browser or production security settings.

Initial hosted qualification exposed a missing central label managed in an independent projected DOM root. The label layer now stays in the application React root. Portrait fitting uses the real canvas aspect ratio. Narrow screens expand vertical layout spacing while preserving spherical geometry and canonical coordinates; secondary captions collapse until selected or keyboard-focused. Relation curves follow planet drags in the render loop, and sphere clicks/drag completion cannot activate underlying relation editors. Final screenshot review, CI and release evidence belong in the PR. Product-learning export must record the user's original dissatisfaction and distinguish visual qualification from sustained usage evidence.

## Rollback

Revert this feature commit and dependency/lockfile additions. The service-only document and optional spatial coordinates may remain for recovery; no private Jobs, notes, source bindings or data rows are deleted. The previous client safely ignores the additive spatial field.
