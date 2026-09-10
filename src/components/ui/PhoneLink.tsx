import { PhoneIcon } from "./Icons";

export const dialablePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits;
};

export function PhoneLink({
  phone,
  name,
  className = "",
}: {
  phone: string;
  name: string;
  className?: string;
}) {
  return (
    <a
      href={`tel:${dialablePhone(phone)}`}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-text)] transition hover:brightness-95 ${className}`}
      aria-label={`Call ${name} at ${phone}`}
      title={`Call ${name}`}
    >
      <PhoneIcon className="size-4" />
    </a>
  );
}
