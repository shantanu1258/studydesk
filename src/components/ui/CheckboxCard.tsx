import type { ReactNode } from "react";

interface Props {
  name: string;
  defaultChecked?: boolean;
  title: ReactNode;
  description: ReactNode;
}

export function CheckboxCard({
  name,
  defaultChecked = false,
  title,
  description,
}: Props) {
  return (
    <label className="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 rounded-2xl bg-slate-100 p-4">
      <input
        className="peer sr-only"
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
      />
      <span
        aria-hidden="true"
        className="mt-1 grid size-5 place-items-center rounded border-2 border-slate-400 bg-[var(--surface-input)] transition peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand)] peer-focus-visible:ring-offset-2"
      >
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--surface-input)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3 8 3 3 7-7" />
        </svg>
      </span>
      <span className="min-w-0">
        <strong className="block">{title}</strong>
        <small className="font-medium text-slate-600">{description}</small>
      </span>
    </label>
  );
}
