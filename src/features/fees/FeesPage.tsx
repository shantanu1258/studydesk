import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
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

const ARCHIVE_MONTH_BATCH = 3;
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
  const [visibleMonthCount, setVisibleMonthCount] =
    useState(ARCHIVE_MONTH_BATCH);
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
  const groups = payments.reduce<Map<string, Payment[]>>((map, payment) => {
    const month = payment.date.slice(0, 7);
    map.set(month, [...(map.get(month) || []), payment]);
    return map;
  }, new Map());
  const monthlyGroups = [...groups.entries()].sort(([a], [b]) =>
    b.localeCompare(a),
  );
  const visibleMonthlyGroups = monthlyGroups.slice(0, visibleMonthCount);
  const remainingMonths = Math.max(
    0,
    monthlyGroups.length - visibleMonthlyGroups.length,
  );
  const average = monthlyGroups.length
    ? Math.round(filteredTotal / monthlyGroups.length)
    : 0;

  useEffect(() => {
    setVisibleMonthCount(ARCHIVE_MONTH_BATCH);
  }, [feeSearch, period, customFrom, customTo]);

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
      <div className="grid gap-3 md:grid-cols-3">
        {[
          [
            "Collected till date",
            money(total),
            `${data.fees.length} lifetime payments`,
          ],
          [
            "Selected period",
            money(filteredTotal),
            `${payments.length} payments`,
          ],
          [
            "Active-month average",
            money(average),
            `${monthlyGroups.length} months with collections`,
          ],
        ].map(([label, value, note], index) => (
          <article
            key={label}
            className={`rounded-[1.35rem] border-2 p-5 ${["border-indigo-200 bg-indigo-50/70", "border-emerald-200 bg-emerald-50/70", "status-warning-surface"][index]}`}
          >
            <span className="text-sm font-bold text-slate-600">{label}</span>
            <strong className="mt-2 block font-display text-3xl text-slate-900">
              {value}
            </strong>
            <small className="mt-1 block text-slate-600">{note}</small>
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
                {monthlyGroups.length > ARCHIVE_MONTH_BATCH && (
                  <small className="mt-1 block font-semibold text-slate-500">
                    Showing {visibleMonthlyGroups.length} of{" "}
                    {monthlyGroups.length} months
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
            {monthlyGroups.length ? (
              <>
                {visibleMonthlyGroups.map(([month, monthPayments], index) => (
                  <details
                    key={month}
                    open={index === 0}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 bg-slate-50 p-4 marker:text-slate-500 transition hover:bg-slate-100 sm:px-6">
                      <span>
                        <strong className="inline-flex rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[var(--accent-text)]">
                          {monthLabel(month)}
                        </strong>
                        <small className="text-slate-500">
                          <span className="mt-1.5 block">
                            {monthPayments.length} payments · Select to expand
                          </span>
                        </small>
                      </span>
                      <b>
                        {money(
                          monthPayments.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                          ),
                        )}
                      </b>
                    </summary>
                    <div className="grid gap-px bg-slate-200">
                      {monthPayments.map((payment) => {
                        const deletable =
                          daysSince(payment.date) >= 0 &&
                          daysSince(payment.date) <= PAYMENT_EDIT_REVIEW_DAYS;
                        const member = data.members.find(
                          (item) => item.id === payment.memberId,
                        );
                        return (
                          <div
                            className="grid gap-3 bg-white p-4 sm:grid-cols-[1fr_auto] sm:px-6"
                            key={payment.id}
                          >
                            <div>
                              <strong>
                                {payment.memberName || member?.name || "Member"}
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
                ))}
                {remainingMonths > 0 && (
                  <div className="border-t border-slate-200 p-4 sm:px-6">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        setVisibleMonthCount(
                          (current) => current + ARCHIVE_MONTH_BATCH,
                        )
                      }
                    >
                      Show older months · {remainingMonths} remaining
                    </Button>
                  </div>
                )}
              </>
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
          <p className="helper p-4 sm:px-6">
            Every payment can be corrected. Payments older than 4 days show an
            extra warning; deletion remains limited to recent records.
          </p>
        </article>
      </div>
    </section>
  );
}
