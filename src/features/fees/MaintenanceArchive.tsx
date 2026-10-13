import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ChevronDownIcon, PlusIcon } from "../../components/ui/Icons";
import type { MaintenanceExpense, ModalState } from "../../types/domain";
import { maintenanceTotal } from "../../utils/earnings";
import { money, monthLabel, prettyDate } from "../../utils/format";

function ArchiveDisclosure({
  initiallyOpen,
  className,
  children,
}: {
  initiallyOpen: boolean;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      open={open}
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          setOpen(event.currentTarget.open);
      }}
      className={className}
    >
      {children}
    </details>
  );
}

export function MaintenanceArchive({
  expenses,
  currentMonth,
  currentYear,
  setModal,
  open,
  onOpenChange,
  periodLabel,
}: {
  expenses: MaintenanceExpense[];
  currentMonth: string;
  currentYear: string;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
}) {
  const monthlyGroups = [
    ...expenses.reduce<Map<string, MaintenanceExpense[]>>((map, expense) => {
      const month = expense.date.slice(0, 7);
      map.set(month, [...(map.get(month) || []), expense]);
      return map;
    }, new Map()),
  ].sort(([first], [second]) => second.localeCompare(first));
  monthlyGroups.forEach(([, records]) =>
    records.sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        (second.createdAt || "").localeCompare(first.createdAt || ""),
    ),
  );
  const yearlyGroups = [
    ...monthlyGroups.reduce<Map<string, Array<[string, MaintenanceExpense[]]>>>(
      (map, group) => {
        const year = group[0].slice(0, 4);
        map.set(year, [...(map.get(year) || []), group]);
        return map;
      },
      new Map(),
    ),
  ].sort(([first], [second]) => second.localeCompare(first));

  return (
    <details
      id="earnings-maintenance"
      open={open}
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          onOpenChange(event.currentTarget.open);
      }}
      className="panel archive-disclosure scroll-mt-24 overflow-hidden"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Maintenance expenses
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {periodLabel} · {money(maintenanceTotal(expenses))} ·{" "}
            {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <ChevronDownIcon className="archive-chevron size-5 shrink-0 text-slate-500" />
      </summary>
      <div className="border-t border-slate-200 p-4 sm:px-5">
        <Button onClick={() => setModal({ type: "maintenance-add" })}>
          <PlusIcon className="size-4" />
          Add maintenance
        </Button>
      </div>
      <div className="border-t border-slate-200">
        {yearlyGroups.length ? (
          yearlyGroups.map(([year, yearMonths]) => {
            const yearExpenses = yearMonths.flatMap(([, records]) => records);
            return (
              <ArchiveDisclosure
                key={year}
                initiallyOpen={year === currentYear}
                className="archive-disclosure archive-year border-b border-slate-200 last:border-0"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 bg-slate-100 px-4 py-3.5 transition hover:bg-slate-200/70 sm:px-5">
                  <span className="flex min-w-0 items-center gap-3">
                    <ChevronDownIcon className="archive-chevron size-5 shrink-0 text-slate-500" />
                    <strong className="font-display text-xl text-slate-900">
                      {year}
                    </strong>
                  </span>
                  <b className="whitespace-nowrap text-slate-900">
                    {money(maintenanceTotal(yearExpenses))}
                  </b>
                </summary>
                <div className="grid gap-2 border-t border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                  {yearMonths.map(([month, monthExpenses]) => (
                    <ArchiveDisclosure
                      key={month}
                      initiallyOpen={month === currentMonth}
                      className="archive-disclosure archive-month ml-2 rounded-xl border border-slate-200 bg-white sm:ml-4"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-slate-50 sm:px-4">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <ChevronDownIcon className="archive-chevron size-4 shrink-0 text-slate-500" />
                          <strong className="text-sm text-slate-900 sm:text-base">
                            {monthLabel(month)}
                          </strong>
                        </span>
                        <b className="whitespace-nowrap text-sm text-slate-900 sm:text-base">
                          {money(maintenanceTotal(monthExpenses))}
                        </b>
                      </summary>
                      <div className="ml-3 grid gap-px border-l border-slate-200 bg-slate-200 sm:ml-5">
                        {monthExpenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="grid gap-3 bg-white p-3 sm:grid-cols-[1fr_auto] sm:p-4"
                          >
                            <div className="min-w-0">
                              <strong className="text-slate-900">
                                {expense.category}
                              </strong>
                              <small className="mt-0.5 block text-slate-600">
                                {prettyDate(expense.date)}
                                {expense.note ? ` · ${expense.note}` : ""}
                              </small>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                              <b className="text-slate-900">
                                {money(expense.amount)}
                              </b>
                              <span className="flex gap-2 sm:mt-2">
                                <button
                                  type="button"
                                  className="text-xs font-extrabold text-slate-700 underline"
                                  onClick={() =>
                                    setModal({
                                      type: "maintenance-edit",
                                      id: expense.id,
                                    })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="status-danger-text text-xs font-extrabold underline"
                                  onClick={() =>
                                    setModal({
                                      type: "maintenance-delete",
                                      id: expense.id,
                                    })
                                  }
                                >
                                  Delete
                                </button>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ArchiveDisclosure>
                  ))}
                </div>
              </ArchiveDisclosure>
            );
          })
        ) : (
          <div className="p-5">
            <EmptyState
              title="No maintenance expenses"
              text="Choose a wider period or use Add maintenance to record an expense."
            />
          </div>
        )}
      </div>
    </details>
  );
}
