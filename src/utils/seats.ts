import type { LibrarySettings, SeatSection } from "../types/domain";

const positiveInteger = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
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
    };
  });
}

export function seatCodes(settings: Partial<LibrarySettings> = {}) {
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

export const sectionSeatCodes = (section: SeatSection) =>
  seatCodes({ seatSections: [section] });

export const sectionRange = (section: SeatSection) =>
  `${section.prefix}-${String(section.start).padStart(2, "0")}–${section.prefix}-${String(section.end).padStart(2, "0")}`;
