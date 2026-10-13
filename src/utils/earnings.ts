import type { MaintenanceExpense, Payment } from "../types/domain";

const total = (records: Array<{ amount: number }>) =>
  records.reduce((sum, record) => sum + Number(record.amount), 0);

export function earningsForMonth(
  fees: Payment[],
  maintenance: MaintenanceExpense[],
  month: string,
) {
  return earningsForPeriod(
    fees,
    maintenance,
    ...earningsPeriodRange(month.slice(0, 4), month.slice(5, 7)),
  );
}

export const maintenanceTotal = (expenses: MaintenanceExpense[]) =>
  total(expenses);

export function earningsPeriodRange(
  year: string,
  month: string,
): [string, string] {
  if (year === "all") return ["", ""];
  if (month === "all") return [`${year}-01-01`, `${year}-12-31`];
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return [`${year}-${month}-01`, `${year}-${month}-${lastDay}`];
}

export function earningsForPeriod(
  fees: Payment[],
  maintenance: MaintenanceExpense[],
  from = "",
  to = "",
) {
  const inPeriod = (record: { date: string }) =>
    (!from || record.date >= from) && (!to || record.date <= to);
  const payments = fees.filter(inPeriod);
  const expenses = maintenance.filter(inPeriod);
  const feeIncome = total(payments);
  const maintenancePaid = total(expenses);
  return {
    payments,
    expenses,
    feeIncome,
    maintenancePaid,
    netEarnings: feeIncome - maintenancePaid,
  };
}
