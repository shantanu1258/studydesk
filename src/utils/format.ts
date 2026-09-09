export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function localDate(date: Date | string = new Date()) {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number | string) {
  const value = new Date(`${date}T12:00:00`);
  const originalDay = value.getDate();
  value.setDate(1);
  value.setMonth(value.getMonth() + Number(months));
  const lastDay = new Date(
    value.getFullYear(),
    value.getMonth() + 1,
    0,
  ).getDate();
  value.setDate(Math.min(originalDay, lastDay));
  return localDate(value);
}

export function monthsBetween(start?: string, end?: string) {
  if (!start || !end || end < start) return 1;
  for (let months = 1; months <= 24; months += 1) {
    if (addMonths(start, months) === end) return months;
  }
  return 1;
}

export const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(`${value.slice(0, 7)}-01T12:00:00`),
  );

export const daysUntil = (date: string) =>
  Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86_400_000);

export const daysSince = (date: string) =>
  Math.floor(
    (new Date(`${localDate()}T12:00:00`).getTime() -
      new Date(`${date}T12:00:00`).getTime()) /
      86_400_000,
  );

export const money = (value: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const prettyDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));

export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
