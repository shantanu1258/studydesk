import assert from "node:assert/strict";
import test from "node:test";
import { addMonths, monthsBetween } from "../src/utils/format.ts";

test("membership months clamp safely at the end of shorter months", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
});

test("stored exact membership durations can be inferred", () => {
  assert.equal(monthsBetween("2026-01-31", "2026-02-28"), 1);
  assert.equal(monthsBetween("2026-09-08", "2027-09-08"), 12);
});
