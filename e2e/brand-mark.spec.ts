import { expect, test } from "@playwright/test";
import { brandShortCode } from "../src/components/command-center/BrandMark";

test("formal brands have unique and recognizable short codes", () => {
  const shortCodes = [
    brandShortCode("Alyssa"),
    brandShortCode("AM"),
    brandShortCode("Ineffable Beauty"),
    brandShortCode("GOS Beauty"),
  ];

  expect(shortCodes).toEqual(["AL", "AM", "IB", "GOS"]);
  expect(new Set(shortCodes).size).toBe(shortCodes.length);
});

test("unknown brands retain the initials fallback", () => {
  expect(brandShortCode("New Beauty Group")).toBe("NB");
});
