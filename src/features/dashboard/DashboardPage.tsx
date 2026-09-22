import { useState, type Dispatch, type SetStateAction } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import {
  AlertIcon,
  CalendarIcon,
  RupeeIcon,
  SeatIcon,
  UsersIcon,
} from "../../components/ui/Icons";
import { Modal, ModalHeader } from "../../components/ui/Modal";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator";
import { SearchField } from "../../components/ui/SearchField";
import { SectionJumpNav } from "../../components/ui/SectionJumpNav";
import { DueMemberCard } from "../../components/workspace/DueMemberCard";
import {
  SeatGrid,
  SeatLegend,
  ShiftPicker,
} from "../../components/workspace/SeatGrid";
import type { ModalState, ViewId, WorkspaceData } from "../../types/domain";
import { earningsForMonth } from "../../utils/earnings";
import { localDate, money, monthLabel, prettyDate } from "../../utils/format";
import { memberStatus } from "../../utils/members";
import { matchesSearch } from "../../utils/search";
import {
  configuredShifts,
  demoOccupiesShift,
  memberOccupiesShift,
  shiftTiming,
} from "../../utils/shifts";

const statTones = {
  amber: "status-warning-surface status-warning-text",
  green: "border-emerald-300 bg-emerald-50/70 text-emerald-900",
  blue: "border-sky-300 bg-sky-50/70 text-sky-900",
  coral: "status-danger-surface status-danger-text",
};

function StatCard({
  tone,
  icon,
  label,
  value,
  note,
  onClick,
}: {
  tone: keyof typeof statTones;
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-[1.1rem] border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:translate-y-0 ${statTones[tone]}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/80 shadow-sm">
          {icon}
        </span>
        <small className="text-[12px] font-bold leading-tight opacity-80 sm:text-sm">
          {label}
        </small>
      </div>
      <strong className="mt-1.5 block font-display text-[1.35rem] leading-none text-slate-900 sm:text-2xl">
        {value}
      </strong>
      <em className="mt-1 block text-[10px] leading-tight not-italic opacity-75 sm:text-[11px]">
        {note}
      </em>
    </button>
  );
}

type DashboardModal = "seats" | "dues" | "earnings" | null;

type DashboardActivity = {
  id: string;
  title: string;
  detail: string;
  kind: "attendance" | "fee";
  sortAt: string;
  when: string;
  paymentId?: string;
};

const percentOf = (count: number, total: number) =>
  total ? Math.round((count / total) * 1000) / 10 : 0;

const activityTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return prettyDate(timestamp.slice(0, 10));
  const day = localDate(date);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (day === localDate()) return `Today · ${time}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDate(yesterday)) return `Yesterday · ${time}`;
  return `${prettyDate(day)} · ${time}`;
};

export function DashboardPage({
  data,
  shift,
  setShift,
  setModal,
  openView,
  openPayment,
}: {
  data: WorkspaceData;
  shift: string;
  setShift: Dispatch<SetStateAction<string>>;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  openView: (view: ViewId) => void;
  openPayment: (paymentId: string) => void;
}) {
  const [dashboardModal, setDashboardModal] = useState<DashboardModal>(null);
  const [dueSearch, setDueSearch] = useState("");
  const active = data.members.filter((member) => member.active);
  const occupiedSeats = new Set(
    active
      .filter((member) =>
        memberOccupiesShift(member, shift, data.settings.shifts),
      )
      .map((member) => member.seat),
  );
  const demoSeatCodes = new Set(
    data.demoSeats
      .filter((demo) => demoOccupiesShift(demo, shift, data.settings.shifts))
      .map((demo) => demo.seat),
  );
  const inUseSeats = new Set([...occupiedSeats, ...demoSeatCodes]);
  const occupied = occupiedSeats.size;
  const demoCount = [...demoSeatCodes].filter(
    (seat) => !occupiedSeats.has(seat),
  ).length;
  const inUse = inUseSeats.size;
  const occupiedPercent = percentOf(occupied, data.settings.seatCount);
  const demoPercent = percentOf(demoCount, data.settings.seatCount);
  const inUsePercent = percentOf(inUse, data.settings.seatCount);
  const month = localDate().slice(0, 7);
  const monthlyEarnings = earningsForMonth(data.fees, data.maintenance, month);
  const currentMonthMaintenance = [...monthlyEarnings.expenses].sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      (second.createdAt || "").localeCompare(first.createdAt || ""),
  );
  const dueMembers = active
    .map((member) => ({
      member,
      status: memberStatus(member, data.fees),
    }))
    .filter(({ status }) => ["overdue", "due"].includes(status.tone))
    .sort(
      (first, second) =>
        Number(first.status.tone === "due") -
          Number(second.status.tone === "due") ||
        first.member.expiry.localeCompare(second.member.expiry),
    );
  const overdueCount = dueMembers.filter(
    ({ status }) => status.tone === "overdue",
  ).length;
  const upcomingDueCount = dueMembers.length - overdueCount;
  const visibleDueMembers = dueMembers.filter(({ member, status }) =>
    matchesSearch(dueSearch, [
      member.name,
      member.phone,
      member.seat,
      member.shift,
      status.label,
    ]),
  );
  const shiftOccupancy = configuredShifts(data.settings).map((option) => {
    const memberSeats = new Set(
      active
        .filter((member) =>
          memberOccupiesShift(member, option.name, data.settings.shifts),
        )
        .map((member) => member.seat),
    );
    const demoSeats = new Set(
      data.demoSeats
        .filter((demo) =>
          demoOccupiesShift(demo, option.name, data.settings.shifts),
        )
        .map((demo) => demo.seat),
    );
    const count = new Set([...memberSeats, ...demoSeats]).size;
    const memberCount = memberSeats.size;
    const demoCount = [...demoSeats].filter(
      (seat) => !memberSeats.has(seat),
    ).length;
    return {
      ...option,
      count,
      memberCount,
      demoCount,
      memberPercent: percentOf(memberCount, data.settings.seatCount),
      demoPercent: percentOf(demoCount, data.settings.seatCount),
      percent: percentOf(count, data.settings.seatCount),
    };
  });
  const attendanceActivities: DashboardActivity[] = [];
  data.attendance.forEach((item) => {
    const memberName =
      data.members.find((member) => member.id === item.memberId)?.name ||
      "Member";
    if (item.in) {
      const sortAt = `${item.date}T${item.in}:00`;
      attendanceActivities.push({
        id: `attendance-${item.id}-in`,
        title: `${memberName} checked in`,
        detail: `At ${item.in}`,
        kind: "attendance",
        sortAt,
        when: activityTime(sortAt),
      });
    }
    if (item.out) {
      const sortAt = `${item.date}T${item.out}:00`;
      attendanceActivities.push({
        id: `attendance-${item.id}-out`,
        title: `${memberName} checked out`,
        detail: `${item.in}–${item.out}`,
        kind: "attendance",
        sortAt,
        when: activityTime(sortAt),
      });
    }
  });
  const paymentActivities: DashboardActivity[] = data.fees.map((fee) => {
    const sortAt = fee.createdAt || `${fee.date}T12:00:00`;
    return {
      id: `fee-${fee.id}`,
      title: `Fee received from ${fee.memberName || "Member"}`,
      detail: `${money(fee.amount)} · ${fee.seat || "Seat not recorded"} · ${fee.mode}`,
      kind: "fee",
      sortAt,
      when: fee.createdAt ? activityTime(fee.createdAt) : prettyDate(fee.date),
      paymentId: fee.id,
    };
  });
  const activities = [...attendanceActivities, ...paymentActivities]
    .sort(
      (first, second) =>
        new Date(second.sortAt).getTime() - new Date(first.sortAt).getTime() ||
        second.id.localeCompare(first.id),
    )
    .slice(0, 4);
  const openEarningsSection = (id: string) => {
    setDashboardModal(null);
    openView("fees");
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      ),
    );
  };
  return (
    <>
      <section className="grid gap-3 min-[370px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="amber"
          icon={<UsersIcon className="size-5" />}
          label="Active members"
          value={active.length}
          note={`${data.members.length} total`}
          onClick={() => openView("members")}
        />
        <StatCard
          tone="green"
          icon={<SeatIcon className="size-5" />}
          label="Seats in use"
          value={`${inUse} / ${data.settings.seatCount}`}
          note={`${occupied} occupied · ${demoCount} demo`}
          onClick={() => setDashboardModal("seats")}
        />
        <StatCard
          tone="blue"
          icon={<RupeeIcon className="size-5" />}
          label="Fees this month"
          value={money(monthlyEarnings.feeIncome)}
          note={`Net ${money(monthlyEarnings.netEarnings)}`}
          onClick={() => setDashboardModal("earnings")}
        />
        <StatCard
          tone="coral"
          icon={<AlertIcon className="size-5" />}
          label="Renewals due"
          value={dueMembers.length}
          note={`${overdueCount} overdue · ${upcomingDueCount} soon`}
          onClick={() => {
            setDueSearch("");
            setDashboardModal("dues");
          }}
        />
      </section>
      <div className="mt-3 sm:hidden">
        <SectionJumpNav
          items={[
            { id: "overview-seats", label: "Seat availability" },
            { id: "overview-activity", label: "Recent activity" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
        <section id="overview-seats" className="panel scroll-mt-24 p-4 sm:p-6">
          <div className="section-title">
            <div>
              <h2>Seat availability</h2>
            </div>
            <ProgressIndicator
              label="Seat occupancy"
              value={`${inUse}/${data.settings.seatCount}${demoCount ? ` (${demoCount} demo)` : ""} · ${inUsePercent}%`}
              percent={occupiedPercent}
              demoPercent={demoPercent}
              tone="positive"
            />
          </div>
          <div className="mt-5">
            <ShiftPicker data={data} shift={shift} setShift={setShift} />
          </div>
          <div className="my-5">
            <SeatLegend />
          </div>
          <SeatGrid data={data} shift={shift} setModal={setModal} />
        </section>
        <section
          id="overview-activity"
          className="panel scroll-mt-24 p-4 sm:p-6"
        >
          <div className="section-title">
            <h2>Recent activity</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {activities.length ? (
              activities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  disabled={!activity.paymentId}
                  onClick={() =>
                    activity.paymentId && openPayment(activity.paymentId)
                  }
                  className="flex w-full gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition enabled:hover:bg-slate-100 enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-[var(--brand)] disabled:cursor-default"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm">
                    {activity.kind === "fee" ? (
                      <RupeeIcon className="size-5" />
                    ) : (
                      <CalendarIcon className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm text-slate-900">
                      {activity.title}
                    </strong>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {activity.detail}
                    </p>
                    <small className="text-[11px] font-semibold text-slate-400">
                      {activity.when}
                    </small>
                    {activity.paymentId && (
                      <small className="ml-2 text-[11px] font-extrabold text-[var(--brand)]">
                        View payment →
                      </small>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No activity yet"
                text="Check-ins and payments will appear here."
              />
            )}
          </div>
        </section>
      </div>
      {dashboardModal === "seats" && (
        <Modal
          onClose={() => setDashboardModal(null)}
          labelledBy="seat-occupancy-title"
        >
          <ModalHeader
            eyebrow="Seat occupancy"
            title="Occupancy by shift"
            onClose={() => setDashboardModal(null)}
            id="seat-occupancy-title"
          />
          <div className="grid gap-3">
            {shiftOccupancy.map((option) => (
              <div
                key={option.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block text-slate-900">
                      {option.name}
                    </strong>
                    <small className="text-slate-600">
                      {shiftTiming(option)}
                    </small>
                  </div>
                  <strong className="text-right text-slate-900">
                    {option.count}/{data.settings.seatCount}
                    <small className="block font-semibold text-slate-500">
                      {option.percent}%
                    </small>
                  </strong>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="flex h-full">
                    <div
                      className="h-full bg-emerald-600 transition-[width]"
                      style={{
                        width: `${Math.min(option.memberPercent, 100)}%`,
                      }}
                    />
                    <div
                      className="h-full bg-[var(--status-demo)] transition-[width]"
                      style={{
                        width: `${Math.min(option.demoPercent, 100 - option.memberPercent)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[var(--brand)]" />
                    {option.memberCount} occupied ({option.memberPercent}%)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[var(--status-demo)]" />
                    {option.demoCount} demo ({option.demoPercent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDashboardModal(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
      {dashboardModal === "earnings" && (
        <Modal
          onClose={() => setDashboardModal(null)}
          labelledBy="earnings-snapshot-title"
        >
          <ModalHeader
            eyebrow="Earnings"
            title={monthLabel(month)}
            onClose={() => setDashboardModal(null)}
            id="earnings-snapshot-title"
          />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Fees collected", monthlyEarnings.feeIncome, "fees-archive"],
              [
                "Maintenance",
                monthlyEarnings.maintenancePaid,
                "earnings-maintenance",
              ],
              [
                "Net earnings",
                monthlyEarnings.netEarnings,
                "earnings-maintenance",
              ],
            ].map(([label, value, target], index) => (
              <button
                type="button"
                key={label}
                onClick={() => openEarningsSection(String(target))}
                className={`min-w-0 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                  [
                    "border-emerald-200 bg-emerald-50/70",
                    "status-warning-surface",
                    Number(value) < 0
                      ? "status-danger-surface"
                      : "border-sky-300 bg-sky-50/70",
                  ][index]
                }`}
              >
                <small className="block text-[10px] font-bold leading-tight text-slate-600 sm:text-xs">
                  {label}
                </small>
                <strong className="mt-1 block truncate text-sm text-slate-900 sm:text-lg">
                  {money(Number(value))}
                </strong>
              </button>
            ))}
          </div>
          <div className="mt-5">
            {currentMonthMaintenance.length ? (
              <div className="grid gap-2">
                {currentMonthMaintenance.slice(0, 4).map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="min-w-0">
                      <strong className="block text-sm text-slate-900">
                        {expense.category}
                      </strong>
                      <small className="block truncate text-slate-500">
                        {prettyDate(expense.date)}
                        {expense.note ? ` · ${expense.note}` : ""}
                      </small>
                    </div>
                    <b className="shrink-0 text-sm text-slate-900">
                      {money(expense.amount)}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 grid min-h-24 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <strong className="text-sm text-slate-800">
                  No maintenance recorded this month
                </strong>
              </div>
            )}
          </div>
          <div className="modal-actions flex-wrap">
            <Button variant="secondary" onClick={() => setDashboardModal(null)}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDashboardModal(null);
                openView("fees");
              }}
            >
              Go to earnings
            </Button>
            <Button
              onClick={() => {
                setDashboardModal(null);
                setModal({ type: "maintenance-add" });
              }}
            >
              Add maintenance
            </Button>
          </div>
        </Modal>
      )}
      {dashboardModal === "dues" && (
        <Modal
          onClose={() => setDashboardModal(null)}
          labelledBy="payments-due-title"
          fixedLayout
        >
          <ModalHeader
            eyebrow="Payments"
            title="Payments & renewals due"
            onClose={() => setDashboardModal(null)}
            id="payments-due-title"
          />
          <div className="shrink-0 border-b border-slate-200 pb-4">
            <SearchField
              value={dueSearch}
              onChange={setDueSearch}
              placeholder="Search member, phone, seat or shift"
            />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {dueSearch.trim()
                ? `${visibleDueMembers.length} of ${dueMembers.length} results`
                : `${dueMembers.length} members need attention`}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-1">
            <div className="grid gap-3">
              {visibleDueMembers.length ? (
                visibleDueMembers.map(({ member, status }) => (
                  <DueMemberCard
                    key={member.id}
                    member={member}
                    status={status}
                    onCollect={() => {
                      setDashboardModal(null);
                      setModal({ type: "renew", id: member.id });
                    }}
                  />
                ))
              ) : (
                <EmptyState
                  title={
                    dueMembers.length ? "No matching members" : "Nothing due"
                  }
                  text={
                    dueMembers.length
                      ? "Try a different name, phone, seat or shift."
                      : "All active memberships are up to date."
                  }
                />
              )}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={() => setDashboardModal(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setDashboardModal(null);
                openView("fees");
              }}
            >
              View fee archive
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
