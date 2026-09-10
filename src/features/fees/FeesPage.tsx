import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ChevronDownIcon } from "../../components/ui/Icons";
import { SearchField } from "../../components/ui/SearchField";
import { SectionJumpNav } from "../../components/ui/SectionJumpNav";
import { StatusPill } from "../../components/ui/StatusPill";
import { DueMemberCard } from "../../components/workspace/DueMemberCard";
import { PAYMENT_EDIT_REVIEW_DAYS } from "../../config/constants";
import type { ModalState, Payment, WorkspaceData } from "../../types/domain";
import {
  daysSince,
  localDate,
  money,
  monthLabel,
  prettyDate,
} from "../../utils/format";
import { memberStatus } from "../../utils/members";
import { matchesSearch } from "../../utils/search";

const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;
const moveMonth = (date: string, amount: number) => {
  const value = new Date(`${firstOfMonth(date)}T12:00:00`);
  value.setMonth(value.getMonth() + amount);
  return localDate(value);
};
const endOfMonth = (date: string) => {
  const value = new Date(`${firstOfMonth(date)}T12:00:00`);
  value.setMonth(value.getMonth() + 1);
  value.setDate(0);
  return localDate(value);
};
const presetRange = (preset: string, today: string): [string, string] => {
  if (preset === "this-month") return [firstOfMonth(today), today];
  if (preset === "last-month") {
    const previous = moveMonth(today, -1);
    return [firstOfMonth(previous), endOfMonth(previous)];
  }
  if (preset === "this-year") return [`${today.slice(0, 4)}-01-01`, today];
  if (preset.startsWith("year-")) {
    const year = preset.slice(5);
    return [
      `${year}-01-01`,
      year === today.slice(0, 4) ? today : `${year}-12-31`,
    ];
  }
  return ["", ""];
};
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const periodLabel = (
  period: string,
  from: string,
  to: string,
  today: string,
) => {
  if (period === "this-month") return monthLabel(today.slice(0, 7));
  if (period === "last-month")
    return monthLabel(moveMonth(today, -1).slice(0, 7));
  if (period === "this-year") return today.slice(0, 4);
  if (period.startsWith("year-")) return period.slice(5);
  if (period === "all") return "All time";
  return from && to ? `${prettyDate(from)}–${prettyDate(to)}` : "Custom range";
};

export function FeesPage({
  data,
  setModal,
}: {
  data: WorkspaceData;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const today = localDate();
  const [period, setPeriod] = useState("this-month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth(today));
  const [customTo, setCustomTo] = useState(today);
  const [feeSearch, setFeeSearch] = useState("");
  const years = [
    ...new Set(data.fees.map((payment) => payment.date.slice(0, 4))),
  ]
    .filter((year) => year !== today.slice(0, 4))
    .sort((a, b) => b.localeCompare(a));
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
  const [presetFrom, presetTo] = presetRange(period, today);
  const from = period === "custom" ? customFrom : presetFrom;
  const to = period === "custom" ? customTo : presetTo;
  const invalidRange = period === "custom" && Boolean(from && to && from > to);
  const payments = useMemo(
    () =>
      [...data.fees]
        .filter((payment) => {
          const member = data.members.find(
            (item) => item.id === payment.memberId,
          );
          return (
            !invalidRange &&
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
    [data.fees, data.members, feeSearch, from, to, invalidRange],
  );
  const total = data.fees.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const filteredTotal = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const thisMonthPayments = data.fees.filter((payment) =>
    payment.date.startsWith(today.slice(0, 7)),
  );
  const thisMonthTotal = thisMonthPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
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
  const currentYear = today.slice(0, 4);
  const activeFilter =
    period !== "this-month" || Boolean(feeSearch.trim()) || invalidRange;
  const filteredLabel = periodLabel(period, from, to, today);
  const yearStartsOpen = (year: string) =>
    Boolean(feeSearch.trim()) ||
    period === `year-${year}` ||
    (period !== "all" && yearlyGroups.length === 1) ||
    year === currentYear;

  function downloadReport() {
    if (!payments.length || invalidRange) return;
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

  return (
    <section className="grid gap-5">
      <div className="grid max-w-3xl grid-cols-2 gap-2 sm:gap-3">
        {[
          [
            "Collected till date",
            money(total),
            `${data.fees.length} lifetime payments`,
          ],
          [
            "Collected this month",
            money(thisMonthTotal),
            `${thisMonthPayments.length} ${thisMonthPayments.length === 1 ? "payment" : "payments"}`,
          ],
        ].map(([label, value, note], index) => (
          <article
            key={label}
            className={`min-w-0 rounded-[1.2rem] border-2 p-3 sm:p-4 ${["border-indigo-200 bg-indigo-50/70", "border-emerald-200 bg-emerald-50/70"][index]}`}
          >
            <span className="block text-[11px] font-bold leading-tight text-slate-600 min-[370px]:text-xs sm:text-sm">
              {label}
            </span>
            <strong className="mt-1.5 block truncate font-display text-xl text-slate-900 min-[370px]:text-2xl">
              {value}
            </strong>
            <small className="mt-1 block text-[10px] leading-tight text-slate-600 min-[370px]:text-xs">
              {note}
            </small>
          </article>
        ))}
      </div>
      <SectionJumpNav
        items={[
          { id: "fees-dues", label: "Renewals & dues" },
          { id: "fees-archive", label: "Collection archive" },
        ]}
      />
      <SearchField
        value={feeSearch}
        onChange={setFeeSearch}
        placeholder="Search dues and collections"
        ariaLabel="Search fees and members"
        className="sm:hidden"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,.9fr)_minmax(0,1.1fr)]">
        <article id="fees-dues" className="panel scroll-mt-24 p-4 sm:p-6">
          <div className="section-title">
            <div>
              <div className="flex items-center gap-3">
                <h2>Renewals & dues</h2>
                <StatusPill tone={visibleDue.length ? "overdue" : "active"}>
                  {visibleDue.length}
                </StatusPill>
              </div>
              <p>Unpaid, expired, or due within 7 days</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
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
        </article>
        <article
          id="fees-archive"
          className="panel scroll-mt-24 overflow-hidden"
        >
          <div className="p-4 sm:p-5">
            <div className="section-title">
              <div>
                <h2>Collection archive</h2>
                <p>Monthly totals and payment records</p>
                {activeFilter && !invalidRange && (
                  <small className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">
                    {filteredLabel} · {money(filteredTotal)} · {payments.length}{" "}
                    {payments.length === 1 ? "payment" : "payments"}
                  </small>
                )}
              </div>
              <Button
                variant="secondary"
                disabled={!payments.length || invalidRange}
                onClick={downloadReport}
              >
                Download CSV
              </Button>
            </div>
            <div
              className={`mt-4 grid gap-3 ${period === "custom" ? "sm:grid-cols-2 2xl:grid-cols-4" : "sm:grid-cols-[minmax(180px,260px)_minmax(260px,1fr)]"}`}
            >
              <label>
                Period
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="this-year">This year</option>
                  {years.map((year) => (
                    <option key={year} value={`year-${year}`}>
                      Calendar year {year}
                    </option>
                  ))}
                  <option value="all">All time</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>
              {period === "custom" && (
                <>
                  <label>
                    From
                    <input
                      type="date"
                      max={today}
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      max={today}
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                    />
                  </label>
                </>
              )}
              <label
                className={`hidden sm:grid ${period === "custom" ? "sm:col-span-2 2xl:col-span-1" : ""}`}
              >
                Search dues & archive
                <SearchField
                  value={feeSearch}
                  onChange={setFeeSearch}
                  placeholder="Member, phone, seat or payment mode"
                  ariaLabel="Search fees and members"
                />
              </label>
            </div>
            {invalidRange && (
              <p className="field-error mt-3">
                The end date must be on or after the start date.
              </p>
            )}
          </div>
          <div className="border-t border-slate-200">
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
                            open={Boolean(feeSearch.trim())}
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
                                    className="grid gap-3 bg-white p-3 sm:grid-cols-[1fr_auto] sm:p-4"
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
                                        Covers {prettyDate(payment.periodStart)}
                                        –{prettyDate(payment.periodEnd)}
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
        </article>
      </div>
    </section>
  );
}
