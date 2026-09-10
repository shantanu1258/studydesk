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
const members = read("src/features/members/MembersPage.tsx");
const phoneLink = read("src/components/ui/PhoneLink.tsx");
const databaseSetup = read("supabase/studydesk.sql");

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
  assert.match(databaseSetup, /create table if not exists public\.seat_demos/);
  assert.match(settings, /Track demo visitors/);
  assert.match(members, /demo: data\.demoSeats\.length/);
  assert.match(members, /tone="demo"/);
  assert.match(dialogs, /sourceDemo/);
  assert.match(dialogs, /demoId/);
  assert.match(databaseSetup, /visitor_name/);
  assert.match(databaseSetup, /visitor_phone/);
});

test("member phone numbers can open the device dialler", () => {
  assert.match(phoneLink, /href=\{`tel:/);
  assert.match(phoneLink, /\+91/);
  assert.match(dialogs, /<PhoneLink/);
  assert.match(members, /<PhoneLink/);
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
  assert.doesNotMatch(fees, /Every payment can be corrected/);
});

test("Core admin removal and unique phones are enforced by the database", () => {
  assert.match(settings, /data\.settings\.isFounder/);
  assert.match(databaseSetup, /Only the Core admin can remove another admin/);
  assert.match(databaseSetup, /enforce_unique_member_phone/);
  assert.doesNotMatch(settings, /Only the Core admin can remove another admin/);
});

test("exact custom membership and payment end dates are supported", () => {
  assert.match(dialogs, /Custom end date/);
  assert.match(dialogs, /endForDuration/);
  assert.match(dialogs, /durationSelection/);
  assert.match(dialogs, /name="periodEnd"/);
  assert.match(dialogs, /The covered period must end after it starts/);
});

test("Supabase has one complete setup file", () => {
  assert.match(databaseSetup, /StudyDesk complete Supabase setup/);
  assert.match(databaseSetup, /create table if not exists public\.profiles/);
  assert.match(
    databaseSetup,
    /create table if not exists public\.library_users/,
  );
  assert.match(databaseSetup, /profile-photos/);
  assert.match(databaseSetup, /track_demo_visitors/);
});

test("fee archive uses collapsed month sections inside year groups", () => {
  assert.match(fees, /yearlyGroups/);
  assert.match(fees, /archive-year/);
  assert.match(fees, /archive-month/);
  assert.match(fees, /open=\{yearStartsOpen/);
  assert.match(fees, /open=\{Boolean\(feeSearch\.trim\(\)\)\}/);
  assert.match(fees, /Collected this month/);
  assert.doesNotMatch(fees, /Active-month average/);
  assert.doesNotMatch(fees, /Selected period/);
});
