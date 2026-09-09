import type { LibrarySettings, SeatSection } from "../types/domain";
import { DEFAULT_MONTHLY_FEE } from "../config/constants";

type SeatCodeSettings = Omit<Partial<LibrarySettings>, "seatSections"> & {
  seatSections?: Partial<SeatSection>[];
};
type SeatRange = Pick<SeatSection, "prefix" | "start" | "end"> &
  Partial<Pick<SeatSection, "id" | "name">>;

const positiveInteger = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const nonNegativeAmount = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

export function normalizeSeatSections(
  value?: Partial<SeatSection>[] | null,
  seatCount = 24,
  seatPrefix = "A",
): SeatSection[] {
  const fallbackEnd = positiveInteger(seatCount, 24);
  const source =
    Array.isArray(value) && value.length
      ? value
      : [
          {
            id: "main-section",
            name: "Main section",
            prefix: seatPrefix || "A",
            start: 1,
            end: fallbackEnd,
            defaultFee: DEFAULT_MONTHLY_FEE,
          },
        ];

  return source.map((section, index) => {
    const start = positiveInteger(section.start, 1);
    const end = positiveInteger(section.end, start);
    const prefix = String(section.prefix || seatPrefix || "A")
      .trim()
      .toUpperCase()
      .slice(0, 3);
    return {
      id: String(section.id || `section-${index + 1}`),
      name: String(section.name || `Section ${prefix}`)
        .trim()
        .slice(0, 40),
      prefix,
      start,
      end,
      defaultFee: nonNegativeAmount(section.defaultFee, DEFAULT_MONTHLY_FEE),
    };
  });
}

export function seatCodes(settings: SeatCodeSettings = {}) {
  const sections = normalizeSeatSections(
    settings.seatSections,
    settings.seatCount,
    settings.prefix,
  );
  return sections.flatMap((section) =>
    Array.from(
      { length: Math.max(0, section.end - section.start + 1) },
      (_, index) => {
        const number = section.start + index;
        return `${section.prefix}-${String(number).padStart(2, "0")}`;
      },
    ),
  );
}

export const seatCountFromSections = (sections: SeatSection[]) =>
  new Set(seatCodes({ seatSections: sections })).size;

export const sectionSeatCodes = (section: SeatRange) =>
  seatCodes({ seatSections: [section] });

export const sectionRange = (section: SeatRange) =>
  `${section.prefix}-${String(section.start).padStart(2, "0")}–${section.prefix}-${String(section.end).padStart(2, "0")}`;

export function defaultFeeForSeat(
  settings: Partial<LibrarySettings>,
  seat: string,
) {
  const match = /^(.+)-(\d+)$/.exec(seat);
  if (!match) return DEFAULT_MONTHLY_FEE;
  const prefix = match[1].toUpperCase();
  const number = Number(match[2]);
  const section = normalizeSeatSections(
    settings.seatSections,
    settings.seatCount,
    settings.prefix,
  ).find(
    (item) =>
      item.prefix === prefix && number >= item.start && number <= item.end,
  );
  return section?.defaultFee ?? DEFAULT_MONTHLY_FEE;
}
