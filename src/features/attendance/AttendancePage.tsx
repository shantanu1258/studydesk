import { useState } from "react";
import { Button } from "../../components/ui/Button";
import type { WorkspaceCommit, WorkspaceData } from "../../types/domain";
import { initials, localDate, prettyDate, uid } from "../../utils/format";

export function AttendancePage({
  data,
  commit,
}: {
  data: WorkspaceData;
  commit: WorkspaceCommit;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = localDate();
  const records = data.attendance.filter((record) => record.date === today);
  const members = data.members
    .filter((member) => member.active)
    .sort((a, b) => a.name.localeCompare(b.name));
  async function toggle(memberId: string) {
    if (busyId) return;
    setBusyId(memberId);
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    try {
      await commit((next) => {
        const record = next.attendance.find(
          (item) => item.memberId === memberId && item.date === today,
        );
        if (record) record.out = time;
        else
          next.attendance.push({
            id: uid(),
            memberId,
            date: today,
            in: time,
            out: "",
          });
      }, "Attendance updated");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [records.length, "Checked in today"],
          [records.filter((record) => !record.out).length, "Currently present"],
          [members.length - records.length, "Not checked in"],
        ].map(([value, label]) => (
          <article className="panel p-5" key={label}>
            <strong className="font-display text-4xl">{value}</strong>
            <span className="mt-1 block text-sm font-semibold text-slate-600">
              {label}
            </span>
          </article>
        ))}
      </div>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <strong>Today · {prettyDate(today)}</strong>
          <span className="text-sm text-slate-500">Manual attendance</span>
        </div>
        <div className="grid gap-px bg-slate-200">
          {members.map((member) => {
            const record = records.find((item) => item.memberId === member.id);
            return (
              <div
                key={member.id}
                className="grid items-center gap-3 bg-white p-4 sm:grid-cols-[1fr_100px_100px_120px] sm:px-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-xs font-bold">
                    {initials(member.name)}
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <small className="block text-slate-500">
                      {member.seat} · {member.shift}
                    </small>
                  </div>
                </div>
                <span className="text-sm">
                  <small className="block text-slate-500 sm:hidden">
                    Check in
                  </small>
                  {record?.in || "—"}
                </span>
                <span className="text-sm">
                  <small className="block text-slate-500 sm:hidden">
                    Check out
                  </small>
                  {record?.out || "—"}
                </span>
                <Button
                  variant={record ? "secondary" : "primary"}
                  disabled={
                    Boolean(busyId && busyId !== member.id) ||
                    Boolean(record?.out)
                  }
                  loading={busyId === member.id}
                  onClick={() => void toggle(member.id)}
                >
                  {record
                    ? record.out
                      ? "Completed"
                      : "Check out"
                    : "Check in"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
