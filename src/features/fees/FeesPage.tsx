import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ChevronDownIcon } from "../../components/ui/Icons";
import { SearchField } from "../../components/ui/SearchField";
import { SectionJumpNav } from "../../components/ui/SectionJumpNav";
import { StatusPill } from "../../components/ui/StatusPill";
import { DueMemberCard } from "../../components/workspace/DueMemberCard";
import { PAYMENT_EDIT_REVIEW_DAYS } from "../../config/constants";
import type { ModalState, Payment, WorkspaceData } from "../../types/domain";
import { earningsForPeriod, earningsPeriodRange } from "../../utils/earnings";
import {
  daysSince,
  localDate,
  money,
  monthLabel,
  prettyDate,
} from "../../utils/format";
import { memberStatus } from "../../utils/members";
import { matchesSearch } from "../../utils/search";
import { MaintenanceArchive } from "./MaintenanceArchive";

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export function FeesPage({
  data,
  setModal,
}: {
  data: WorkspaceData;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const today = localDate();
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);
  const [searchParams] = useSearchParams();
  const focusedPaymentId = searchParams.get("payment");
  const focusedPayment = data.fees.find(
    (payment) => payment.id === focusedPaymentId,
  );
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get("period") === "all" ? "all" : currentYear,
  );
  const [selectedMonth, setSelectedMonth] = useState(
    searchParams.get("period") === "all" ? "all" : today.slice(5, 7),
  );
  const [duesOpen, setDuesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [feeSearch, setFeeSearch] = useState("");
  const years = [
    ...new Set([
      currentYear,
      ...[...data.fees, ...data.maintenance].map((record) =>
        record.date.slice(0, 4),
      ),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const statusByMember = new Map(
    data.members.map((member) => [
      member.id,
      memberStatus(member, data.fees, 7),
    ]),
  );
  const due = data.members
    .filter(
      (member) =>
        member.active &&
        ["overdue", "due"].includes(statusByMember.get(member.id)!.tone),
    )
    .sort(
      (a, b) =>
        Number(Boolean(statusByMember.get(a.id)?.currentPayment)) -
          Number(Boolean(statusByMember.get(b.id)?.currentPayment)) ||
        a.expiry.localeCompare(b.expiry),
    );
  const visibleDue = due.filter((member) => {
    const status = statusByMember.get(member.id)!;
    return matchesSearch(feeSearch, [
      member.name,
      member.phone,
      member.seat,
      member.shift,
      status.label,
    ]);
  });
  const hasDues = due.length > 0;
  const priorityJumpItems = [
    { id: "fees-dues", label: "Renewals & dues" },
    { id: "earnings-summary", label: "Earnings summary" },
  ];
  if (!hasDues) priorityJumpItems.reverse();
  const [from, to] = earningsPeriodRange(selectedYear, selectedMonth);
  const payments = useMemo(
    () =>
      [...data.fees]
        .filter((payment) => {
          const member = data.members.find(
            (item) => item.id === payment.memberId,
          );
          return (
            (!from || payment.date >= from) &&
            (!to || payment.date <= to) &&
            matchesSearch(feeSearch, [
              payment.memberName,
              member?.name,
              member?.phone,
              payment.seat,
              member?.seat,
              payment.mode,
              payment.date,
            ])
          );
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.fees, data.members, feeSearch, from, to],
  );
  const filteredTotal = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const earnings = earningsForPeriod(data.fees, data.maintenance, from, to);
  const groups = payments.reduce<Map<string, Payment[]>>((map, payment) => {
    const month = payment.date.slice(0, 7);
    map.set(month, [...(map.get(month) || []), payment]);
    return map;
  }, new Map());
  const monthlyGroups = [...groups.entries()].sort(([a], [b]) =>
    b.localeCompare(a),
  );
  const yearlyGroups = [
    ...monthlyGroups.reduce<Map<string, Array<[string, Payment[]]>>>(
      (map, group) => {
        const year = group[0].slice(0, 4);
        map.set(year, [...(map.get(year) || []), group]);
        return map;
      },
      new Map(),
    ),
  ].sort(([first], [second]) => second.localeCompare(first));
  const filteredLabel =
    selectedYear === "all"
      ? "All time"
      : selectedMonth === "all"
        ? selectedYear
        : monthLabel(`${selectedYear}-${selectedMonth}`);
  const expandedYear = selectedYear === "all" ? currentYear : selectedYear;
  const expandedMonth =
    selectedYear === "all" || selectedMonth === "all"
      ? currentMonth
      : `${selectedYear}-${selectedMonth}`;
  const yearStartsOpen = (year: string) =>
    Boolean(feeSearch.trim()) ||
    focusedPayment?.date.slice(0, 4) === year ||
    year === expandedYear;

  useEffect(() => {
    if (!focusedPayment) return;
    setCollectionsOpen(true);
    setSelectedYear(focusedPayment.date.slice(0, 4));
    setSelectedMonth(focusedPayment.date.slice(5, 7));
    setFeeSearch("");
  }, [currentYear, focusedPayment?.date, focusedPayment?.id]);

  const focusedPaymentVisible = Boolean(
    focusedPaymentId &&
    payments.some((payment) => payment.id === focusedPaymentId),
  );

  useEffect(() => {
    if (!focusedPaymentId || !focusedPaymentVisible || !collectionsOpen) return;
    const frame = requestAnimationFrame(() => {
      const paymentRow = document.getElementById(`payment-${focusedPaymentId}`);
      paymentRow?.scrollIntoView({ behavior: "smooth", block: "center" });
      paymentRow?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedPaymentId, focusedPaymentVisible, collectionsOpen]);

  const scrollToSection = useCallback((id: string) => {
    if (id === "fees-dues") setDuesOpen(true);
    if (id === "fees-archive") setCollectionsOpen(true);
    if (id === "earnings-maintenance") setMaintenanceOpen(true);
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }, []);
  const requestedSection = searchParams.get("section");
  useEffect(() => {
    if (requestedSection) scrollToSection(requestedSection);
  }, [requestedSection, scrollToSection]);

  function downloadReport() {
    if (!payments.length) return;
    const rows: unknown[][] = [
      [
        "Payment date",
        "Member",
        "Seat at payment",
        "Amount INR",
        "Mode",
        "Period starts",
        "Period ends",
      ],
      ...payments.map((payment) => [
        payment.date,
        payment.memberName,
        payment.seat,
        payment.amount,
        payment.mode,
        payment.periodStart,
        payment.periodEnd,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `studydesk-fees-${from || "all"}-${to || "time"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const renewalsSection = (
    <details
      id="fees-dues"
      open={duesOpen}
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          setDuesOpen(event.currentTarget.open);
      }}
      className="panel archive-disclosure scroll-mt-24 overflow-hidden"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Renewals & dues
          </h2>
          <StatusPill tone={visibleDue.length ? "overdue" : "active"}>
            {visibleDue.length}
          </StatusPill>
        </div>
        <ChevronDownIcon className="archive-chevron size-5 shrink-0 text-slate-500" />
      </summary>
      <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {visibleDue.length ? (
          visibleDue.map((member) => {
            const status = statusByMember.get(member.id)!;
            return (
              <DueMemberCard
                key={member.id}
                member={member}
                status={status}
                onCollect={() => setModal({ type: "renew", id: member.id })}
              />
            );
          })
        ) : (
          <EmptyState
            title={due.length ? "No matching members" : "Nothing due"}
            text={
              due.length
                ? "Try a different name, phone, seat or shift."
                : "All memberships are up to date."
            }
          />
        )}
      </div>
    </details>
  );

  return (
    <section className="grid gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500">
          {filteredLabel}
        </p>
        <div className="grid max-w-4xl grid-cols-3 gap-2 sm:gap-3">
          {[
            ["Collected", earnings.feeIncome, "fees-archive"],
            ["Maintenance", earnings.maintenancePaid, "earnings-maintenance"],
            ["Net earnings", earnings.netEarnings, "earnings-summary"],
          ].map(([label, value, target], index) => (
            <button
              key={label}
              type="button"
              onClick={() => scrollToSection(String(target))}
              className={`min-w-0 rounded-[1.2rem] border-2 p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:p-4 ${
                [
                  "border-emerald-200 bg-emerald-50/70",
                  "status-warning-surface",
                  earnings.netEarnings < 0
                    ? "status-danger-surface"
                    : "border-sky-300 bg-sky-50/70",
                ][index]
              }`}
            >
              <span className="block text-[10px] font-bold leading-tight text-slate-600 min-[370px]:text-xs sm:text-sm">
                {label}
              </span>
              <strong className="mt-1.5 block break-words font-display text-lg text-slate-900 min-[370px]:text-xl sm:text-2xl">
                {money(value)}
              </strong>
            </button>
          ))}
        </div>
      </div>
      <SectionJumpNav
        mobileOnly={false}
        onJump={scrollToSection}
        items={[
          ...priorityJumpItems,
          { id: "fees-archive", label: "Fee collections" },
          { id: "earnings-maintenance", label: "Maintenance" },
        ]}
      />
      <SearchField
        value={feeSearch}
        onChange={setFeeSearch}
        placeholder="Search dues and collections"
        ariaLabel="Search fees and members"
      />
      {hasDues && renewalsSection}
      <section id="earnings-summary" className="panel scroll-mt-24 p-4 sm:p-5">
        <div className="section-title">
          <h2>Earnings summary</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-lg">
          <label>
            Year
            <select
              value={selectedYear}
              onChange={(event) => {
                const year = event.target.value;
                setSelectedYear(year);
                if (year === "all") setSelectedMonth("all");
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
              <option value="all">All years</option>
            </select>
          </label>
          <label>
            Month
            <select
              value={selectedMonth}
              disabled={selectedYear === "all"}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              <option value="all">All months</option>
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, "0");
                return (
                  <option key={month} value={month}>
                    {new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
                      new Date(2026, index, 1),
                    )}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <dl className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
          {[
            ["Collected", earnings.feeIncome],
            ["Maintenance", earnings.maintenancePaid],
            ["Net earnings", earnings.netEarnings],
          ].map(([label, amount]) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-3 py-3 text-sm ${label === "Net earnings" ? "font-extrabold text-slate-900" : "text-slate-600"}`}
            >
              <dt>{label}</dt>
              <dd
                className={
                  label === "Net earnings" && earnings.netEarnings < 0
                    ? "status-danger-text"
                    : "font-bold"
                }
              >
                {money(amount)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {!hasDues && renewalsSection}
      <details
        id="fees-archive"
        open={collectionsOpen}
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setCollectionsOpen(event.currentTarget.open);
        }}
        className="panel archive-disclosure scroll-mt-24 overflow-hidden"
      >
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold sm:text-2xl">
              Fee collections
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {`${filteredLabel} · ${money(filteredTotal)} · ${payments.length} ${payments.length === 1 ? "payment" : "payments"}${feeSearch.trim() ? " matching search" : ""}`}
            </p>
          </div>
          <ChevronDownIcon className="archive-chevron size-5 shrink-0 text-slate-500" />
        </summary>
        <div className="border-t border-slate-200 p-4 sm:px-5">
          <Button
            variant="secondary"
            disabled={!payments.length}
            onClick={downloadReport}
          >
            Download CSV
          </Button>
        </div>
        <div>
          {yearlyGroups.length ? (
            yearlyGroups.map(([year, yearMonths]) => {
              const yearPayments = yearMonths.flatMap(([, items]) => items);
              const yearTotal = yearPayments.reduce(
                (sum, payment) => sum + payment.amount,
                0,
              );
              return (
                <details
                  key={year}
                  open={yearStartsOpen(year)}
                  className="archive-disclosure archive-year border-b border-slate-200 last:border-0"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 bg-slate-100 px-4 py-3.5 transition hover:bg-slate-200/70 sm:px-5">
                    <span className="flex min-w-0 items-center gap-3">
                      <ChevronDownIcon className="archive-chevron size-5 shrink-0 text-slate-500" />
                      <span>
                        <strong className="block font-display text-xl text-slate-900">
                          {year}
                        </strong>
                        <small className="text-slate-500">
                          {yearMonths.length}{" "}
                          {yearMonths.length === 1 ? "month" : "months"} ·{" "}
                          {yearPayments.length}{" "}
                          {yearPayments.length === 1 ? "payment" : "payments"}
                        </small>
                      </span>
                    </span>
                    <b className="whitespace-nowrap text-slate-900">
                      {money(yearTotal)}
                    </b>
                  </summary>
                  <div className="grid gap-2 border-t border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                    {yearMonths.map(([month, monthPayments]) => {
                      const monthTotal = monthPayments.reduce(
                        (sum, payment) => sum + payment.amount,
                        0,
                      );
                      return (
                        <details
                          key={month}
                          open={
                            Boolean(feeSearch.trim()) ||
                            focusedPayment?.date.slice(0, 7) === month ||
                            month === expandedMonth
                          }
                          className="archive-disclosure archive-month ml-2 rounded-xl border border-slate-200 bg-white sm:ml-4"
                        >
                          <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-slate-50 sm:px-4">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <ChevronDownIcon className="archive-chevron size-4 shrink-0 text-slate-500" />
                              <span>
                                <strong className="block text-sm text-slate-900 sm:text-base">
                                  {monthLabel(month)}
                                </strong>
                                <small className="text-slate-500">
                                  {monthPayments.length}{" "}
                                  {monthPayments.length === 1
                                    ? "payment"
                                    : "payments"}
                                </small>
                              </span>
                            </span>
                            <b className="whitespace-nowrap text-sm text-slate-900 sm:text-base">
                              {money(monthTotal)}
                            </b>
                          </summary>
                          <div className="ml-3 grid gap-px border-l border-slate-200 bg-slate-200 sm:ml-5">
                            {monthPayments.map((payment) => {
                              const deletable =
                                daysSince(payment.date) >= 0 &&
                                daysSince(payment.date) <=
                                  PAYMENT_EDIT_REVIEW_DAYS;
                              const member = data.members.find(
                                (item) => item.id === payment.memberId,
                              );
                              return (
                                <div
                                  id={`payment-${payment.id}`}
                                  tabIndex={-1}
                                  className={`scroll-mt-28 grid gap-3 p-3 outline-none transition sm:grid-cols-[1fr_auto] sm:p-4 ${
                                    focusedPaymentId === payment.id
                                      ? "relative z-10 bg-[var(--surface-panel)] ring-2 ring-inset ring-[var(--brand)]"
                                      : "bg-white"
                                  }`}
                                  key={payment.id}
                                >
                                  <div>
                                    <strong>
                                      {payment.memberName ||
                                        member?.name ||
                                        "Member"}
                                      {member?.phone && (
                                        <span className="whitespace-nowrap font-semibold text-slate-600">
                                          {" "}
                                          ({member.phone})
                                        </span>
                                      )}
                                    </strong>
                                    <small className="mt-1 block text-slate-600">
                                      {prettyDate(payment.date)} ·{" "}
                                      {payment.seat ||
                                        member?.seat ||
                                        "Seat not recorded"}{" "}
                                      · {payment.mode}
                                    </small>
                                    <small className="block text-slate-500">
                                      Covers {prettyDate(payment.periodStart)}–
                                      {prettyDate(payment.periodEnd)}
                                    </small>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                                    <b>{money(payment.amount)}</b>
                                    <span className="flex gap-2 sm:mt-2">
                                      <button
                                        className="text-xs font-extrabold text-slate-700 underline"
                                        onClick={() =>
                                          setModal({
                                            type: "payment-edit",
                                            id: payment.id,
                                          })
                                        }
                                      >
                                        Edit
                                      </button>
                                      {deletable ? (
                                        <button
                                          className="status-danger-text text-xs font-extrabold underline"
                                          onClick={() =>
                                            setModal({
                                              type: "payment-delete",
                                              id: payment.id,
                                            })
                                          }
                                        >
                                          Delete
                                        </button>
                                      ) : (
                                        <small className="font-semibold text-slate-400">
                                          Delete locked
                                        </small>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              );
            })
          ) : (
            <div className="p-5">
              <EmptyState
                title={
                  feeSearch.trim()
                    ? "No matching payments"
                    : "No payments in this period"
                }
                text={
                  feeSearch.trim()
                    ? "Try a different member, phone, seat or payment mode."
                    : "Choose a wider date range or record a collection."
                }
              />
            </div>
          )}
        </div>
      </details>
      <MaintenanceArchive
        key={`${selectedYear}-${selectedMonth}`}
        expenses={earnings.expenses}
        currentMonth={expandedMonth}
        currentYear={expandedYear}
        setModal={setModal}
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
        periodLabel={filteredLabel}
      />
    </section>
  );
}
