import { useEffect, useState } from "react";
import type { ToastMessage } from "../../types/domain";
import { AlertIcon, CheckIcon, CloseIcon } from "./Icons";

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(false);
    const enter = requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => setVisible(false), 2700);
    const remove = window.setTimeout(onDismiss, 3000);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;
  const error = toast.tone === "error";
  const warning = toast.tone === "warning";
  const colors = error
    ? "status-danger-surface status-danger-text"
    : warning
      ? "status-warning-surface status-warning-text"
      : "border-emerald-200 bg-white text-slate-900";
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-[70] flex justify-center md:inset-x-auto md:right-5 md:justify-end"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border p-3.5 shadow-xl transition duration-300 ease-out motion-reduce:transition-none ${colors} ${visible ? "translate-y-0 opacity-100 md:translate-x-0" : "-translate-y-5 opacity-0 md:translate-x-8 md:translate-y-0"}`}
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${error ? "status-danger-surface status-danger-text" : warning ? "status-warning-surface status-warning-text" : "bg-emerald-100 text-emerald-800"}`}
        >
          {error || warning ? (
            <AlertIcon className="size-5" />
          ) : (
            <CheckIcon className="size-5" />
          )}
        </span>
        <p className="flex-1 text-sm font-bold">{toast.message}</p>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-black/5"
          onClick={() => setVisible(false)}
          aria-label="Dismiss notification"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
