import type { Dispatch, SetStateAction } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { ArrowLeftIcon } from "../../components/ui/Icons";
import { SearchField } from "../../components/ui/SearchField";
import type { ModalState, WorkspaceData } from "../../types/domain";
import { matchesSearch } from "../../utils/search";
import { DemoCard, MemberCard } from "../members/MembersPage";

export function SearchPage({
  data,
  query,
  setQuery,
  setModal,
  onClose,
}: {
  data: WorkspaceData;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  onClose: () => void;
}) {
  const hasQuery = Boolean(query.trim());
  const members = hasQuery
    ? data.members.filter((member) =>
        matchesSearch(query, [
          member.name,
          member.phone,
          member.seat,
          member.shift,
        ]),
      )
    : [];
  const demos =
    hasQuery && data.settings.trackDemoVisitors
      ? data.demoSeats.filter((demo) =>
          matchesSearch(query, [
            demo.name,
            demo.phone,
            demo.seat,
            demo.shift,
            "Demo",
          ]),
        )
      : [];
  const resultCount = members.length + demos.length;
  const searchableCount =
    data.members.length +
    (data.settings.trackDemoVisitors ? data.demoSeats.length : 0);

  return (
    <section className="grid gap-4">
      <div className="panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
            onClick={onClose}
            aria-label="Return to previous page"
            title="Back to previous page"
          >
            <ArrowLeftIcon className="size-5" />
            <span>Back</span>
          </button>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search name, phone, seat or shift"
            ariaLabel="Search all members"
            className="min-w-0 flex-1"
            autoFocus
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          {hasQuery
            ? `${resultCount} ${resultCount === 1 ? "record" : "records"} found`
            : `${searchableCount} records available to search`}
        </p>
      </div>

      {hasQuery && resultCount ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              data={data}
              setModal={setModal}
            />
          ))}
          {demos.map((demo) => (
            <DemoCard key={demo.id} demo={demo} setModal={setModal} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={hasQuery ? "No members found" : "Search your member records"}
          text={
            hasQuery
              ? "Try another name, phone number, seat or shift."
              : data.settings.trackDemoVisitors
                ? "Active, demo, and deactivated records are included."
                : "Active and deactivated members are both included."
          }
        />
      )}
    </section>
  );
}
