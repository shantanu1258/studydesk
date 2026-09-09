export interface SectionJumpItem {
  id: string;
  label: string;
}

export function SectionJumpNav({
  items,
  label = "Jump to section",
}: {
  items: SectionJumpItem[];
  label?: string;
}) {
  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav className="panel overflow-hidden p-3 sm:hidden" aria-label={label}>
      <p className="eyebrow">{label}</p>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => jumpTo(item.id)}
            className="shrink-0 whitespace-nowrap rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-text)] transition hover:brightness-95"
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
