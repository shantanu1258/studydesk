import { PhoneIcon, WhatsAppIcon } from "./Icons";

export const dialablePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits;
};

export const whatsappPhone = (phone: string) =>
  dialablePhone(phone).replace(/\D/g, "");

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
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <a
        href={`tel:${dialablePhone(phone)}`}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-text)] transition hover:brightness-95 ${className}`}
        aria-label={`Call ${name} at ${phone}`}
        title={`Call ${name}`}
      >
        <PhoneIcon className="size-4" />
      </a>
      <a
        href={`https://wa.me/${whatsappPhone(phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white transition hover:brightness-95 ${className}`}
        aria-label={`Message ${name} on WhatsApp at ${phone}`}
        title={`Message ${name} on WhatsApp`}
      >
        <WhatsAppIcon className="size-4" />
      </a>
    </span>
  );
}
