import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEFAULT_SHIFTS,
} from "../src/config/constants.ts";
import { buildWorkspaceChanges } from "../src/repositories/workspaceRepository.ts";

const libraryId = "6f7d7be0-cc62-44ca-a6ee-745383b66474";
const memberId = "7c077146-b863-4f93-a381-7c85eb0ee59f";
const paymentId = "21899891-d70e-4437-a99b-d0696a94cc78";

function workspace() {
  return {
    settings: {
      id: libraryId,
      library: "Focus Room",
      seatCount: 24,
      prefix: "A",
      seatSections: [
        {
          id: "main-section",
          name: "Main section",
          prefix: "A",
          start: 1,
          end: 24,
        },
      ],
      shifts: structuredClone(DEFAULT_SHIFTS),
      feeCollection: "advance",
      attendanceEnabled: false,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      secondaryColor: DEFAULT_SECONDARY_COLOR,
      isFounder: true,
    },
    members: [
      {
        id: memberId,
        name: "Riya Mehta",
        phone: "9876543210",
        seat: "A-01",
        shift: "Morning",
        fee: 1200,
        start: "2026-09-01",
        planStart: "2026-09-01",
        planMonths: 1,
        expiry: "2026-10-01",
        active: true,
      },
    ],
    fees: [
      {
        id: paymentId,
        memberId,
        memberName: "Riya Mehta",
        seat: "A-01",
        amount: 1200,
        date: "2026-09-01",
        mode: "UPI",
        periodStart: "2026-09-01",
        periodMonths: 1,
        periodEnd: "2026-10-01",
      },
    ],
    attendance: [],
  };
}

test("unchanged workspaces produce an empty database change set", () => {
  const previous = workspace();
  const changes = buildWorkspaceChanges(previous, structuredClone(previous));

  assert.equal(changes.p_settings, null);
  assert.deepEqual(changes.p_members, []);
  assert.deepEqual(changes.p_payments, []);
  assert.deepEqual(changes.p_attendance, []);
  assert.deepEqual(changes.p_deleted_member_ids, []);
});

test("only changed and newly added records are sent", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.members[0].active = false;
  next.attendance.push({
    id: "d45f19c3-e8a6-43ec-99dd-5f25b4314408",
    memberId,
    date: "2026-09-07",
    in: "09:05",
    out: "",
  });

  const changes = buildWorkspaceChanges(previous, next);
  assert.equal(changes.p_members.length, 1);
  assert.equal(changes.p_members[0].active, false);
  assert.equal(changes.p_attendance.length, 1);
  assert.equal(changes.p_attendance[0].check_in, "09:05");
  assert.equal(changes.p_attendance[0].check_out, null);
  assert.deepEqual(changes.p_payments, []);
});

test("changing a member seat does not rewrite historical payment seats", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.members[0].seat = "B-21";

  const changes = buildWorkspaceChanges(previous, next);
  assert.equal(changes.p_members[0].seat_code, "B-21");
  assert.deepEqual(changes.p_payments, []);
});

test("new payments include the seat used when they were recorded", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.fees.push({
    id: "2834be32-1479-46ca-a687-6c090abf93ac",
    memberId,
    memberName: "Riya Mehta",
    seat: "A-01",
    amount: 1200,
    date: "2026-10-01",
    mode: "Cash",
    periodStart: "2026-10-01",
    periodMonths: 1,
    periodEnd: "2026-11-01",
  });

  const changes = buildWorkspaceChanges(previous, next);
  assert.equal(changes.p_payments[0].seat_code, "A-01");
  assert.equal(changes.p_payments[0].member_name, "Riya Mehta");
  assert.equal(changes.p_payments[0].period_start, "2026-10-01");
  assert.equal(changes.p_payments[0].period_months, 1);
  assert.equal(changes.p_payments[0].period_end, "2026-11-01");
});

test("settings and removed records are represented explicitly", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.settings.library = "Quiet Study Hall";
  next.settings.seatCount = 40;
  next.fees = [];

  const changes = buildWorkspaceChanges(previous, next);
  assert.deepEqual(changes.p_settings, {
    name: "Quiet Study Hall",
    seat_count: 40,
    seat_prefix: "A",
    shift_definitions: DEFAULT_SHIFTS,
    fee_collection: "advance",
    attendance_enabled: false,
    primary_color: DEFAULT_PRIMARY_COLOR,
    secondary_color: DEFAULT_SECONDARY_COLOR,
    seat_sections: [
      {
        id: "main-section",
        name: "Main section",
        prefix: "A",
        start: 1,
        end: 24,
      },
    ],
  });
  assert.deepEqual(changes.p_deleted_payment_ids, [paymentId]);
});

test("shift and fee preferences are included when settings change", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.settings.shifts = [
    { id: "daily", type: "Daily", name: "Daily", start: "", end: "" },
  ];
  next.settings.feeCollection = "later";

  const changes = buildWorkspaceChanges(previous, next);
  assert.deepEqual(changes.p_settings.shift_definitions, next.settings.shifts);
  assert.equal(changes.p_settings.fee_collection, "later");
});

test("membership plan dates and duration are included when a member changes", () => {
  const previous = workspace();
  const next = structuredClone(previous);
  next.members[0].planStart = "2026-09-15";
  next.members[0].planMonths = 3;
  next.members[0].expiry = "2026-12-15";

  const changes = buildWorkspaceChanges(previous, next);
  assert.equal(changes.p_members[0].plan_start_date, "2026-09-15");
  assert.equal(changes.p_members[0].plan_months, 3);
  assert.equal(changes.p_members[0].expiry_date, "2026-12-15");
});
