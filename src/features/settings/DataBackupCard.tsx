import { useState, type ChangeEvent } from "react";
import { DownloadIcon, UploadIcon } from "../../components/ui/Icons";
import { ConfirmDialog } from "../../components/ui/Modal";
import { StatusPill } from "../../components/ui/StatusPill";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from "../../config/constants";
import type {
  StorageMode,
  WorkspaceCommit,
  WorkspaceData,
} from "../../types/domain";
import { localDate } from "../../utils/format";
import {
  normalizeSeatSections,
  seatCountFromSections,
} from "../../utils/seats";
import { normalizeShifts } from "../../utils/shifts";
import { normalizeColor } from "../../utils/theme";

const isValidBackup = (
  value: Partial<WorkspaceData> | null,
): value is WorkspaceData =>
  Boolean(
    value?.settings &&
    Array.isArray(value.members) &&
    Array.isArray(value.fees) &&
    Array.isArray(value.attendance),
  );

export function DataBackupCard({
  data,
  commit,
  storageMode,
}: {
  data: WorkspaceData;
  commit: WorkspaceCommit;
  storageMode: StorageMode;
}) {
  const [pending, setPending] = useState<{
    fileName: string;
    restored: WorkspaceData;
  } | null>(null);
  const [error, setError] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `studydesk-backup-${localDate()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const restored = JSON.parse(String(reader.result)) as WorkspaceData;
        if (!isValidBackup(restored)) throw new Error();
        setError("");
        setPending({ fileName: file.name, restored });
      } catch {
        setError("That file is not a valid StudyDesk backup.");
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      setError("That backup file could not be read.");
      input.value = "";
    };
    reader.readAsText(file);
  }
  async function restore() {
    if (!pending) return false;
    const restored = pending.restored;
    const saved = await commit((next) => {
      const sections = normalizeSeatSections(
        restored.settings.seatSections,
        restored.settings.seatCount,
        restored.settings.prefix,
      );
      next.settings = {
        ...next.settings,
        ...restored.settings,
        id: data.settings.id,
        shifts: normalizeShifts(
          restored.settings.shifts || next.settings.shifts,
        ),
        feeCollection:
          restored.settings.feeCollection === "later" ? "later" : "advance",
        attendanceEnabled: restored.settings.attendanceEnabled === true,
        primaryColor: normalizeColor(
          restored.settings.primaryColor,
          next.settings.primaryColor || DEFAULT_PRIMARY_COLOR,
        ),
        secondaryColor: normalizeColor(
          restored.settings.secondaryColor,
          next.settings.secondaryColor || DEFAULT_SECONDARY_COLOR,
        ),
        seatSections: sections,
        seatCount: seatCountFromSections(sections),
        prefix: sections[0].prefix,
      };
      next.members = restored.members;
      next.fees = restored.fees;
      next.attendance = restored.attendance;
      next.demoSeats = Array.isArray(restored.demoSeats)
        ? restored.demoSeats
        : [];
    }, "Backup restored");
    if (saved) setPending(null);
    return saved;
  }
  const actionClass =
    "flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50";
  return (
    <article className="panel p-5 sm:p-6">
      <div className="section-title">
        <div>
          <h2>Data & backup</h2>
          <p>
            {storageMode === "cloud"
              ? "Your live workspace is stored in Supabase."
              : "Demo records stay in this browser."}
          </p>
        </div>
        <StatusPill tone={storageMode === "cloud" ? "active" : "due"}>
          {storageMode === "cloud" ? "Cloud saved" : "This device"}
        </StatusPill>
      </div>
      <div className="mt-5 grid gap-3">
        <button type="button" className={actionClass} onClick={download}>
          <span className="grid size-11 place-items-center rounded-xl bg-slate-100">
            <DownloadIcon className="size-5" />
          </span>
          <span>
            <strong className="block">Download backup</strong>
            <small className="text-slate-600">
              Save a private copy of all library records.
            </small>
          </span>
        </button>
        <label className={actionClass}>
          <span className="grid size-11 place-items-center rounded-xl bg-slate-100">
            <UploadIcon className="size-5" />
          </span>
          <span>
            <strong className="block">Restore a backup</strong>
            <small className="text-slate-600">
              Replace this workspace from a StudyDesk file.
            </small>
          </span>
          <input
            className="sr-only"
            type="file"
            accept="application/json"
            onChange={choose}
          />
        </label>
      </div>
      <p className="helper mt-4">
        Backups contain member and payment information. Store them carefully.
      </p>
      {error && <p className="field-error mt-2">{error}</p>}
      {pending && (
        <ConfirmDialog
          title="Restore this backup?"
          text={`${pending.fileName} contains ${pending.restored.members.length} members and ${pending.restored.fees.length} payments. It will replace the current workspace data.`}
          confirmLabel="Restore backup"
          onCancel={() => setPending(null)}
          onConfirm={restore}
        />
      )}
    </article>
  );
}
