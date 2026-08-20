import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("calendar day overflow stays capped behind a more control", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/components/command-center/MarketingCalendarBoard.tsx"),
    "utf8"
  );

  expect(source).toContain("const MAX_VISIBLE_ITEMS_PER_DAY = 3");
  expect(source).toContain("items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY)");
  expect(source).toContain("items.slice(MAX_VISIBLE_ITEMS_PER_DAY)");
  expect(source).toContain("calendar-more-button");
  expect(source).toContain("calendar-more-preview");
});
