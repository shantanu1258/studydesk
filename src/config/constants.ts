import type { AppUser, Shift, ShiftType, ViewId } from "../types/domain";

export const STORAGE_KEYS = {
  session: "studydesk_session_v2",
  data: "studydesk_data_v2_",
} as const;

export const DEMO_USER: AppUser = {
  id: "demo",
  name: "Arjun Sharma",
  library: "The Focus Room",
  email: "demo@studydesk.in",
  storage: "demo",
};

export const DEFAULT_DAILY_SHIFT: Shift = {
  id: "daily",
  type: "Daily",
  name: "Daily",
  start: "07:00",
  end: "23:00",
};

export const SHIFT_PRESETS: Record<
  Exclude<ShiftType, "Custom">,
  Pick<Shift, "start" | "end">
> = {
  Morning: { start: "06:00", end: "13:00" },
  Afternoon: { start: "13:00", end: "17:00" },
  Evening: { start: "17:00", end: "21:00" },
  "Full Day": { start: "07:00", end: "23:00" },
  Hour: { start: "08:00", end: "09:00" },
  Daily: { start: "07:00", end: "23:00" },
};

export const SHIFT_TYPE_OPTIONS: ShiftType[] = [
  "Morning",
  "Afternoon",
  "Evening",
  "Full Day",
  "Hour",
];

export const DEFAULT_SHIFTS: Shift[] = [
  {
    id: "morning",
    type: "Morning",
    name: "Morning",
    start: "06:00",
    end: "13:00",
  },
  {
    id: "evening",
    type: "Evening",
    name: "Evening",
    start: "13:00",
    end: "21:00",
  },
  {
    id: "full-day",
    type: "Full Day",
    name: "Full Day",
    start: "07:00",
    end: "23:00",
  },
];

export const DEFAULT_FEE_COLLECTION = "advance" as const;
export const DEFAULT_ATTENDANCE_ENABLED = false;
export const DEFAULT_PRIMARY_COLOR = "#334155";
export const DEFAULT_SECONDARY_COLOR = "#E2E8F0";

export const NAV_ITEMS: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "fees", label: "Fees" },
  { id: "attendance", label: "Attendance" },
  { id: "settings", label: "Settings" },
];
