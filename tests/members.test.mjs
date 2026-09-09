import assert from "node:assert/strict";
import test from "node:test";
import {
  findMemberByPhone,
  findOverlappingPayment,
  memberStatus,
  paymentPeriodsOverlap,
  sameMemberPhone,
} from "../src/utils/members.ts";
import { localDate } from "../src/utils/format.ts";

test("member phone identity does not depend on the member name", () => {
  assert.equal(
    sameMemberPhone({ name: "Riya Mehta", phone: "9876543210" }, "9876543210"),
    true,
  );
});

test("different phone numbers belong to different members", () => {
  assert.equal(
    sameMemberPhone({ name: "Riya Mehta", phone: "9876543210" }, "9999999999"),
    false,
  );
});

test("phone lookup can exclude the record whose name is being edited", () => {
  const members = [{ id: "one", name: "Riya Mehta", phone: "9876543210" }];
  assert.equal(findMemberByPhone(members, "9876543210")?.id, "one");
  assert.equal(findMemberByPhone(members, "9876543210", "one"), undefined);
});

test("payment periods warn only when their covered dates overlap", () => {
  assert.equal(
    paymentPeriodsOverlap(
      "2026-09-01",
      "2026-10-01",
      "2026-09-15",
      "2026-10-15",
    ),
    true,
  );
  assert.equal(
    paymentPeriodsOverlap(
      "2026-09-01",
      "2026-10-01",
      "2026-10-01",
      "2026-11-01",
    ),
    false,
  );
});

test("overlapping payment lookup stays within one member", () => {
  const payments = [
    {
      id: "payment-one",
      memberId: "member-one",
      periodStart: "2026-09-01",
      periodEnd: "2026-10-01",
    },
  ];
  assert.equal(
    findOverlappingPayment(payments, "member-one", "2026-09-10", "2026-10-10")
      ?.id,
    "payment-one",
  );
  assert.equal(
    findOverlappingPayment(payments, "member-two", "2026-09-10", "2026-10-10"),
    undefined,
  );
});

const expiringMember = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 2);
  return {
    id: "due-member",
    name: "Riya Mehta",
    phone: "9876543210",
    seat: "A-02",
    shift: "Morning",
    fee: 1200,
    start: "2026-01-01",
    planStart: "2026-01-01",
    planMonths: 1,
    expiry: localDate(expiry),
    active: true,
  };
};

test("an expiring member with payment history is shown as renewal due", () => {
  const member = expiringMember();
  const historicalPayment = {
    id: "payment-one",
    memberId: member.id,
    memberName: member.name,
    seat: member.seat,
    amount: 1200,
    date: "2026-01-01",
    mode: "UPI",
    periodStart: "2026-01-01",
    periodMonths: 1,
    periodEnd: "2026-02-01",
  };

  assert.equal(memberStatus(member, [historicalPayment]).tone, "due");
});

test("an expiring admission with no payment remains overdue", () => {
  assert.equal(memberStatus(expiringMember(), []).tone, "overdue");
});
