import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSeatSections,
  seatCodes,
  seatCountFromSections,
} from "../src/utils/seats.ts";

test("existing seat count and prefix become one compatible section", () => {
  assert.deepEqual(normalizeSeatSections(undefined, 3, "Q"), [
    { id: "main-section", name: "Main section", prefix: "Q", start: 1, end: 3 },
  ]);
});

test("continuous section ranges generate the requested seat codes", () => {
  const sections = [
    { id: "a", name: "Section A", prefix: "A", start: 1, end: 20 },
    { id: "b", name: "Section B", prefix: "B", start: 21, end: 40 },
  ];
  const seats = seatCodes({ seatSections: sections });

  assert.equal(seats[0], "A-01");
  assert.equal(seats[19], "A-20");
  assert.equal(seats[20], "B-21");
  assert.equal(seats.at(-1), "B-40");
  assert.equal(seatCountFromSections(sections), 40);
});
