import assert from "node:assert/strict";
import test from "node:test";
import {
  earningsForMonth,
  earningsForPeriod,
  earningsPeriodRange,
} from "../src/utils/earnings.ts";

const fees = [
  { date: "2025-12-31", amount: 1000 },
  { date: "2026-09-30", amount: 2000 },
  { date: "2026-10-01", amount: 3000 },
  { date: "2026-10-12", amount: 4000 },
  { date: "2026-11-01", amount: 5000 },
];
const expenses = [
  { date: "2024-12-31", amount: 100 },
  { date: "2026-09-30", amount: 200 },
  { date: "2026-10-01", amount: 300 },
  { date: "2026-10-12", amount: 400 },
  { date: "2026-11-01", amount: 500 },
];

test("year/month selections cover full calendar months, years, and all time", () => {
  assert.deepEqual(earningsPeriodRange("2026", "10"), [
    "2026-10-01",
    "2026-10-31",
  ]);
  assert.deepEqual(earningsPeriodRange("2026", "02"), [
    "2026-02-01",
    "2026-02-28",
  ]);
  assert.deepEqual(earningsPeriodRange("2028", "02"), [
    "2028-02-01",
    "2028-02-29",
  ]);
  assert.deepEqual(earningsPeriodRange("2026", "all"), [
    "2026-01-01",
    "2026-12-31",
  ]);
  assert.deepEqual(earningsPeriodRange("all", "all"), ["", ""]);
});

test("all-time earnings subtract all maintenance, including expense-only years", () => {
  const result = earningsForPeriod(fees, expenses);
  assert.equal(result.feeIncome, 15000);
  assert.equal(result.maintenancePaid, 1500);
  assert.equal(result.netEarnings, 13500);
  assert.deepEqual(result.payments, fees);
  assert.deepEqual(result.expenses, expenses);
});

test("collections and maintenance share inclusive custom period boundaries", () => {
  const result = earningsForPeriod(fees, expenses, "2026-10-01", "2026-10-12");
  assert.equal(result.feeIncome, 7000);
  assert.equal(result.maintenancePaid, 700);
  assert.equal(result.netEarnings, 6300);
  assert.equal(result.payments.length, 2);
  assert.equal(result.expenses.length, 2);
});

test("calendar-year earnings include both kinds of records in the same year", () => {
  const result = earningsForPeriod(fees, expenses, "2026-01-01", "2026-12-31");
  assert.equal(result.feeIncome, 14000);
  assert.equal(result.maintenancePaid, 1400);
  assert.equal(result.netEarnings, 12600);
});

test("expense-only periods produce negative net earnings", () => {
  const result = earningsForPeriod(fees, expenses, "2024-01-01", "2024-12-31");
  assert.equal(result.feeIncome, 0);
  assert.equal(result.maintenancePaid, 100);
  assert.equal(result.netEarnings, -100);
});

test("empty and reversed periods contain no financial records", () => {
  for (const [from, to] of [
    ["2023-01-01", "2023-12-31"],
    ["2026-10-12", "2026-10-01"],
  ]) {
    const result = earningsForPeriod(fees, expenses, from, to);
    assert.equal(result.netEarnings, 0);
    assert.deepEqual(result.payments, []);
    assert.deepEqual(result.expenses, []);
  }
});

test("monthly dashboard totals agree with the equivalent earnings period", () => {
  assert.deepEqual(
    earningsForMonth(fees, expenses, "2026-10"),
    earningsForPeriod(fees, expenses, "2026-10-01", "2026-10-31"),
  );
});
