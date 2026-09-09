import { cn } from "../../lib/cn";
import { CloseIcon, SearchIcon } from "./Icons";

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
  className,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="min-h-11 rounded-xl border-slate-300 bg-slate-50 py-2.5 pl-11 pr-11 text-sm font-semibold placeholder:font-medium placeholder:text-slate-500 focus:bg-white"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          aria-label="Clear search"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
