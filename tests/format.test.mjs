import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  isWithinLast30Days,
  monthsBetween,
} from "../src/utils/format.ts";

test("membership months clamp safely at the end of shorter months", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
});

test("stored exact membership durations can be inferred", () => {
  assert.equal(monthsBetween("2026-01-31", "2026-02-28"), 1);
  assert.equal(monthsBetween("2026-09-08", "2027-09-08"), 12);
});

test("recent activity includes the 30-day boundary across month changes", () => {
  const now = new Date(2026, 9, 12, 15, 0);
  const boundary = new Date(now);
  boundary.setDate(boundary.getDate() - 30);
  assert.equal(isWithinLast30Days(boundary.toISOString(), now), true);
  assert.equal(
    isWithinLast30Days(new Date(boundary.getTime() - 1).toISOString(), now),
    false,
  );
  assert.equal(isWithinLast30Days(now.toISOString(), now), true);
  assert.equal(
    isWithinLast30Days(new Date(now.getTime() + 1).toISOString(), now),
    false,
  );
  assert.equal(isWithinLast30Days("invalid", now), false);
});

test("recent activity remains available at the start of a new year", () => {
  const now = new Date(2027, 0, 1, 12);
  assert.equal(
    isWithinLast30Days(new Date(2026, 11, 15, 12).toISOString(), now),
    true,
  );
  assert.equal(
    isWithinLast30Days(new Date(2026, 10, 30, 12).toISOString(), now),
    false,
  );
});
