import type { Dispatch, SetStateAction } from "react";
import { StatusPill, type StatusPillTone } from "../ui/StatusPill";
import type { ModalState, WorkspaceData } from "../../types/domain";
import { memberStatus } from "../../utils/members";
import { seatCodes } from "../../utils/seats";
import {
  configuredShifts,
  demoOccupiesShift,
  memberOccupiesShift,
  shiftTiming,
} from "../../utils/shifts";

export function ShiftPicker({
  data,
  shift,
  setShift,
}: {
  data: WorkspaceData;
  shift: string;
  setShift: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1.5"
      role="group"
      aria-label="Select shift"
    >
      {configuredShifts(data.settings).map((option) => (
        <button
          key={option.id}
          type="button"
          title={shiftTiming(option)}
          onClick={() => setShift(option.name)}
          className={`min-w-max rounded-xl px-3.5 py-2 text-left transition ${shift === option.name ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          <span className="block text-sm font-extrabold">{option.name}</span>
          <small className="block text-[11px] font-semibold opacity-70">
            {shiftTiming(option)}
          </small>
        </button>
      ))}
    </div>
  );
}

export function SeatLegend() {
  const items: Array<[StatusPillTone, string]> = [
    ["occupied", "Occupied"],
    ["overdue", "Payment overdue"],
    ["due", "Renewal due"],
    ["demo", "Demo"],
    ["available", "Available"],
  ];
  return (
    <div className="flex flex-wrap gap-2 text-xs font-bold">
      {items.map(([tone, label]) => (
        <StatusPill tone={tone} key={label}>
          {label}
        </StatusPill>
      ))}
    </div>
  );
}

export function SeatGrid({
  data,
  shift,
  compact = false,
  setModal,
}: {
  data: WorkspaceData;
  shift: string;
  compact?: boolean;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const members = data.members.filter((member) =>
    memberOccupiesShift(member, shift, data.settings.shifts),
  );
  const demos = data.demoSeats.filter((demo) =>
    demoOccupiesShift(demo, shift, data.settings.shifts),
  );
  return (
    <div
      className={`grid gap-2.5 ${compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-5 xl:grid-cols-6"}`}
    >
      {seatCodes(data.settings).map((seat) => {
        const member = members.find((item) => item.seat === seat);
        const demo = demos.find((item) => item.seat === seat);
        const paymentStatus = member ? memberStatus(member, data.fees) : null;
        const status = !member
          ? demo
            ? "demo"
            : "available"
          : paymentStatus?.tone === "overdue"
            ? "overdue"
            : paymentStatus?.tone === "due"
              ? "due"
              : "occupied";
        const colors = {
          available:
            "status-available-surface border-dashed hover:brightness-95",
          occupied:
            "border-transparent bg-[var(--brand)] text-[var(--button-text)] hover:brightness-110",
          overdue: "status-danger-solid hover:brightness-90",
          due: "status-warning-solid hover:brightness-95",
          demo: "status-demo-solid hover:brightness-95",
        }[status];
        return (
          <button
            key={seat}
            type="button"
            onClick={() =>
              setModal(
                member
                  ? { type: "info", id: member.id }
                  : { type: "seat-actions", seat, shift },
              )
            }
            className={`min-h-17 rounded-xl border p-2 text-center transition ${colors}`}
            title={
              member
                ? `${member.name} · ${paymentStatus?.label}`
                : demo
                  ? `${demo.name || "Demo"} · ${demo.shift}`
                  : "Available"
            }
            aria-label={
              member
                ? `${seat}, ${member.name}, ${paymentStatus?.label}`
                : demo
                  ? `${seat}, ${demo.name || "demo"}, demo, ${demo.shift}`
                  : `${seat}, available`
            }
          >
            <span className="block text-sm font-extrabold">{seat}</span>
            {!compact && (
              <small className="mt-0.5 block truncate text-xs font-semibold opacity-75">
                {member
                  ? member.name.split(" ")[0]
                  : demo
                    ? demo.name?.split(" ")[0] || "Demo"
                    : "Free"}
              </small>
            )}
          </button>
        );
      })}
    </div>
  );
}
