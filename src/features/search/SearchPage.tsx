import type { Dispatch, SetStateAction } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { ArrowLeftIcon } from "../../components/ui/Icons";
import { SearchField } from "../../components/ui/SearchField";
import type { ModalState, WorkspaceData } from "../../types/domain";
import { matchesSearch } from "../../utils/search";
import { MemberCard } from "../members/MembersPage";

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
            ? `${members.length} ${members.length === 1 ? "member" : "members"} found`
            : `${data.members.length} member records available to search`}
        </p>
      </div>

      {hasQuery && members.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              data={data}
              setModal={setModal}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={hasQuery ? "No members found" : "Search your member records"}
          text={
            hasQuery
              ? "Try another name, phone number, seat or shift."
              : "Active and deactivated members are both included."
          }
        />
      )}
    </section>
  );
}
