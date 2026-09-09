import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  variant?: Variant;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "border-transparent bg-[var(--brand,#334155)] text-[var(--button-text,#fff)] shadow-sm hover:brightness-95",
  secondary:
    "border-[var(--accent,#e2e8f0)] bg-[var(--accent,#e2e8f0)] text-[var(--accent-text,#17202a)] hover:brightness-95",
  danger: "status-danger-surface status-danger-text hover:brightness-95",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
};

export function Button({
  loading = false,
  loadingLabel = "Please wait…",
  variant = "primary",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#334155)] disabled:opacity-55",
        variants[variant],
        className,
      )}
    >
      {loading && (
        <span
          className="size-4 animate-[spin_.7s_linear_infinite] rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      )}
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? loadingLabel : children}
      </span>
    </button>
  );
}
