import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

for (const [name, script] of [
  ["bounded staff row reads preserve operational fields", "scripts/test-edited-account-batch.mjs"],
  ["current pending appointment authority and independent dimensions", "scripts/test-lead-pending-authority.mjs"],
  ["saved snapshot encryption, authority, permissions and unavailable data", "scripts/test-manual-lead-dashboard.mjs"],
  ["manual sync publication and scheduled source exclusion", "scripts/test-manual-lead-sync.mjs"],
  ["bounded Google gateway remains confined to explicit synchronization", "scripts/test-dashboard-google-read.mjs"],
]) {
  test(name, () => {
    // Actual workflow Node runtime; scripts replace provider/DB access with
    // synthetic fixtures and reject network requests. No production credentials.
    const output = execFileSync(process.execPath, [script], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20_000,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
    });
    expect(output).toContain("PASS:");
  });
}
