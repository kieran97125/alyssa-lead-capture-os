import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const form = await readFile(`${root}src/components/alyssa/PublicLeadForm.tsx`, "utf8");
const tests = await readFile(`${root}e2e/public-booking-times.spec.ts`, "utf8");

assert.doesNotMatch(form, /const GOS_BOOKING_TIMES/);
assert.match(form, /<GosTimeField[\s\S]*times=\{standardBookingTimes\}/);
assert.match(form, /function GosTimeField\([\s\S]*times: string\[\]/);
assert.match(form, /\{times\.map\(\(time\) =>/);
assert.match(tests, /GOS weekday booking times follow the live branch opening hours/);
assert.match(tests, /GOS weekend booking times stop before the 19:00 closing time/);

console.log("GOS booking hours contract verified.");
