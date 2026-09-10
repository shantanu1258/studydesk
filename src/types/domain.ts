export type StorageMode = "cloud" | "demo";
export type FeeCollectionMode = "advance" | "later";
export type ViewId =
  | "overview"
  | "members"
  | "fees"
  | "search"
  | "attendance"
  | "settings";
export type ShiftType =
  | "Morning"
  | "Afternoon"
  | "Evening"
  | "Full Day"
  | "Hour"
  | "Daily"
  | "Custom";

export interface AppUser {
  id: string;
  name: string;
  library: string;
  email: string;
  storage: StorageMode;
  avatarUrl?: string;
}

export interface ProfileUpdateInput {
  name: string;
  photo?: File | null;
  removePhoto?: boolean;
}

export interface Shift {
  id: string;
  type: ShiftType;
  name: string;
  start: string;
  end: string;
}

export interface SeatSection {
  id: string;
  name: string;
  prefix: string;
  start: number;
  end: number;
  defaultFee: number;
}

export interface SeatDemo {
  id: string;
  seat: string;
  shift: string;
  name?: string;
  phone?: string;
}

export interface LibrarySettings {
  id?: string;
  seatCount: number;
  prefix: string;
  seatSections: SeatSection[];
  library: string;
  shifts: Shift[];
  feeCollection: FeeCollectionMode;
  attendanceEnabled: boolean;
  trackDemoVisitors: boolean;
  primaryColor: string;
  secondaryColor: string;
  isFounder: boolean;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  seat: string;
  shift: string;
  fee: number;
  start: string;
  planStart: string;
  planMonths: number;
  expiry: string;
  active: boolean;
}

export type PaymentMode = "UPI" | "Cash" | "Card" | "Bank transfer";

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  seat: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  periodStart: string;
  periodMonths: number;
  periodEnd: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  date: string;
  in: string;
  out: string;
}

export interface WorkspaceData {
  settings: LibrarySettings;
  members: Member[];
  fees: Payment[];
  attendance: AttendanceRecord[];
  demoSeats: SeatDemo[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  founder: boolean;
  joinedAt: string;
}

export interface LibraryInvite {
  code: string;
  expiresAt: string;
}

export type ModalState =
  | { type: "member"; seat?: string; shift?: string; demoId?: string }
  | { type: "member-reactivate"; id: string }
  | { type: "info"; id: string }
  | { type: "member-fees"; id: string }
  | { type: "renew"; id: string }
  | { type: "member-edit"; id: string }
  | { type: "seat-change"; id: string }
  | { type: "seat-actions"; seat: string; shift: string }
  | { type: "member-deactivate"; id: string }
  | { type: "payment-edit"; id: string; returnToMemberId?: string }
  | { type: "payment-delete"; id: string };

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
  library?: string;
  seatCount?: number;
  primaryColor?: string;
  secondaryColor?: string;
  inviteCode?: string;
}

export interface SignUpResult {
  user: AppUser | null;
  needsEmailConfirmation: boolean;
}

export type WorkspaceMutation = (draft: WorkspaceData) => void;
export type WorkspaceCommit = (
  mutation: WorkspaceMutation,
  message?: string,
) => Promise<boolean>;

export interface WorkspaceChangeSet {
  p_library_id: string;
  p_settings: Record<string, unknown> | null;
  p_members: Record<string, unknown>[];
  p_payments: Record<string, unknown>[];
  p_attendance: Record<string, unknown>[];
  p_demo_seats: Record<string, unknown>[];
  p_deleted_member_ids: string[];
  p_deleted_payment_ids: string[];
  p_deleted_attendance_ids: string[];
  p_deleted_demo_seat_ids: string[];
}
