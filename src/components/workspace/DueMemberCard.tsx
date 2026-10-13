import type { Member } from "../../types/domain";
import { prettyDate } from "../../utils/format";
import type { memberStatus } from "../../utils/members";
import { Button } from "../ui/Button";
import { PhoneLink } from "../ui/PhoneLink";
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
      className={`rounded-2xl border p-3 ${status.tone === "overdue" ? "status-danger-surface" : "status-warning-surface"}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-extrabold leading-snug text-slate-900">
            {member.name}
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-600">
            {member.phone}
          </p>
        </div>
        <StatusPill tone={status.tone} className="shrink-0">
          {status.label}
        </StatusPill>
      </div>

      <dl className="mt-2 grid grid-cols-[minmax(0,.65fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
        <div>
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Seat
          </dt>
          <dd className="mt-0.5 break-words text-xs font-bold text-slate-800">
            {member.seat || "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Shift
          </dt>
          <dd className="mt-0.5 break-words text-xs font-bold text-slate-800">
            {member.shift}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-extrabold tracking-[0.12em] text-slate-500 uppercase">
            Valid until
          </dt>
          <dd className="mt-0.5 text-xs font-bold text-slate-800">
            {prettyDate(member.expiry)}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 flex items-center gap-3">
        <PhoneLink
          phone={member.phone}
          name={member.name}
          className="!size-7"
        />
        <Button className="min-w-0 flex-1" onClick={onCollect}>
          {hasPayment ? "Collect fee" : "Add payment"}
        </Button>
      </div>
    </article>
  );
}
