import {
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, Modal, ModalHeader } from "../../components/ui/Modal";
import { MAINTENANCE_CATEGORIES } from "../../config/constants";
import type {
  MaintenanceCategory,
  MaintenanceExpense,
  ModalState,
  WorkspaceCommit,
  WorkspaceData,
} from "../../types/domain";
import { localDate, money, prettyDate, uid } from "../../utils/format";

export const isMaintenanceModal = (modal: ModalState) =>
  modal.type === "maintenance-add" ||
  modal.type === "maintenance-edit" ||
  modal.type === "maintenance-delete";

function MaintenanceFormDialog({
  expense,
  commit,
  close,
}: {
  expense?: MaintenanceExpense;
  commit: WorkspaceCommit;
  close: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(expense);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const category = String(values.get("category")) as MaintenanceCategory;
    const amount = Number(values.get("amount"));
    const date = String(values.get("date"));
    const note = String(values.get("note") || "").trim();

    if (!MAINTENANCE_CATEGORIES.includes(category)) {
      setError("Choose a maintenance type.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!date || date > localDate()) {
      setError("Choose today or an earlier payment date.");
      return;
    }
    if (note.length > 240) {
      setError("Keep the note within 240 characters.");
      return;
    }

    setSaving(true);
    const next: MaintenanceExpense = {
      id: expense?.id || uid(),
      category,
      amount,
      date,
      note,
      createdAt: expense?.createdAt || new Date().toISOString(),
    };
    const saved = await commit(
      (draft) => {
        if (editing) {
          draft.maintenance = draft.maintenance.map((item) =>
            item.id === next.id ? next : item,
          );
        } else {
          draft.maintenance.push(next);
        }
      },
      editing ? "Maintenance expense updated." : "Maintenance expense added.",
    );
    setSaving(false);
    if (saved) close();
  };

  return (
    <Modal onClose={close} labelledBy="maintenance-form-title">
      <ModalHeader
        eyebrow="Maintenance"
        title={editing ? "Edit expense" : "Add maintenance expense"}
        onClose={close}
        id="maintenance-form-title"
      />
      <form onSubmit={submit} className="grid gap-4">
        <label>
          Type
          <select
            name="category"
            defaultValue={expense?.category || "Electricity"}
          >
            {MAINTENANCE_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Amount paid (₹)
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              defaultValue={expense?.amount || ""}
              placeholder="800"
              required
            />
          </label>
          <label>
            Payment date
            <input
              name="date"
              type="date"
              max={localDate()}
              defaultValue={expense?.date || localDate()}
              required
            />
          </label>
        </div>
        <label>
          Note{" "}
          <small className="font-semibold text-slate-500">(optional)</small>
          <textarea
            name="note"
            rows={3}
            maxLength={240}
            defaultValue={expense?.note || ""}
            placeholder="Bill period, vendor, or any useful detail"
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Save expense" : "Add expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MaintenanceDialogRouter({
  modal,
  data,
  commit,
  setModal,
}: {
  modal: ModalState;
  data: WorkspaceData;
  commit: WorkspaceCommit;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const close = () => setModal(null);
  if (modal.type === "maintenance-add")
    return <MaintenanceFormDialog commit={commit} close={close} />;

  if (modal.type !== "maintenance-edit" && modal.type !== "maintenance-delete")
    return null;
  const expense = data.maintenance.find((item) => item.id === modal.id);
  if (!expense) return null;

  if (modal.type === "maintenance-edit")
    return (
      <MaintenanceFormDialog expense={expense} commit={commit} close={close} />
    );

  return (
    <ConfirmDialog
      title="Delete this maintenance expense?"
      text={`${expense.category} · ${money(expense.amount)} · ${prettyDate(expense.date)}. This will change the earnings totals.`}
      confirmLabel="Delete expense"
      onCancel={close}
      onConfirm={async () => {
        const saved = await commit((draft) => {
          draft.maintenance = draft.maintenance.filter(
            (item) => item.id !== expense.id,
          );
        }, "Maintenance expense removed.");
        if (saved) close();
      }}
    />
  );
}
