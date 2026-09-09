import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const dialogs = read("src/features/members/MemberDialogs.tsx");
const fees = read("src/features/fees/FeesPage.tsx");
const seats = read("src/components/workspace/SeatGrid.tsx");
const pills = read("src/components/ui/StatusPill.tsx");
const progress = read("src/components/ui/ProgressIndicator.tsx");
const dashboard = read("src/features/dashboard/DashboardPage.tsx");
const styles = read("src/styles/index.css");
const settings = read("src/features/settings/SettingsPage.tsx");
const migration = read(
  "supabase/migrations/004_demo_seats_and_fee_controls.sql",
);

test("demo seats have persistent UI and database support", () => {
  assert.match(seats, /type: "seat-actions"/);
  assert.match(seats, /status-demo-solid/);
  assert.match(pills, /demo: "status-demo-solid"/);
  assert.match(styles, /--status-demo: #2563eb/);
  assert.match(progress, /demoPercent/);
  assert.match(progress, /bg-\[var\(--status-demo\)\]/);
  assert.match(dashboard, /tone="positive"/);
  assert.match(dashboard, /· \$\{inUsePercent\}%/);
  assert.match(dashboard, /bg-emerald-600 transition-\[width\]/);
  assert.match(dashboard, /occupied \(\{option\.memberPercent\}%\)/);
  assert.match(dashboard, /demo \(\{option\.demoPercent\}%\)/);
  assert.match(dialogs, /Start demo/);
  assert.match(dialogs, /Stop demo/);
  assert.match(migration, /create table if not exists public\.seat_demos/);
});

test("available seat chips and tiles share a dark-mode-safe surface", () => {
  assert.match(pills, /available: "status-available-surface"/);
  assert.match(seats, /status-available-surface border-dashed/);
  assert.match(styles, /--status-available-bg: #22302b/);
  assert.match(styles, /--status-available-border: #17231f/);
});

test("seat sections supply the default admission and first-payment rate", () => {
  assert.match(settings, /Default fee \(₹\)/);
  assert.match(dialogs, /defaultFeeForSeat/);
  assert.match(dialogs, /setMemberFee\(rate\)/);
  assert.match(dialogs, /PaymentAmountSummary/);
  assert.match(
    dialogs,
    /amount: Number\(values\.amount \?\? member\.fee \* periodMonths\)/,
  );
  assert.doesNotMatch(dialogs, /name="paymentAmount"/);
  assert.match(dialogs, /Suggested from \{member\.seat\}’s range/);
  assert.match(dialogs, /setPaymentAmount/);
});

test("member payment history and older correction warnings are available", () => {
  assert.match(dialogs, /Payment history/);
  assert.match(dialogs, /Edit an older payment\?/);
  assert.match(dialogs, /This period already has a payment/);
  assert.match(fees, /Every payment can be corrected/);
});

test("Core admin removal and unique phones are enforced by the database", () => {
  assert.match(settings, /data\.settings\.isFounder/);
  assert.match(migration, /Only the Core admin can remove another admin/);
  assert.match(migration, /enforce_unique_member_phone/);
});
