import {
  DEFAULT_ATTENDANCE_ENABLED,
  DEFAULT_FEE_COLLECTION,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEMO_USER,
} from "../config/constants";
import { seedData } from "../data/seed";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../infrastructure/supabase/client";
import type {
  AppUser,
  AttendanceRecord,
  LibrarySettings,
  Member,
  Payment,
  PaymentMode,
  WorkspaceChangeSet,
  WorkspaceData,
} from "../types/domain";
import { addMonths, monthsBetween } from "../utils/format";
import { normalizeSeatSections, seatCountFromSections } from "../utils/seats";
import { normalizeShifts } from "../utils/shifts";
import { normalizeColor } from "../utils/theme";
import {
  loadLocalWorkspace,
  saveLocalWorkspace,
} from "./localStorageRepository";

type DbRow = Record<string, any>;

function assertResult(result: { error: { message: string } | null }) {
  if (result.error) throw result.error;
}

function changedRows<T extends { id: string }>(previous: T[], next: T[]) {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return next.filter(
    (row) => JSON.stringify(previousById.get(row.id)) !== JSON.stringify(row),
  );
}

function removedIds<T extends { id: string }>(previous: T[], next: T[]) {
  const nextIds = new Set(next.map((row) => row.id));
  return previous.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
}

const memberToRow = (member: Member, libraryId: string) => ({
  id: member.id,
  library_id: libraryId,
  name: member.name,
  phone: member.phone,
  seat_code: member.seat,
  shift: member.shift,
  monthly_fee: Number(member.fee),
  start_date: member.start,
  plan_start_date: member.planStart || member.start,
  plan_months: Number(member.planMonths) || 1,
  expiry_date: member.expiry,
  active: member.active,
});

const paymentToRow = (
  payment: Payment,
  libraryId: string,
  members: Member[],
) => ({
  id: payment.id,
  library_id: libraryId,
  member_id: payment.memberId,
  seat_code:
    payment.seat ||
    members.find((member) => member.id === payment.memberId)?.seat ||
    null,
  member_name:
    payment.memberName ||
    members.find((member) => member.id === payment.memberId)?.name ||
    "Member",
  amount_inr: Number(payment.amount),
  paid_on: payment.date,
  payment_mode: payment.mode,
  period_start: payment.periodStart || payment.date,
  period_months: Number(payment.periodMonths) || 1,
  period_end:
    payment.periodEnd ||
    addMonths(payment.periodStart || payment.date, payment.periodMonths || 1),
});

const attendanceToRow = (record: AttendanceRecord, libraryId: string) => ({
  id: record.id,
  library_id: libraryId,
  member_id: record.memberId,
  attendance_date: record.date,
  check_in: record.in || null,
  check_out: record.out || null,
});

const rowToMember = (row: DbRow): Member => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  seat: row.seat_code,
  shift: row.shift,
  fee: Number(row.monthly_fee),
  start: row.start_date,
  planStart: row.plan_start_date || row.start_date,
  planMonths:
    row.plan_months ||
    monthsBetween(row.plan_start_date || row.start_date, row.expiry_date),
  expiry: row.expiry_date,
  active: row.active,
});

const rowToPayment = (row: DbRow): Payment => ({
  id: row.id,
  memberId: row.member_id,
  seat: row.seat_code || "",
  memberName: row.member_name || "",
  amount: Number(row.amount_inr),
  date: row.paid_on,
  mode: row.payment_mode as PaymentMode,
  periodStart: row.period_start || row.paid_on,
  periodMonths: row.period_months || 1,
  periodEnd:
    row.period_end ||
    addMonths(row.period_start || row.paid_on, row.period_months || 1),
});

const rowToAttendance = (row: DbRow): AttendanceRecord => ({
  id: row.id,
  memberId: row.member_id,
  date: row.attendance_date,
  in: row.check_in?.slice(0, 5) || "",
  out: row.check_out?.slice(0, 5) || "",
});

export const isDemoUser = (user: AppUser) =>
  user.id === DEMO_USER.id || user.storage === "demo";

export function normalizeWorkspace(workspace: WorkspaceData): WorkspaceData {
  const seatSections = normalizeSeatSections(
    workspace.settings?.seatSections,
    workspace.settings?.seatCount,
    workspace.settings?.prefix,
  );
  const members = (workspace.members || []).map((member) => ({
    ...member,
    planStart: member.planStart || member.start,
    planMonths:
      Number(member.planMonths) || monthsBetween(member.start, member.expiry),
  }));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const fees = (workspace.fees || []).map((payment) => ({
    ...payment,
    seat: payment.seat || memberById.get(payment.memberId)?.seat || "",
    memberName:
      payment.memberName || memberById.get(payment.memberId)?.name || "Member",
    periodStart: payment.periodStart || payment.date,
    periodMonths: Number(payment.periodMonths) || 1,
    periodEnd:
      payment.periodEnd ||
      addMonths(payment.periodStart || payment.date, payment.periodMonths || 1),
  }));

  return {
    ...workspace,
    members,
    fees,
    settings: {
      ...workspace.settings,
      seatSections,
      seatCount: seatCountFromSections(seatSections),
      prefix: seatSections[0].prefix,
      shifts: normalizeShifts(workspace.settings?.shifts),
      feeCollection:
        workspace.settings?.feeCollection === "later"
          ? "later"
          : DEFAULT_FEE_COLLECTION,
      attendanceEnabled:
        workspace.settings?.attendanceEnabled ?? DEFAULT_ATTENDANCE_ENABLED,
      primaryColor: normalizeColor(
        workspace.settings?.primaryColor,
        DEFAULT_PRIMARY_COLOR,
      ),
      secondaryColor: normalizeColor(
        workspace.settings?.secondaryColor,
        DEFAULT_SECONDARY_COLOR,
      ),
      isFounder: workspace.settings?.isFounder !== false,
    },
  };
}

export function buildWorkspaceChanges(
  previous: WorkspaceData,
  next: WorkspaceData,
): WorkspaceChangeSet {
  const libraryId = previous.settings.id || next.settings.id;
  if (!libraryId)
    throw new Error("The library workspace is missing its database ID.");

  const settingsChanged =
    previous.settings.library !== next.settings.library ||
    previous.settings.seatCount !== next.settings.seatCount ||
    previous.settings.prefix !== next.settings.prefix ||
    previous.settings.feeCollection !== next.settings.feeCollection ||
    previous.settings.attendanceEnabled !== next.settings.attendanceEnabled ||
    previous.settings.primaryColor !== next.settings.primaryColor ||
    previous.settings.secondaryColor !== next.settings.secondaryColor ||
    JSON.stringify(
      normalizeSeatSections(
        previous.settings.seatSections,
        previous.settings.seatCount,
        previous.settings.prefix,
      ),
    ) !==
      JSON.stringify(
        normalizeSeatSections(
          next.settings.seatSections,
          next.settings.seatCount,
          next.settings.prefix,
        ),
      ) ||
    JSON.stringify(normalizeShifts(previous.settings.shifts)) !==
      JSON.stringify(normalizeShifts(next.settings.shifts));

  return {
    p_library_id: libraryId,
    p_settings: settingsChanged
      ? {
          name: next.settings.library,
          seat_count: Number(next.settings.seatCount),
          seat_prefix: next.settings.prefix,
          shift_definitions: normalizeShifts(next.settings.shifts),
          fee_collection:
            next.settings.feeCollection === "later"
              ? "later"
              : DEFAULT_FEE_COLLECTION,
          attendance_enabled: next.settings.attendanceEnabled === true,
          primary_color: normalizeColor(
            next.settings.primaryColor,
            DEFAULT_PRIMARY_COLOR,
          ),
          secondary_color: normalizeColor(
            next.settings.secondaryColor,
            DEFAULT_SECONDARY_COLOR,
          ),
          seat_sections: normalizeSeatSections(
            next.settings.seatSections,
            next.settings.seatCount,
            next.settings.prefix,
          ),
        }
      : null,
    p_members: changedRows(previous.members, next.members).map((row) =>
      memberToRow(row, libraryId),
    ),
    p_payments: changedRows(previous.fees, next.fees).map((row) =>
      paymentToRow(row, libraryId, next.members),
    ),
    p_attendance: changedRows(previous.attendance, next.attendance).map((row) =>
      attendanceToRow(row, libraryId),
    ),
    p_deleted_member_ids: removedIds(previous.members, next.members),
    p_deleted_payment_ids: removedIds(previous.fees, next.fees),
    p_deleted_attendance_ids: removedIds(previous.attendance, next.attendance),
  };
}

export const workspaceRepository = {
  mode(user: AppUser) {
    return isDemoUser(user) ? ("demo" as const) : ("cloud" as const);
  },

  async load(user: AppUser): Promise<WorkspaceData> {
    if (isDemoUser(user)) return normalizeWorkspace(loadLocalWorkspace(user));
    if (!isSupabaseConfigured())
      throw new Error("Supabase has not been connected yet.");

    const client = getSupabaseClient();
    const libraryResult = await client
      .from("libraries")
      .select("*")
      .limit(1)
      .maybeSingle();
    assertResult(libraryResult);
    const library = libraryResult.data;
    if (!library) {
      throw new Error(
        "No library workspace was found. Run the supplied Supabase schema, then create the account again.",
      );
    }

    const [membersResult, paymentsResult, attendanceResult] = await Promise.all(
      [
        client
          .from("members")
          .select("*")
          .eq("library_id", library.id)
          .order("name"),
        client
          .from("payments")
          .select("*")
          .eq("library_id", library.id)
          .order("paid_on"),
        client
          .from("attendance")
          .select("*")
          .eq("library_id", library.id)
          .order("attendance_date"),
      ],
    );
    [membersResult, paymentsResult, attendanceResult].forEach(assertResult);

    return normalizeWorkspace({
      settings: {
        id: library.id,
        seatCount: library.seat_count,
        prefix: library.seat_prefix,
        seatSections: library.seat_sections,
        library: library.name,
        shifts: library.shift_definitions,
        feeCollection: library.fee_collection,
        attendanceEnabled: library.attendance_enabled,
        primaryColor: library.primary_color,
        secondaryColor: library.secondary_color,
        isFounder: library.owner_id === user.id,
      },
      members: (membersResult.data || []).map(rowToMember),
      fees: (paymentsResult.data || []).map(rowToPayment),
      attendance: (attendanceResult.data || []).map(rowToAttendance),
    });
  },

  async persist(user: AppUser, previous: WorkspaceData, next: WorkspaceData) {
    if (isDemoUser(user)) {
      saveLocalWorkspace(user.id, next);
      return;
    }
    const result = await getSupabaseClient().rpc(
      "apply_workspace_changes",
      buildWorkspaceChanges(previous, next),
    );
    assertResult(result);
  },

  fresh(user: AppUser, settings: LibrarySettings) {
    const workspace = seedData(
      settings.library || user.library,
      !isDemoUser(user),
    );
    workspace.settings = {
      ...workspace.settings,
      ...settings,
      shifts: normalizeShifts(settings.shifts),
      feeCollection:
        settings.feeCollection === "later" ? "later" : DEFAULT_FEE_COLLECTION,
      attendanceEnabled: settings.attendanceEnabled === true,
      primaryColor: normalizeColor(
        settings.primaryColor,
        DEFAULT_PRIMARY_COLOR,
      ),
      secondaryColor: normalizeColor(
        settings.secondaryColor,
        DEFAULT_SECONDARY_COLOR,
      ),
      seatSections: normalizeSeatSections(
        settings.seatSections,
        settings.seatCount,
        settings.prefix,
      ),
    };
    workspace.settings.seatCount = seatCountFromSections(
      workspace.settings.seatSections,
    );
    workspace.settings.prefix = workspace.settings.seatSections[0].prefix;
    return workspace;
  },
};
