import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dialablePhone,
  whatsappPhone,
} from "../src/components/ui/PhoneLink.tsx";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const dialogs = read("src/features/members/MemberDialogs.tsx");
const fees = read("src/features/fees/FeesPage.tsx");
const maintenanceArchive = read("src/features/fees/MaintenanceArchive.tsx");
const maintenanceDialogs = read("src/features/fees/MaintenanceDialogs.tsx");
const seats = read("src/components/workspace/SeatGrid.tsx");
const pills = read("src/components/ui/StatusPill.tsx");
const progress = read("src/components/ui/ProgressIndicator.tsx");
const dashboard = read("src/features/dashboard/DashboardPage.tsx");
const styles = read("src/styles/index.css");
const settings = read("src/features/settings/SettingsPage.tsx");
const members = read("src/features/members/MembersPage.tsx");
const phoneLink = read("src/components/ui/PhoneLink.tsx");
const dueMemberCard = read("src/components/workspace/DueMemberCard.tsx");
const checkboxCard = read("src/components/ui/CheckboxCard.tsx");
const workspaceRepository = read("src/repositories/workspaceRepository.ts");
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

test("member phone numbers can open the dialler and WhatsApp", () => {
  assert.match(phoneLink, /href=\{`tel:/);
  assert.match(phoneLink, /https:\/\/wa\.me/);
  assert.match(phoneLink, /target="_blank"/);
  assert.equal(dialablePhone("98765 43210"), "+919876543210");
  assert.equal(whatsappPhone("98765 43210"), "919876543210");
  assert.equal(whatsappPhone("+44 7700 900123"), "447700900123");
  assert.match(dialogs, /<PhoneLink/);
  assert.match(members, /<PhoneLink/);
});

test("due-member cards reuse member call and WhatsApp actions", () => {
  assert.match(dashboard, /<DueMemberCard/);
  assert.match(fees, /<DueMemberCard/);
  assert.match(
    dueMemberCard,
    /<PhoneLink\s+phone=\{member\.phone\}\s+name=\{member\.name\}/,
  );
  assert.match(dueMemberCard, /onClick=\{onCollect\}/);
  assert.match(dueMemberCard, /grid-cols-\[minmax\(0,\.65fr\)/);
  assert.doesNotMatch(dueMemberCard, /col-span-2/);
});

test("member cards and desktop rows both expose contact actions", () => {
  const memberCard = members.slice(
    members.indexOf("export function MemberCard"),
    members.indexOf("function MemberRow"),
  );
  const memberRow = members.slice(
    members.indexOf("function MemberRow"),
    members.indexOf("export function DemoCard"),
  );
  for (const surface of [memberCard, memberRow]) {
    assert.match(
      surface,
      /<PhoneLink\s+phone=\{member\.phone\}\s+name=\{member\.name\}/,
    );
  }
});

test("available seat chips and tiles share a dark-mode-safe surface", () => {
  assert.match(pills, /available: "status-available-surface"/);
  assert.match(seats, /status-available-surface border-dashed/);
  assert.match(styles, /--status-available-bg: #151f1c/);
  assert.match(styles, /--status-available-border: #50665d/);
  assert.match(styles, /--status-available-text: #c2d0c9/);
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
  assert.match(
    databaseSetup,
    /grant update \(track_demo_visitors\)[\s\S]*?to authenticated/,
  );
});

test("settings checkbox cards share one consistent control", () => {
  assert.match(settings, /<CheckboxCard/);
  assert.equal(settings.match(/<CheckboxCard/g)?.length, 2);
  assert.match(checkboxCard, /grid-cols-\[1\.25rem_minmax\(0,1fr\)\]/);
  assert.match(checkboxCard, /className="peer sr-only"/);
  assert.match(checkboxCard, /size-5/);
});

test("fee archive uses collapsed month sections inside year groups", () => {
  assert.match(fees, /yearlyGroups/);
  assert.match(fees, /archive-year/);
  assert.match(fees, /archive-month/);
  assert.match(fees, /open=\{yearStartsOpen/);
  assert.match(fees, /Boolean\(feeSearch\.trim\(\)\) \|\|/);
  assert.match(fees, /Earnings summary/);
  assert.doesNotMatch(fees, /Active-month average/);
  assert.doesNotMatch(fees, /Selected period/);
  assert.match(
    fees,
    /searchParams\.get\("period"\) === "all" \? "all" : currentYear/,
  );
  assert.match(fees, /year === expandedYear/);
  assert.match(
    fees,
    /focusedPayment\?\.date\.slice\(0, 7\) === month \|\|\s+month === expandedMonth/,
  );
});

test("earnings include shared maintenance expenses and net income", () => {
  assert.match(fees, /Net earnings/);
  assert.match(fees, /scrollToSection/);
  assert.match(fees, /<MaintenanceArchive/);
  assert.match(maintenanceArchive, /id="earnings-maintenance"/);
  assert.match(maintenanceArchive, /Add maintenance/);
  assert.match(maintenanceArchive, /maintenance-edit/);
  assert.match(maintenanceArchive, /maintenance-delete/);
  assert.match(maintenanceArchive, /initiallyOpen=\{month === currentMonth\}/);
  assert.match(maintenanceArchive, /archive-year/);
  assert.match(maintenanceArchive, /archive-month/);
  assert.match(maintenanceDialogs, /MAINTENANCE_CATEGORIES/);
  assert.match(maintenanceDialogs, /Add maintenance expense/);
  assert.match(dashboard, /Fees this month/);
  assert.match(dashboard, /title=\{monthLabel\(month\)\}/);
  assert.match(dashboard, /Go to earnings/);
  assert.match(dashboard, /openEarningsSection/);
  assert.match(
    databaseSetup,
    /create table if not exists public\.maintenance_expenses/,
  );
  assert.match(databaseSetup, /p_maintenance_expenses jsonb/);
  assert.match(databaseSetup, /p_deleted_maintenance_expense_ids uuid\[\]/);
});

test("mobile summary cards retain their compact row layouts", () => {
  assert.match(fees, /grid max-w-4xl grid-cols-3 gap-2/);
  assert.match(dashboard, /min-\[370px\]:grid-cols-2 xl:grid-cols-4/);
  assert.doesNotMatch(dashboard, /min-\[380px\]:grid-cols-2/);
});

test("earnings keep compact top tiles and simple current-year/month controls", () => {
  assert.match(
    fees,
    /searchParams\.get\("period"\) === "all" \? "all" : today\.slice\(5, 7\)/,
  );
  assert.match(fees, /value=\{selectedYear\}/);
  assert.match(fees, /value=\{selectedMonth\}/);
  assert.match(fees, /earningsPeriodRange\(selectedYear, selectedMonth\)/);
  assert.match(
    fees,
    /\["Net earnings", earnings\.netEarnings, "earnings-summary"\]/,
  );
  const summary = fees.slice(
    fees.indexOf('<section id="earnings-summary"'),
    fees.indexOf('id="fees-archive"'),
  );
  assert.match(summary, /<dl/);
  assert.doesNotMatch(
    summary,
    /<button|Same period|After maintenance|Collected − Maintenance/,
  );
  assert.ok(
    fees.indexOf('["Collected", earnings.feeIncome, "fees-archive"]') <
      fees.indexOf("<SectionJumpNav"),
  );
});

test("earnings sections prioritize dues and expand on jump or payment links", () => {
  assert.match(fees, /\[duesOpen, setDuesOpen\] = useState\(true\)/);
  assert.match(
    fees,
    /\[collectionsOpen, setCollectionsOpen\] = useState\(false\)/,
  );
  assert.match(
    fees,
    /\[maintenanceOpen, setMaintenanceOpen\] = useState\(false\)/,
  );
  assert.match(fees, /onJump=\{scrollToSection\}/);
  assert.match(fees, /if \(id === "fees-archive"\) setCollectionsOpen\(true\)/);
  assert.match(
    fees,
    /if \(id === "earnings-maintenance"\) setMaintenanceOpen\(true\)/,
  );
  assert.match(
    fees,
    /if \(!focusedPayment\) return;\s+setCollectionsOpen\(true\)/,
  );
  assert.match(
    fees,
    /if \(event\.target === event\.currentTarget\)\s+setCollectionsOpen/,
  );
  assert.match(
    maintenanceArchive,
    /if \(event\.target === event\.currentTarget\)\s+onOpenChange/,
  );
  assert.match(fees, /expenses=\{earnings\.expenses\}/);
  assert.match(fees, /const hasDues = due\.length > 0/);
  assert.match(fees, /if \(!hasDues\) priorityJumpItems\.reverse\(\)/);
  const order = [
    "{hasDues && renewalsSection}",
    'id="earnings-summary"',
    "{!hasDues && renewalsSection}",
    'id="fees-archive"',
  ].map((marker) => fees.indexOf(marker));
  assert.ok(order[0] < order[1] && order[1] < order[2]);
  assert.ok(order[2] < order[3]);
  assert.ok(order[3] < fees.indexOf("<MaintenanceArchive"));
});

test("activity modal uses the full 30-day list without changing the home limit", () => {
  assert.match(dashboard, /allActivities\.slice\(0, 4\)/);
  assert.match(dashboard, /isWithinLast30Days\(activity\.sortAt, now\)/);
  assert.match(dashboard, /recentActivities\.map/);
  assert.match(dashboard, /setDashboardModal\("activity"\)/);
  assert.match(dashboard, /eyebrow="Last 30 days"/);
  assert.match(
    dashboard,
    /setDashboardModal\(null\);\s+openPayment\(paymentId\)/,
  );
});

test("recent activity is time-sorted and fee entries deep-link to payments", () => {
  assert.match(dashboard, /new Date\(second\.sortAt\)\.getTime\(\)/);
  assert.match(dashboard, /fee\.createdAt \|\|/);
  assert.match(dashboard, /openPayment\(activity\.paymentId\)/);
  assert.match(dashboard, /View payment →/);
  assert.match(
    workspaceRepository,
    /createdAt: row\.created_at \|\| undefined/,
  );
  assert.match(fees, /useSearchParams/);
  assert.match(fees, /scrollIntoView\(\{ behavior: "smooth"/);
  assert.match(fees, /id=\{`payment-\$\{payment\.id\}`\}/);
  assert.match(fees, /ring-\[var\(--brand\)\]/);
});
