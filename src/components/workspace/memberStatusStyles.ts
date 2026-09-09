import type { memberStatus } from "../../utils/members";

type MemberStatusTone = ReturnType<typeof memberStatus>["tone"];

export const statusSurfaceStyles: Record<MemberStatusTone, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-950",
  due: "status-warning-surface status-warning-text",
  overdue: "status-danger-surface status-danger-text",
  neutral: "border-slate-200 bg-slate-100 text-slate-800",
};
