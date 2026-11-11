# Connected resources in the private work galaxy

The operator supplied a design root and confirmed management workbooks as the workbench's source boundary. A planet URL alone did not satisfy the need to find all related work. The new resource library makes membership, provider freshness and incomplete coverage visible without filling the canvas with file nodes.

## Experience

- The existing System & Resources view now has an indexed library, planet/source/type filters, literal Chinese filename/path/content search, folder navigation and pagination.
- Planet inspection shows related files and an explicit route to the full scoped library. A user can turn a selected file into a Job with the original link and related planets; saving uses the existing revision/undo path.
- Sources can be added from a Drive URL, mapped to multiple existing planets and paused/re-enabled. Existing Drive organization and sharing are not mutated.
- Loading, empty, failed-read, pending-index and provider access states are distinct. Prior visible results survive a transient read failure. Source completeness is never inferred from an uploaded link.

## Data and scheduling

Three service-only RLS tables separate source configuration, canonical owner/file identity, and many-source/path memberships. A file can belong to several sources and planets but appears once per search result. Folder-specific bindings inherit down the ancestor chain. Explicit configured name terms support mixed-brand folders; Latin word boundaries prevent accidental substring matches. Ambiguous files retain their parent source mapping rather than inventing a brand.

Initial and periodic reconciliation traverse all provider pages and nested folders. Every bounded invocation checkpoints a durable queue. A 90-second database lease and token-checked atomic commit prevent overlapping workers from changing newer progress. Stale memberships are marked inactive only when traversal is complete; they can be rediscovered. Orphaned cached text is cleared without deleting source records. Missing child-folder permission becomes explicit partial coverage; loss of a root hides its memberships. Network failures preserve cursor and prior data.

Metadata changes invalidate old text by version. Transient downloads, timeouts and provider quota/5xx responses retain pending text for a later attempt. Export denial is verified against metadata access before hiding a file; restored access requeues unchanged text. Native Docs/Slides, plain text and bounded text PDFs can be searched. Management Sheets remain metadata-only: operational customer rows are not duplicated into this index. Videos/images/Office archives retain type, name, path and original link. Scans are not claimed as OCR. Content is bounded to 60,000 characters and PDFs to 6 MB / 100 pages; truncation and unavailable text have visible states.

Sources become due 15 minutes after completion. An authenticated scheduled worker continues due batches independently of an open browser; the library also continues queued work while visible. This is reconciliation, not an instantaneous Drive event promise. The existing Google OAuth grant already includes Drive access. The worker reuses it without changing scopes, and does not change shared connection health on a resource-only failure. A dedicated scheduler secret does not authorize interactive workbench reads.

## Dependencies and contracts

`google-auth-library`, Supabase JS, Base UI Dialog, SystemButton and Lucide already exist and are reused. Pinned MIT `unpdf@2.1.0` adds server-side PDF text extraction with byte/page limits; it is dynamically imported. No browser PDF renderer, remote UI registry or additional workflow service is installed. Postgres `pg_trgm` supports literal Chinese substring search; no external search account or model endpoint is introduced.

Thumbnails are owner-checked, authenticated server reads from allowlisted Google hosts and returned with private/no-store headers. Neither Google bearer tokens nor temporary thumbnail URLs enter the application document or browser payload. Indexed text is untrusted plain text, never executable instructions or HTML.

## Verification and release

Local TypeScript, model/worker qualification, design contract and workshop build are required. `supabase/tests/workbench_resources.sql` runs against isolated PostgreSQL in CI and in a rollback-only installed-schema qualification. It covers lease exclusion, missing/expired/stale commits, owner/node isolation, canonical deduplication, literal wildcards, Chinese content search, metadata-only membership isolation, completed-generation pruning and denied public/browser roles. Hosted Chromium exercises desktop/mobile visuals, axe, filtering, add/pause, file-to-Job and existing graph/recovery/role flows. Authoring-only baseline recording is removed before normal comparison qualification and release.

Runtime acceptance must verify the configured root and management files through the application's Google grant, terminal coverage/status counts, background receipts and original-record preservation. Production source IDs, client folder mappings and scheduler credentials stay outside this public repository.

## Rollback

Revert the feature commit and disable only its scheduled worker. Existing graph/Jobs, Drive files, reporting sources and OAuth grants remain independent. Retain the private index tables for recovery or remove them after a separately reviewed backup/retention decision.
