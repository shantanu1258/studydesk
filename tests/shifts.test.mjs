import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DAILY_SHIFT,
  DEFAULT_SHIFTS,
} from "../src/config/constants.ts";
import {
  labelConfiguredShifts,
  memberOccupiesShift,
  normalizeShifts,
  presetShift,
  shiftsOverlap,
} from "../src/utils/shifts.ts";

test("missing preferences fall back to the default shifts", () => {
  assert.deepEqual(normalizeShifts(), DEFAULT_SHIFTS);
});

test("adjacent timed shifts do not overlap", () => {
  assert.equal(shiftsOverlap(DEFAULT_SHIFTS, "Morning", "Evening"), false);
});

test("the default Daily plan runs from 7 AM to 11 PM", () => {
  assert.equal(DEFAULT_DAILY_SHIFT.start, "07:00");
  assert.equal(DEFAULT_DAILY_SHIFT.end, "23:00");
});

test("the Full Day shift overlaps each timed shift", () => {
  assert.equal(shiftsOverlap(DEFAULT_SHIFTS, "Full Day", "Morning"), true);
  assert.equal(shiftsOverlap(DEFAULT_SHIFTS, "Evening", "Full Day"), true);
});

test("seat occupancy follows configured shift timings", () => {
  const member = { active: true, shift: "Morning" };
  assert.equal(memberOccupiesShift(member, "Morning", DEFAULT_SHIFTS), true);
  assert.equal(memberOccupiesShift(member, "Evening", DEFAULT_SHIFTS), false);
});

test("a Full Day member occupies the seat in Morning and Evening", () => {
  const member = { active: true, shift: "Full Day" };
  assert.equal(memberOccupiesShift(member, "Morning", DEFAULT_SHIFTS), true);
  assert.equal(memberOccupiesShift(member, "Evening", DEFAULT_SHIFTS), true);
});

test("a blank all-day plan still overlaps every timed shift", () => {
  const shifts = [
    ...DEFAULT_SHIFTS,
    { id: "always", name: "Always", start: "", end: "" },
  ];
  assert.equal(shiftsOverlap(shifts, "Always", "Morning"), true);
  assert.equal(shiftsOverlap(shifts, "Evening", "Always"), true);
});

test("multiple hourly plans receive stable numbered labels with their timing", () => {
  const shifts = labelConfiguredShifts([
    presetShift("Hour", "hour-one"),
    { ...presetShift("Hour", "hour-two"), start: "09:00", end: "10:00" },
  ]);

  assert.equal(shifts[0].name, "Hour 1 (08:00–09:00)");
  assert.equal(shifts[1].name, "Hour 2 (09:00–10:00)");
});
