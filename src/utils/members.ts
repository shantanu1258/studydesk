import type { Member, Payment } from "../types/domain";
import { daysUntil } from "./format";

export const normalizeMemberName = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

export const sameMemberIdentity = (
  member: Pick<Member, "name" | "phone"> | undefined,
  name: string,
  phone: string,
) =>
  normalizeMemberName(member?.name) === normalizeMemberName(name) &&
  String(member?.phone || "").trim() === String(phone || "").trim();

export const findMemberByIdentity = (
  members: Member[],
  name: string,
  phone: string,
  exceptId = "",
) =>
  members.find(
    (member) =>
      member.id !== exceptId && sameMemberIdentity(member, name, phone),
  );

export const currentPaymentForMember = (
  member: Member,
  payments: Payment[] = [],
) => {
  const planStart = member.planStart || member.start;
  return payments.find((payment) => {
    const periodStart = payment.periodStart || payment.date;
    const periodEnd = payment.periodEnd || payment.date;
    return (
      payment.memberId === member.id &&
      Number(payment.amount) > 0 &&
      periodStart <= planStart &&
      periodEnd >= member.expiry
    );
  });
};

export function memberStatus(
  member: Member,
  payments: Payment[] = [],
  renewalWindowDays = 5,
) {
  if (!member.active) {
    return {
      tone: "neutral" as const,
      label: "Deactivated",
      currentPayment: null,
    };
  }

  const memberPayments = payments
    .filter(
      (payment) => payment.memberId === member.id && Number(payment.amount) > 0,
    )
    .sort((first, second) =>
      (second.periodEnd || second.date).localeCompare(
        first.periodEnd || first.date,
      ),
    );
  const currentPayment = currentPaymentForMember(member, payments);
  const latestPayment = currentPayment || memberPayments[0] || null;
  const days = daysUntil(member.expiry);

  // Older imported records may not have an exact period snapshot. If they have
  // payment history and are now inside the renewal window, they are renewals,
  // not unpaid admissions. A genuinely payment-free member remains overdue.
  if (days >= 0 && days <= renewalWindowDays && latestPayment) {
    return {
      tone: "due" as const,
      label: "Renewal due",
      currentPayment: latestPayment,
      days,
    };
  }

  if (!currentPayment) {
    return {
      tone: "overdue" as const,
      label: "Payment overdue",
      currentPayment: null,
    };
  }

  if (days < 0) {
    return { tone: "overdue" as const, label: "Expired", currentPayment, days };
  }
  if (days <= renewalWindowDays) {
    return { tone: "due" as const, label: "Renewal due", currentPayment, days };
  }
  return { tone: "active" as const, label: "Active", currentPayment, days };
}
