import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260720000100_create_demand_signals.sql";
const tables = [
  "demand_signal_taxonomy",
  "demand_signals",
  "demand_signal_source_refs",
  "demand_signal_assets",
  "demand_signal_asset_links",
];

test("Demand Signal tables are server-only and protected by RLS", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

  for (const table of tables) {
    expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toContain(`alter table public.${table} force row level security`);
    expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
    expect(sql).toContain(`grant all on table public.${table} to service_role`);
  }
});

test("form question is opt-in and source lineage is idempotent", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

  expect(sql).toContain(
    "demand_signal_question_enabled boolean not null default false"
  );
  expect(sql).toContain("unique (brand_id, source_type, source_record_id)");
});

test("migration has no external Kairvo or network dependency", async () => {
  const sql = await readFile(migrationPath, "utf8");

  expect(sql).not.toMatch(/https?:\/\//i);
  expect(sql).not.toMatch(/create\s+foreign\s+data\s+wrapper/i);
  expect(sql).not.toMatch(/create extension.*http/i);
});
