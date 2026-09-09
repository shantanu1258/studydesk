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
import { localDate, money, prettyDate } from "../../utils/format";
import { memberStatus } from "../../utils/members";
import { matchesSearch } from "../../utils/search";
import {
  configuredShifts,
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
      className={`group w-full rounded-[1.2rem] border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:translate-y-0 sm:p-4 ${statTones[tone]}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/80 shadow-sm sm:size-9 sm:rounded-xl">
          {icon}
        </span>
        <small className="font-bold leading-tight opacity-80">{label}</small>
      </div>
      <strong className="mt-2 block font-display text-2xl leading-none text-slate-900 sm:text-3xl">
        {value}
      </strong>
      <em className="mt-1 block text-[11px] leading-tight not-italic opacity-75 sm:text-xs">
        {note}
      </em>
    </button>
  );
}

type DashboardModal = "seats" | "dues" | null;

export function DashboardPage({
  data,
  shift,
  setShift,
  setModal,
  openView,
}: {
  data: WorkspaceData;
  shift: string;
  setShift: Dispatch<SetStateAction<string>>;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  openView: (view: ViewId) => void;
}) {
  const [dashboardModal, setDashboardModal] = useState<DashboardModal>(null);
  const [dueSearch, setDueSearch] = useState("");
  const active = data.members.filter((member) => member.active);
  const occupied = new Set(
    active
      .filter((member) =>
        memberOccupiesShift(member, shift, data.settings.shifts),
      )
      .map((member) => member.seat),
  ).size;
  const month = localDate().slice(0, 7);
  const monthlyFees = data.fees.filter((fee) => fee.date.startsWith(month));
  const collected = monthlyFees.reduce(
    (sum, fee) => sum + Number(fee.amount),
    0,
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
    const count = new Set(
      active
        .filter((member) =>
          memberOccupiesShift(member, option.name, data.settings.shifts),
        )
        .map((member) => member.seat),
    ).size;
    return {
      ...option,
      count,
      percent: data.settings.seatCount
        ? Math.round((count / data.settings.seatCount) * 100)
        : 0,
    };
  });
  const activities = [
    ...data.attendance
      .filter((item) => item.date === localDate())
      .map((item) => ({
        title: `${data.members.find((member) => member.id === item.memberId)?.name || "Member"} checked ${item.out ? "out" : "in"}`,
        detail: item.out ? `${item.in}–${item.out}` : `At ${item.in}`,
        kind: "attendance",
      })),
    ...[...data.fees]
      .reverse()
      .slice(0, 3)
      .map((fee) => ({
        title: `Fee received from ${fee.memberName || "Member"}`,
        detail: `${money(fee.amount)} · ${fee.seat || "Seat not recorded"} · ${fee.mode}`,
        kind: "fee",
      })),
  ].slice(0, 4);
  const percent = data.settings.seatCount
    ? Math.round((occupied / data.settings.seatCount) * 100)
    : 0;

  return (
    <>
      <section className="grid gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="amber"
          icon={<UsersIcon className="size-5" />}
          label="Active members"
          value={active.length}
          note={`${data.members.length} total records`}
          onClick={() => openView("members")}
        />
        <StatCard
          tone="green"
          icon={<SeatIcon className="size-5" />}
          label="Seats occupied"
          value={`${occupied} / ${data.settings.seatCount}`}
          note={`${percent}% in ${shift.toLowerCase()}`}
          onClick={() => setDashboardModal("seats")}
        />
        <StatCard
          tone="blue"
          icon={<RupeeIcon className="size-5" />}
          label="Collected this month"
          value={money(collected)}
          note={`${monthlyFees.length} payments`}
          onClick={() => openView("fees")}
        />
        <StatCard
          tone="coral"
          icon={<AlertIcon className="size-5" />}
          label="Payments & renewals due"
          value={dueMembers.length}
          note="Unpaid, expired, or within 5 days"
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
            { id: "overview-activity", label: "Today’s activity" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
        <section id="overview-seats" className="panel scroll-mt-24 p-4 sm:p-6">
          <div className="section-title">
            <div>
              <h2>Seat availability</h2>
              <p>
                <strong className="text-slate-800">
                  {data.settings.library}
                </strong>{" "}
                · Select a seat to view or assign it
              </p>
            </div>
            <ProgressIndicator
              label="Seat occupancy"
              value={`${occupied}/${data.settings.seatCount} (${percent}%)`}
              percent={percent}
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
            <div>
              <h2>Today’s activity</h2>
              <p>Latest desk updates</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {activities.length ? (
              activities.map((activity, index) => (
                <div
                  key={`${activity.title}-${index}`}
                  className="flex gap-3 rounded-2xl bg-slate-50 p-3.5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm">
                    {activity.kind === "fee" ? (
                      <RupeeIcon className="size-5" />
                    ) : (
                      <CalendarIcon className="size-5" />
                    )}
                  </span>
                  <div>
                    <strong className="text-sm text-slate-900">
                      {activity.title}
                    </strong>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {activity.detail}
                    </p>
                    <small className="text-[11px] font-semibold text-slate-400">
                      Today
                    </small>
                  </div>
                </div>
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
            text={`${data.settings.seatCount} seats in ${data.settings.library}`}
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
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width]"
                    style={{ width: `${Math.min(option.percent, 100)}%` }}
                  />
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
      {dashboardModal === "dues" && (
        <Modal
          onClose={() => setDashboardModal(null)}
          labelledBy="payments-due-title"
          fixedLayout
        >
          <ModalHeader
            eyebrow="Payments"
            title="Payments & renewals due"
            text="Overdue first, followed by upcoming renewals."
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
