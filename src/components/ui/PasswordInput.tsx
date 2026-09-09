import { useState, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { EyeIcon, EyeOffIcon } from "./Icons";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({
  className,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <span className="relative block min-w-0">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
        disabled={disabled}
      />
      <button
        type="button"
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? (
          <EyeOffIcon className="size-5" />
        ) : (
          <EyeIcon className="size-5" />
        )}
      </button>
    </span>
  );
}
