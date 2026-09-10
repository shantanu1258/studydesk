import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Modal";
import { SectionJumpNav } from "../../components/ui/SectionJumpNav";
import { StatusPill } from "../../components/ui/StatusPill";
import {
  DEFAULT_DAILY_SHIFT,
  DEFAULT_MONTHLY_FEE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  SHIFT_TYPE_OPTIONS,
} from "../../config/constants";
import { useTeamController } from "../../controllers/useTeamController";
import type {
  AppUser,
  SeatSection,
  Shift,
  ShiftType,
  StorageMode,
  TeamMember,
  ToastTone,
  WorkspaceCommit,
  WorkspaceData,
  WorkspaceMutation,
} from "../../types/domain";
import { uid } from "../../utils/format";
import {
  normalizeSeatSections,
  seatCodes,
  seatCountFromSections,
  sectionRange,
  sectionSeatCodes,
} from "../../utils/seats";
import {
  labelConfiguredShifts,
  normalizeShifts,
  presetShift,
  shiftTiming,
  shiftsOverlap,
} from "../../utils/shifts";
import { normalizeColor } from "../../utils/theme";
import { DataBackupCard } from "./DataBackupCard";

type SeatDraft = Omit<SeatSection, "start" | "end" | "defaultFee"> & {
  start: number | string;
  end: number | string;
  defaultFee: number | string;
};
const findSeatConflict = (data: WorkspaceData, shifts: Shift[]) => {
  const active = data.members.filter((member) => member.active);
  for (let first = 0; first < active.length; first++)
    for (let second = first + 1; second < active.length; second++)
      if (
        active[first].seat === active[second].seat &&
        shiftsOverlap(shifts, active[first].shift, active[second].shift)
      )
        return [active[first], active[second]];
  return null;
};

const findDemoConflict = (data: WorkspaceData, shifts: Shift[]) => {
  const active = data.members.filter((member) => member.active);
  for (const demo of data.demoSeats) {
    const member = active.find(
      (item) =>
        item.seat === demo.seat &&
        shiftsOverlap(shifts, item.shift, demo.shift),
    );
    if (member)
      return `${demo.seat} is assigned to ${member.name} and also marked for demo in an overlapping shift.`;
  }
  for (let first = 0; first < data.demoSeats.length; first += 1)
    for (let second = first + 1; second < data.demoSeats.length; second += 1)
      if (
        data.demoSeats[first].seat === data.demoSeats[second].seat &&
        shiftsOverlap(
          shifts,
          data.demoSeats[first].shift,
          data.demoSeats[second].shift,
        )
      )
        return `${data.demoSeats[first].seat} has overlapping demo shifts. Stop one demo before changing the timings.`;
  return "";
};

interface Props {
  data: WorkspaceData;
  commit: WorkspaceCommit;
  storageMode: StorageMode;
  user: AppUser;
  showToast: (message: string, tone?: ToastTone) => void;
}

export function SettingsPage({
  data,
  commit,
  storageMode,
  user,
  showToast,
}: Props) {
  const [shiftDrafts, setShiftDrafts] = useState<Shift[]>(() =>
    normalizeShifts(data.settings.shifts),
  );
  const [seatDrafts, setSeatDrafts] = useState<SeatDraft[]>(() =>
    normalizeSeatSections(
      data.settings.seatSections,
      data.settings.seatCount,
      data.settings.prefix,
    ),
  );
  const [shiftError, setShiftError] = useState("");
  const [seatError, setSeatError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDaily, setConfirmDaily] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [primaryColor, setPrimaryColor] = useState(data.settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(
    data.settings.secondaryColor,
  );
  const team = useTeamController(data.settings.id, storageMode === "cloud");
  useEffect(
    () => setShiftDrafts(normalizeShifts(data.settings.shifts)),
    [data.settings.shifts],
  );
  useEffect(
    () =>
      setSeatDrafts(
        normalizeSeatSections(
          data.settings.seatSections,
          data.settings.seatCount,
          data.settings.prefix,
        ),
      ),
    [data.settings.seatSections, data.settings.seatCount, data.settings.prefix],
  );
  useEffect(() => {
    setPrimaryColor(data.settings.primaryColor);
    setSecondaryColor(data.settings.secondaryColor);
  }, [data.settings.primaryColor, data.settings.secondaryColor]);

  async function saveAction(
    name: string,
    mutation: WorkspaceMutation,
    message: string,
  ) {
    if (busy) return false;
    setBusy(name);
    try {
      return await commit(mutation, message);
    } finally {
      setBusy("");
    }
  }
  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveAction(
      "general",
      (next) => {
        next.settings.library = String(form.get("library") || "").trim();
        next.settings.feeCollection =
          form.get("feeCollection") === "later" ? "later" : "advance";
        next.settings.attendanceEnabled =
          form.get("attendanceEnabled") === "on";
        next.settings.trackDemoVisitors =
          form.get("trackDemoVisitors") === "on";
        next.settings.primaryColor = normalizeColor(
          String(form.get("primaryColor")),
          DEFAULT_PRIMARY_COLOR,
        );
        next.settings.secondaryColor = normalizeColor(
          String(form.get("secondaryColor")),
          DEFAULT_SECONDARY_COLOR,
        );
      },
      "Settings saved",
    );
  }

  const changeSeat = (id: string, field: keyof SeatDraft, value: string) => {
    setSeatError("");
    setSeatDrafts((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };
  function addSection() {
    const end = Math.max(0, ...seatDrafts.map((item) => Number(item.end) || 0));
    const used = new Set(seatDrafts.map((item) => item.prefix));
    const prefix =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((item) => !used.has(item)) ||
      "X";
    setSeatDrafts((current) => [
      ...current,
      {
        id: uid(),
        name: `Section ${prefix}`,
        prefix,
        start: end + 1,
        end: end + 10,
        defaultFee: DEFAULT_MONTHLY_FEE,
      },
    ]);
    setSeatError("");
  }
  function removeSection(section: SeatDraft) {
    if (seatDrafts.length === 1) {
      setSeatError("Keep at least one seat section.");
      return;
    }
    const assigned = data.members.find(
      (member) =>
        member.active &&
        new Set(
          sectionSeatCodes({
            ...section,
            start: Number(section.start),
            end: Number(section.end),
          }),
        ).has(member.seat),
    );
    if (assigned) {
      setSeatError(
        `${assigned.seat} is assigned to ${assigned.name}. Reassign that member first.`,
      );
      return;
    }
    const sectionSeats = new Set(
      sectionSeatCodes({
        ...section,
        start: Number(section.start),
        end: Number(section.end),
      }),
    );
    const demo = data.demoSeats.find((item) => sectionSeats.has(item.seat));
    if (demo) {
      setSeatError(`${demo.seat} is in demo use. Stop that demo first.`);
      return;
    }
    setSeatDrafts((current) =>
      current.filter((item) => item.id !== section.id),
    );
  }
  async function saveSections() {
    const cleaned = seatDrafts
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        prefix: item.prefix.trim().toUpperCase(),
        start: Number(item.start),
        end: Number(item.end),
        defaultFee: Number(item.defaultFee),
      }))
      .sort((a, b) => a.start - b.start);
    if (
      cleaned.some(
        (item) =>
          !item.name ||
          !/^[A-Z0-9]{1,3}$/.test(item.prefix) ||
          !Number.isInteger(item.start) ||
          !Number.isInteger(item.end) ||
          item.start < 1 ||
          item.end < item.start ||
          item.end > 999 ||
          !Number.isFinite(item.defaultFee) ||
          item.defaultFee < 0,
      )
    ) {
      setSeatError(
        "Each section needs a name, a 1–3 character prefix, a valid range from 1 to 999, and a default fee of zero or more.",
      );
      return;
    }
    if (new Set(cleaned.map((item) => item.prefix)).size !== cleaned.length) {
      setSeatError("Each seat section needs a different prefix.");
      return;
    }
    for (let index = 1; index < cleaned.length; index++)
      if (cleaned[index].start <= cleaned[index - 1].end) {
        setSeatError(
          `${cleaned[index - 1].name} and ${cleaned[index].name} have overlapping seat numbers.`,
        );
        return;
      }
    const count = seatCountFromSections(cleaned);
    if (count > 500) {
      setSeatError("A library can have up to 500 configured seats.");
      return;
    }
    const available = new Set(seatCodes({ seatSections: cleaned }));
    const missing = data.members.find(
      (member) => member.active && !available.has(member.seat),
    );
    if (missing) {
      setSeatError(
        `${missing.name} is using ${missing.seat}, outside these ranges. Reassign the member first.`,
      );
      return;
    }
    const missingDemo = data.demoSeats.find(
      (demo) => !available.has(demo.seat),
    );
    if (missingDemo) {
      setSeatError(
        `${missingDemo.seat} is in demo use outside these ranges. Stop that demo first.`,
      );
      return;
    }
    setSeatError("");
    const saved = await saveAction(
      "seats",
      (next) => {
        next.settings.seatSections = cleaned;
        next.settings.seatCount = count;
        next.settings.prefix = cleaned[0].prefix;
      },
      "Seat sections saved",
    );
    if (saved) setSeatDrafts(cleaned);
  }

  const changeShift = (id: string, field: keyof Shift, value: string) => {
    setShiftError("");
    setShiftDrafts((current) =>
      current.map((item) =>
        item.id !== id
          ? item
          : field === "type"
            ? presetShift(value as ShiftType, item.id)
            : { ...item, [field]: value },
      ),
    );
  };
  function addShift() {
    if (shiftDrafts.length >= 12) {
      setShiftError("A library can have up to 12 shifts.");
      return;
    }
    setShiftDrafts((current) => [...current, presetShift("Hour", uid())]);
  }
  function removeShift(item: Shift) {
    const saved = normalizeShifts(data.settings.shifts).find(
      (shift) => shift.id === item.id,
    );
    const assigned = data.members.filter(
      (member) =>
        member.active &&
        (member.shift === item.name || member.shift === saved?.name),
    ).length;
    if (assigned) {
      setShiftError(
        `${item.name} has ${assigned} active members. Move them before deleting this shift.`,
      );
      return;
    }
    const demos = data.demoSeats.filter(
      (demo) => demo.shift === item.name || demo.shift === saved?.name,
    ).length;
    if (demos) {
      setShiftError(
        `${item.name} has ${demos} demo ${demos === 1 ? "seat" : "seats"}. Stop them before deleting this shift.`,
      );
      return;
    }
    if (shiftDrafts.length === 1) {
      setShiftError("Keep at least one shift or use Daily only.");
      return;
    }
    setShiftDrafts((current) =>
      current.filter((shift) => shift.id !== item.id),
    );
  }
  function moveShift(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= shiftDrafts.length) return;
    setShiftDrafts((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function saveShifts() {
    const cleaned = labelConfiguredShifts(shiftDrafts).map((item) => ({
      ...item,
      name: item.name.trim(),
    }));
    if (cleaned.some((item) => !item.name)) {
      setShiftError("Every shift needs a name.");
      return;
    }
    const names = cleaned.map((item) => item.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      setShiftError(
        "Preset plans can be used once. Add multiple Hour plans when needed.",
      );
      return;
    }
    const invalid = cleaned.find(
      (item) =>
        Boolean(item.start) !== Boolean(item.end) ||
        (item.start && item.end && item.start >= item.end),
    );
    if (invalid) {
      setShiftError(`Give ${invalid.name} valid start and end times.`);
      return;
    }
    const previousById = new Map(
      normalizeShifts(data.settings.shifts).map((item) => [item.id, item]),
    );
    const renamed = new Map<string, string>();
    cleaned.forEach((item) => {
      const previous = previousById.get(item.id);
      if (previous && previous.name !== item.name)
        renamed.set(previous.name, item.name);
    });
    const projected = {
      ...data,
      members: data.members.map((member) => ({
        ...member,
        shift: renamed.get(member.shift) || member.shift,
      })),
      demoSeats: data.demoSeats.map((demo) => ({
        ...demo,
        shift: renamed.get(demo.shift) || demo.shift,
      })),
    };
    const conflict = findSeatConflict(projected, cleaned);
    if (conflict) {
      setShiftError(
        `${conflict[0].seat} is used by ${conflict[0].name} and ${conflict[1].name}; their new timings overlap.`,
      );
      return;
    }
    const demoConflict = findDemoConflict(projected, cleaned);
    if (demoConflict) {
      setShiftError(demoConflict);
      return;
    }
    setShiftError("");
    await saveAction(
      "shifts",
      (next) => {
        next.members.forEach((member) => {
          member.shift = renamed.get(member.shift) || member.shift;
        });
        next.demoSeats.forEach((demo) => {
          demo.shift = renamed.get(demo.shift) || demo.shift;
        });
        next.settings.shifts = cleaned;
      },
      "Shifts saved",
    );
  }
  async function enableDaily() {
    const saved = await saveAction(
      "daily",
      (next) => {
        next.settings.shifts = [{ ...DEFAULT_DAILY_SHIFT }];
        next.members.forEach((member) => {
          member.shift = "Daily";
        });
        next.demoSeats = [
          ...new Map(
            next.demoSeats.map((demo) => [
              demo.seat,
              { ...demo, shift: "Daily" },
            ]),
          ).values(),
        ];
      },
      "Daily-only plan enabled",
    );
    if (saved) {
      setShiftDrafts([{ ...DEFAULT_DAILY_SHIFT }]);
      setConfirmDaily(false);
    }
    return saved;
  }
  function useDaily() {
    const used = new Set<string>();
    const duplicate = data.members.find(
      (member) =>
        member.active && (used.has(member.seat) || !used.add(member.seat)),
    );
    if (duplicate) {
      setShiftError(
        `${duplicate.seat} has more than one active member. Reassign the duplicate first.`,
      );
      return;
    }
    const memberDemoConflict = data.demoSeats.find((demo) =>
      used.has(demo.seat),
    );
    if (memberDemoConflict) {
      setShiftError(
        `${memberDemoConflict.seat} is assigned to a member and also in demo use. Stop that demo before switching to Daily.`,
      );
      return;
    }
    if (data.members.some((member) => member.active)) setConfirmDaily(true);
    else void enableDaily();
  }
  async function makeInvite() {
    const invite = await team.createInvite();
    if (invite) showToast("Invitation code created");
  }
  async function copyInvite() {
    if (!team.invite) return;
    try {
      await navigator.clipboard.writeText(team.invite.code);
      showToast("Invitation code copied");
    } catch {
      showToast("Select the code and copy it manually", "warning");
    }
  }
  async function removeUser() {
    if (!removeTarget || !data.settings.isFounder) return;
    const removed = await team.removeUser(removeTarget);
    if (removed) {
      showToast(`${removeTarget.name} removed from the library`);
      setRemoveTarget(null);
    }
  }

  return (
    <section className="grid gap-5">
      <SectionJumpNav
        items={[
          { id: "settings-library", label: "Library setup" },
          { id: "settings-seats", label: "Seat sections" },
          { id: "settings-shifts", label: "Shifts & timings" },
          { id: "settings-backup", label: "Data & backup" },
          ...(storageMode === "cloud"
            ? [{ id: "settings-team", label: "Library team" }]
            : []),
        ]}
      />
      <form
        id="settings-library"
        className="panel scroll-mt-24 p-5 sm:p-6"
        onSubmit={saveGeneral}
      >
        <div className="section-title">
          <div>
            <h2>Library setup</h2>
            <p>Used throughout your workspace</p>
          </div>
        </div>
        <div className="mt-5 form-stack">
          <label>
            Library name
            <input
              name="library"
              required
              defaultValue={data.settings.library}
            />
          </label>
          <div className="form-grid">
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">
                Workspace colours
              </span>
              <button
                type="button"
                className="text-xs font-extrabold text-[var(--brand)] underline underline-offset-2"
                onClick={() => {
                  setPrimaryColor(DEFAULT_PRIMARY_COLOR);
                  setSecondaryColor(DEFAULT_SECONDARY_COLOR);
                }}
              >
                Reset colours
              </button>
            </div>
            <label>
              Primary colour
              <span className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                <input
                  className="!size-10 !min-h-0 !w-12 !border-0 !p-0"
                  name="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                />
                <small className="font-medium text-slate-500">
                  Navigation and buttons
                </small>
              </span>
            </label>
            <label>
              Secondary colour
              <span className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                <input
                  className="!size-10 !min-h-0 !w-12 !border-0 !p-0"
                  name="secondaryColor"
                  type="color"
                  value={secondaryColor}
                  onChange={(event) => setSecondaryColor(event.target.value)}
                />
                <small className="font-medium text-slate-500">
                  Highlights and badges
                </small>
              </span>
            </label>
          </div>
          <label>
            Fee collection
            <select
              name="feeCollection"
              defaultValue={data.settings.feeCollection}
            >
              <option value="advance">
                Advance — collect during admission
              </option>
              <option value="later">
                Collect later — admit without payment
              </option>
            </select>
          </label>
          <label className="flex cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-2xl bg-slate-100 p-4">
            <input
              className="!mt-1 !size-4 !min-h-0 !w-4"
              type="checkbox"
              name="attendanceEnabled"
              defaultChecked={data.settings.attendanceEnabled}
            />
            <span>
              <strong className="block">Enable attendance</strong>
              <small className="font-medium text-slate-600">
                Optional manual check-ins. Keep off if nobody monitors the desk.
              </small>
            </span>
          </label>
          <label className="flex cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-2xl bg-slate-100 p-4">
            <input
              className="!mt-1 !size-4 !min-h-0 !w-4"
              type="checkbox"
              name="trackDemoVisitors"
              defaultChecked={data.settings.trackDemoVisitors}
            />
            <span>
              <strong className="block">Track demo visitors</strong>
              <small className="font-medium text-slate-600">
                Ask for a visitor’s name and phone, then show them in the Demo
                tab until they are admitted or their demo is stopped.
              </small>
            </span>
          </label>
          <Button
            className="sm:justify-self-start"
            type="submit"
            disabled={Boolean(busy)}
            loading={busy === "general"}
          >
            Save changes
          </Button>
        </div>
      </form>
      <article id="settings-seats" className="panel scroll-mt-24 p-5 sm:p-6">
        <div className="section-title">
          <div>
            <h2>Seat sections</h2>
            <p>
              {data.settings.seatCount} seats across {seatDrafts.length}{" "}
              sections
            </p>
          </div>
          <Button variant="secondary" onClick={addSection}>
            + Add section
          </Button>
        </div>
        <div className="mt-5 grid gap-3">
          {seatDrafts.map((section) => (
            <div
              className="rounded-2xl border border-slate-200 p-4"
              key={section.id}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_90px_90px_90px_130px]">
                <label>
                  Section name
                  <input
                    value={section.name}
                    onChange={(event) =>
                      changeSeat(section.id, "name", event.target.value)
                    }
                  />
                </label>
                <label>
                  Prefix
                  <input
                    maxLength={3}
                    value={section.prefix}
                    onChange={(event) =>
                      changeSeat(
                        section.id,
                        "prefix",
                        event.target.value.toUpperCase(),
                      )
                    }
                  />
                </label>
                <label>
                  From
                  <input
                    type="number"
                    value={section.start}
                    onChange={(event) =>
                      changeSeat(section.id, "start", event.target.value)
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="number"
                    value={section.end}
                    onChange={(event) =>
                      changeSeat(section.id, "end", event.target.value)
                    }
                  />
                </label>
                <label>
                  Default fee (₹)
                  <input
                    type="number"
                    min={0}
                    value={section.defaultFee}
                    onChange={(event) =>
                      changeSeat(section.id, "defaultFee", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">
                  {sectionRange({
                    ...section,
                    start: Number(section.start),
                    end: Number(section.end),
                  })}
                </span>
                <button
                  className="status-danger-text text-sm font-extrabold"
                  onClick={() => removeSection(section)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="helper mt-4">
          Example: A-01–A-20 at ₹800 and B-21–B-40 at ₹1,200. The matching rate
          is suggested during admission.
        </p>
        <p className="field-error mt-2">{seatError}</p>
        <Button
          className="mt-2 w-full sm:w-auto"
          disabled={Boolean(busy)}
          loading={busy === "seats"}
          onClick={() => void saveSections()}
        >
          Save seat sections
        </Button>
      </article>
      <article id="settings-shifts" className="panel scroll-mt-24 p-5 sm:p-6">
        <div className="section-title">
          <div>
            <h2>Shifts & timings</h2>
            <p>Add timed plans, or keep one simple Daily plan</p>
          </div>
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            loading={busy === "daily"}
            onClick={useDaily}
          >
            Use Daily only
          </Button>
        </div>
        <div className="mt-5 grid gap-3">
          {labelConfiguredShifts(shiftDrafts).map((item, index) => (
            <div
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[70px_1fr_150px_150px_auto] md:items-end"
              key={item.id}
            >
              <div className="flex gap-1">
                <button
                  className="icon-button !size-9"
                  disabled={index === 0}
                  onClick={() => moveShift(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="icon-button !size-9"
                  disabled={index === shiftDrafts.length - 1}
                  onClick={() => moveShift(index, 1)}
                >
                  ↓
                </button>
              </div>
              <label>
                Plan type
                <select
                  value={item.type}
                  onChange={(event) =>
                    changeShift(item.id, "type", event.target.value)
                  }
                >
                  {SHIFT_TYPE_OPTIONS.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                  {item.type === "Daily" && <option>Daily</option>}
                  {item.type === "Custom" && <option>Custom</option>}
                </select>
              </label>
              <label>
                Starts
                <input
                  type="time"
                  value={item.start}
                  onChange={(event) =>
                    changeShift(item.id, "start", event.target.value)
                  }
                />
              </label>
              <label>
                Ends
                <input
                  type="time"
                  value={item.end}
                  onChange={(event) =>
                    changeShift(item.id, "end", event.target.value)
                  }
                />
              </label>
              <button
                className="status-danger-text min-h-11 text-sm font-extrabold"
                onClick={() => removeShift(item)}
              >
                Remove
              </button>
              <p className="text-sm font-bold text-slate-500 md:col-start-2 md:col-span-4">
                {item.name} · {shiftTiming(item)}
              </p>
            </div>
          ))}
        </div>
        <p className="helper mt-4">
          Hour plans may be added more than once and are numbered automatically.
          Overlapping plans share seat availability.
        </p>
        <p className="field-error mt-2">{shiftError}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={addShift}>
            + Add shift
          </Button>
          <Button
            disabled={Boolean(busy)}
            loading={busy === "shifts"}
            onClick={() => void saveShifts()}
          >
            Save shifts
          </Button>
        </div>
      </article>
      <div id="settings-backup" className="scroll-mt-24">
        <DataBackupCard data={data} commit={commit} storageMode={storageMode} />
      </div>
      {storageMode === "cloud" && (
        <article id="settings-team" className="panel scroll-mt-24 p-5 sm:p-6">
          <div className="section-title">
            <div>
              <h2>Library team</h2>
            </div>
            <Button
              disabled={team.busy}
              loading={team.busy && !removeTarget}
              onClick={() => void makeInvite()}
            >
              Create invite code
            </Button>
          </div>
          {team.invite && (
            <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="eyebrow">One-time code</span>
                <strong className="mt-1 block font-mono text-2xl tracking-widest">
                  {team.invite.code}
                </strong>
                <small className="text-slate-500">
                  Valid for 7 days or until used
                </small>
              </div>
              <Button variant="secondary" onClick={() => void copyInvite()}>
                Copy code
              </Button>
            </div>
          )}
          <div className="mt-5 divide-y divide-slate-200">
            {team.members.map((member) => (
              <div
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={member.id}
              >
                <div>
                  <strong>{member.name}</strong>
                  <span className="block text-sm text-slate-600">
                    {member.email}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {member.founder ? (
                    <StatusPill tone="neutral">
                      Core admin{member.id === user.id ? " · You" : ""} ·
                      protected
                    </StatusPill>
                  ) : (
                    <>
                      <StatusPill tone="neutral">
                        Admin{member.id === user.id ? " · You" : ""}
                      </StatusPill>
                      {data.settings.isFounder && member.id !== user.id && (
                        <Button
                          variant="danger"
                          onClick={() => setRemoveTarget(member)}
                        >
                          Remove
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!team.members.length && !team.error && (
            <p className="helper mt-4">Loading library users…</p>
          )}
          {team.error && <p className="field-error mt-4">{team.error}</p>}
          <p className="helper mt-4">
            Share the code privately. It works once; a new code cancels the
            previous unused one.
          </p>
        </article>
      )}
      {removeTarget && (
        <ConfirmDialog
          title={`Remove ${removeTarget.name}?`}
          text="They will immediately lose access to this library. Their account remains active."
          confirmLabel="Remove user"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={removeUser}
        />
      )}
      {confirmDaily && (
        <ConfirmDialog
          title="Switch everyone to Daily?"
          text="All active members will move to one 07:00–23:00 plan. You can change the hours later."
          confirmLabel="Use Daily only"
          onCancel={() => setConfirmDaily(false)}
          onConfirm={enableDaily}
        />
      )}
    </section>
  );
}
