import type { MaintenanceExpense, Payment } from "../types/domain";

const total = (records: Array<{ amount: number }>) =>
  records.reduce((sum, record) => sum + Number(record.amount), 0);

export function earningsForMonth(
  fees: Payment[],
  maintenance: MaintenanceExpense[],
  month: string,
) {
  const payments = fees.filter((payment) => payment.date.startsWith(month));
  const expenses = maintenance.filter((expense) =>
    expense.date.startsWith(month),
  );
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

export const maintenanceTotal = (expenses: MaintenanceExpense[]) =>
  total(expenses);
