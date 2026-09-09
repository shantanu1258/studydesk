import { DEFAULT_SHIFTS, SHIFT_PRESETS } from "../config/constants";
import type {
  LibrarySettings,
  Member,
  SeatDemo,
  Shift,
  ShiftType,
} from "../types/domain";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const stableId = (name: string, index: number) => {
  const slug = String(name || "shift")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "shift"}-${index + 1}`;
};

export function shiftType(shift?: Partial<Shift>): ShiftType {
  const explicit = String(shift?.type || "").trim() as ShiftType;
  if (explicit in SHIFT_PRESETS) return explicit;

  const name = String(shift?.name || "").trim() as ShiftType;
  if (name in SHIFT_PRESETS) return name;
  if (/^hour(?:\s|$)/i.test(name)) return "Hour";
  return "Custom";
}

export function presetShift(type: ShiftType, id: string): Shift {
  const safeType = type in SHIFT_PRESETS && type !== "Custom" ? type : "Hour";
  const timing = SHIFT_PRESETS[safeType];
  return {
    id,
    type: safeType,
    name: safeType,
    start: timing.start,
    end: timing.end,
  };
}

export function normalizeShifts(
  value?: Array<Partial<Shift> | string> | null,
): Shift[] {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_SHIFTS;
  const usedIds = new Set<string>();

  return source
    .slice(0, 12)
    .map((shift, index) => {
      const item: Partial<Shift> =
        typeof shift === "string" ? { name: shift } : shift || {};
      const name = String(item.name || "").trim();
      let id = String(item.id || stableId(name, index));
      while (usedIds.has(id)) id = `${id}-${index + 1}`;
      usedIds.add(id);
      return {
        id,
        type: shiftType(item),
        name,
        start: timePattern.test(item.start || "") ? item.start || "" : "",
        end: timePattern.test(item.end || "") ? item.end || "" : "",
      };
    })
    .filter((shift) => shift.name);
}

export function labelConfiguredShifts(
  value?: Array<Partial<Shift> | string> | null,
) {
  let hourNumber = 0;
  return normalizeShifts(value).map((shift) => {
    if (shift.type === "Hour") {
      hourNumber += 1;
      const timing =
        shift.start && shift.end ? ` (${shift.start}–${shift.end})` : "";
      return { ...shift, name: `Hour ${hourNumber}${timing}` };
    }
    if (shift.type in SHIFT_PRESETS) return { ...shift, name: shift.type };
    return shift;
  });
}

export const configuredShifts = (settings: Pick<LibrarySettings, "shifts">) =>
  normalizeShifts(settings.shifts);

const minutes = (time: string) => {
  const [hours, value] = time.split(":").map(Number);
  return hours * 60 + value;
};

export function shiftsOverlap(
  shifts: Shift[],
  firstName: string,
  secondName: string,
) {
  if (firstName === secondName) return true;

  const normalized = normalizeShifts(shifts);
  const first = normalized.find((item) => item.name === firstName);
  const second = normalized.find((item) => item.name === secondName);
  if (!first || !second) return false;

  if (!first.start || !first.end || !second.start || !second.end) return true;
  return (
    minutes(first.start) < minutes(second.end) &&
    minutes(second.start) < minutes(first.end)
  );
}

export const memberOccupiesShift = (
  member: Member,
  selectedShift: string,
  shifts: Shift[],
) => member.active && shiftsOverlap(shifts, member.shift, selectedShift);

export const demoOccupiesShift = (
  demo: SeatDemo,
  selectedShift: string,
  shifts: Shift[],
) => shiftsOverlap(shifts, demo.shift, selectedShift);

export const shiftTiming = (shift: Shift) =>
  shift.start && shift.end ? `${shift.start}–${shift.end}` : "All day";
