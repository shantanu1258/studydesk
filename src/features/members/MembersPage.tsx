import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PlusIcon, SearchIcon } from "../../components/ui/Icons";
import { StatusPill } from "../../components/ui/StatusPill";
import type { Member, ModalState, WorkspaceData } from "../../types/domain";
import { initials, prettyDate } from "../../utils/format";
import { memberStatus } from "../../utils/members";

export function MemberCard({
  member,
  data,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const status = memberStatus(member, data.fees);
  return (
    <article
      className={`rounded-2xl border p-4 ${status.tone === "overdue" ? "status-danger-surface" : status.tone === "due" ? "status-warning-surface" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700">
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-base text-slate-900">
            {member.name}
          </strong>
          <span className="text-sm text-slate-600">{member.phone}</span>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white/70 p-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Seat</dt>
          <dd className="font-bold">{member.seat}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Shift</dt>
          <dd className="truncate font-bold">{member.shift}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Valid until</dt>
          <dd className="font-bold">{prettyDate(member.expiry)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <button
          className="flex-1 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-extrabold text-[var(--accent-text)]"
          onClick={() => setModal({ type: "info", id: member.id })}
        >
          View details
        </button>
        <button
          className="flex-1 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-extrabold text-[var(--button-text)]"
          onClick={() =>
            setModal(
              member.active
                ? { type: "renew", id: member.id }
                : { type: "member-reactivate", id: member.id },
            )
          }
        >
          {member.active
            ? status.currentPayment
              ? "Collect fee"
              : "Add payment"
            : "Reactivate"}
        </button>
      </div>
    </article>
  );
}

function MemberRow({
  member,
  data,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const status = memberStatus(member, data.fees);
  return (
    <tr
      className={`border-t border-slate-200 ${status.tone === "overdue" ? "status-danger-surface" : status.tone === "due" ? "status-warning-surface" : "bg-white"}`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-sm text-slate-900">
              {member.name}
            </strong>
            <small className="block text-slate-500">{member.phone}</small>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 font-bold text-slate-800">{member.seat}</td>
      <td className="px-4 py-3.5 text-slate-700">{member.shift}</td>
      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
        {prettyDate(member.expiry)}
      </td>
      <td className="px-4 py-3.5">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="ml-auto grid w-max grid-cols-[6rem_8.5rem] gap-2">
          <button
            className="w-full rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-text)]"
            onClick={() => setModal({ type: "info", id: member.id })}
          >
            View
          </button>
          <button
            className="w-full rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-extrabold text-[var(--button-text)]"
            onClick={() =>
              setModal(
                member.active
                  ? { type: "renew", id: member.id }
                  : { type: "member-reactivate", id: member.id },
              )
            }
          >
            {member.active
              ? status.currentPayment
                ? "Collect fee"
                : "Add payment"
              : "Reactivate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function MembersPage({
  data,
  shift,
  query,
  setQuery,
  setModal,
}: {
  data: WorkspaceData;
  shift: string;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const [filter, setFilter] = useState<"active" | "inactive" | "all">("active");
  const normalized = query.toLocaleLowerCase().trim();
  const activeCount = data.members.filter((member) => member.active).length;
  const inactiveCount = data.members.length - activeCount;
  const members = data.members.filter(
    (member) =>
      (filter === "all" ||
        (filter === "active" ? member.active : !member.active)) &&
      [member.name, member.phone, member.seat, member.shift].some((value) =>
        String(value).toLocaleLowerCase().includes(normalized),
      ),
  );
  const counts = {
    active: activeCount,
    inactive: inactiveCount,
    all: data.members.length,
  };

  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <label className="relative block min-w-0 flex-1 lg:max-w-lg">
            <span className="sr-only">Search members</span>
            <SearchIcon className="absolute left-3.5 top-3.5 size-5 text-slate-400" />
            <input
              className="pl-11"
              placeholder="Search name, phone, seat or shift"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setModal({ type: "member", shift })}
          >
            <PlusIcon className="size-4" />
            Add member
          </Button>
        </div>
        <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
          {(["active", "inactive", "all"] as const).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setFilter(item)}
              className={`min-w-0 rounded-lg px-1.5 py-2 text-[11px] font-extrabold capitalize sm:px-3 sm:text-sm ${filter === item ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm" : "text-slate-600"}`}
            >
              <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                {item === "inactive" ? "Deactivated" : item}
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] leading-none opacity-70 sm:text-xs">
                  {counts[item]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="my-4 text-sm font-semibold text-slate-500">
        {members.length} {members.length === 1 ? "record" : "records"}
      </p>
      <div className="grid gap-3 md:grid-cols-2 lg:hidden">
        {members.length ? (
          members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              data={data}
              setModal={setModal}
            />
          ))
        ) : (
          <div className="md:col-span-2">
            <EmptyState
              title="No members found"
              text={
                filter === "inactive"
                  ? "Deactivated members will remain available here."
                  : "Try a different search or filter."
              }
            />
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3 font-extrabold">Member</th>
              <th className="px-4 py-3 font-extrabold">Seat</th>
              <th className="px-4 py-3 font-extrabold">Shift</th>
              <th className="px-4 py-3 font-extrabold">Valid until</th>
              <th className="px-4 py-3 font-extrabold">Status</th>
              <th className="px-4 py-3 text-right font-extrabold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length ? (
              members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  data={data}
                  setModal={setModal}
                />
              ))
            ) : (
              <tr>
                <td className="p-5" colSpan={6}>
                  <EmptyState
                    title="No members found"
                    text={
                      filter === "inactive"
                        ? "Deactivated members will remain available here."
                        : "Try a different search or filter."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
