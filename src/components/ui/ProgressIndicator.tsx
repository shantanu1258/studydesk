interface ProgressIndicatorProps {
  label: string;
  value: string;
  percent: number;
  className?: string;
}

export function ProgressIndicator({
  label,
  value,
  percent,
  className = "",
}: ProgressIndicatorProps) {
  const safePercent = Math.max(0, Math.min(percent, 100));
  return (
    <div className={`w-full sm:w-56 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-600">{label}</span>
        <strong className="text-slate-900">{value}</strong>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercent}
      >
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}
