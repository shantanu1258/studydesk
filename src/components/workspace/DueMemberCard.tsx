import type { Member } from "../../types/domain";
import { prettyDate } from "../../utils/format";
import type { memberStatus } from "../../utils/members";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";

type MemberStatus = ReturnType<typeof memberStatus>;

export function DueMemberCard({
  member,
  status,
  onCollect,
}: {
  member: Member;
  status: MemberStatus;
  onCollect: () => void;
}) {
  const hasPayment = Boolean(status.currentPayment);

  return (
    <article
      className={`rounded-2xl border p-4 ${status.tone === "overdue" ? "status-danger-surface" : "status-warning-surface"}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <h3 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-base font-extrabold leading-snug text-slate-900">
          <span>{member.name}</span>
          <span className="whitespace-nowrap text-sm font-semibold text-slate-600">
            ({member.phone})
          </span>
        </h3>
        <StatusPill tone={status.tone} className="shrink-0">
          {status.label}
        </StatusPill>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-white/65 p-3 sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Seat
          </dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-800">
            {member.seat || "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Shift
          </dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-800">
            {member.shift}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Valid until
          </dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-800">
            {prettyDate(member.expiry)}
          </dd>
        </div>
      </dl>

      <Button className="mt-3 w-full" onClick={onCollect}>
        {hasPayment ? "Collect fee" : "Add payment"}
      </Button>
    </article>
  );
}
