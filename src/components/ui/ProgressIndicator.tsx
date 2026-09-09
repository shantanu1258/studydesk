interface ProgressIndicatorProps {
  label: string;
  value: string;
  percent: number;
  demoPercent?: number;
  className?: string;
  tone?: "brand" | "positive";
}

const fillColors = {
  brand: "bg-[var(--brand)]",
  positive: "bg-emerald-600",
};

export function ProgressIndicator({
  label,
  value,
  percent,
  demoPercent = 0,
  className = "",
  tone = "brand",
}: ProgressIndicatorProps) {
  const safePercent = Math.max(0, Math.min(percent, 100));
  const safeDemoPercent = Math.max(0, Math.min(demoPercent, 100 - safePercent));
  const totalPercent = safePercent + safeDemoPercent;
  return (
    <div className={`w-full sm:w-64 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-600">{label}</span>
        <strong className="whitespace-nowrap text-slate-900">{value}</strong>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={totalPercent}
        aria-valuetext={value}
      >
        <div
          className={`h-full transition-[width] duration-300 ${fillColors[tone]}`}
          style={{ width: `${safePercent}%` }}
        />
        {safeDemoPercent > 0 && (
          <div
            className="h-full bg-[var(--status-demo)] transition-[width] duration-300"
            style={{ width: `${safeDemoPercent}%` }}
            title={`${safeDemoPercent}% demo`}
          />
        )}
      </div>
    </div>
  );
}
