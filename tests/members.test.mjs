import assert from "node:assert/strict";
import test from "node:test";
import {
  findMemberByIdentity,
  memberStatus,
  normalizeMemberName,
  sameMemberIdentity,
} from "../src/utils/members.ts";
import { localDate } from "../src/utils/format.ts";

test("member identity ignores name case and repeated spaces", () => {
  assert.equal(normalizeMemberName("  Riya   Mehta "), "riya mehta");
  assert.equal(
    sameMemberIdentity(
      { name: "Riya Mehta", phone: "9876543210" },
      "riya   mehta",
      "9876543210",
    ),
    true,
  );
});

test("member identity still requires the same phone number", () => {
  assert.equal(
    sameMemberIdentity(
      { name: "Riya Mehta", phone: "9876543210" },
      "Riya Mehta",
      "9999999999",
    ),
    false,
  );
});

test("identity lookup can exclude the record being edited", () => {
  const members = [{ id: "one", name: "Riya Mehta", phone: "9876543210" }];
  assert.equal(
    findMemberByIdentity(members, "Riya Mehta", "9876543210")?.id,
    "one",
  );
  assert.equal(
    findMemberByIdentity(members, "Riya Mehta", "9876543210", "one"),
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
