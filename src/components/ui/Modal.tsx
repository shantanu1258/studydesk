import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { CloseIcon } from "./Icons";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
  alert?: boolean;
  closeOnBackdrop?: boolean;
  fixedLayout?: boolean;
}

export function Modal({
  children,
  onClose,
  labelledBy,
  alert = false,
  closeOnBackdrop = true,
  fixedLayout = false,
}: ModalProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) =>
        event.target === event.currentTarget && closeOnBackdrop && onClose()
      }
    >
      <section
        className={`max-h-[94dvh] w-full rounded-t-[1.5rem] bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-[1.5rem] sm:p-6 ${fixedLayout ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>
  );
}

export function ModalHeader({
  eyebrow,
  title,
  text,
  onClose,
  id = "modal-title",
}: {
  eyebrow: string;
  title: string;
  text?: string;
  onClose: () => void;
  id?: string;
}) {
  return (
    <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2
          id={id}
          className="mt-2 font-display text-2xl font-bold sm:text-3xl"
        >
          {title}
        </h2>
        {text && <p className="mt-2 text-sm text-slate-600">{text}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="icon-button"
        aria-label="Close"
      >
        <CloseIcon className="size-5" />
      </button>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | unknown;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };
  return (
    <Modal
      onClose={onCancel}
      labelledBy="confirm-title"
      alert
      closeOnBackdrop={!confirming}
    >
      <ModalHeader
        eyebrow="Please confirm"
        title={title}
        text={text}
        onClose={onCancel}
        id="confirm-title"
      />
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} loading={confirming}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
