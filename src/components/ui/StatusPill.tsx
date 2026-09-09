import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type StatusPillTone =
  | "active"
  | "due"
  | "overdue"
  | "neutral"
  | "occupied"
  | "available";

const toneStyles: Record<StatusPillTone, string> = {
  active: "border-emerald-700 bg-emerald-700 text-white",
  due: "status-warning-solid",
  overdue: "status-danger-solid",
  neutral: "border-slate-700 bg-slate-600 text-white",
  occupied: "border-[var(--brand)] bg-[var(--brand)] text-[var(--button-text)]",
  available: "border-slate-300 bg-slate-200 text-slate-700",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusPillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("status-pill border", toneStyles[tone], className)}>
      {children}
    </span>
  );
}
