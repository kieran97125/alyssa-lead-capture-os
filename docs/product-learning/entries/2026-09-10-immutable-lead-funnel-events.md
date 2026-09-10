# 2026-09-10 — Immutable funnel events

A mutable current-status row cannot serve as historical funnel analytics. Store Lead/Book/Show/No Show as append-only events keyed to a stable Lead identity, while keeping current status separately for operations. During migration, make event-ledger presence opt a Lead into the new model and retain deterministic legacy fallback for rows without events. This prevents later stages from moving or deleting earlier conversion events and keeps daily, treatment, source, campaign, and cost metrics aligned.
