import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon, SearchIcon } from "../ui/Icons";
import { ThemeToggle } from "../ui/ThemeToggle";

interface HeaderAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  dateLabel: string;
  mobileDateLabel: string;
  saveLabel?: string;
  saveError?: boolean;
  utilityAction?: ReactNode;
  primaryAction?: HeaderAction;
  onOpenOverview: () => void;
  onSearch: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

function DesktopPrimaryAction({ action }: { action: HeaderAction }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--brand)] px-3.5 py-2 text-sm font-extrabold text-[var(--button-text)] shadow-sm transition hover:brightness-95"
    >
      {action.icon}
      {action.label}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  dateLabel,
  mobileDateLabel,
  saveLabel,
  saveError = false,
  utilityAction,
  primaryAction,
  onOpenOverview,
  onSearch,
  menuOpen,
  onToggleMenu,
}: PageHeaderProps) {
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const lastScrollPosition = useRef(0);

  useEffect(() => {
    const updateToolbar = () => {
      const current = Math.max(window.scrollY, 0);
      const movement = current - lastScrollPosition.current;
      if (current < 24) setToolbarVisible(true);
      else if (movement > 7) setToolbarVisible(false);
      else if (movement < -7) setToolbarVisible(true);
      if (Math.abs(movement) > 7 || current < 24)
        lastScrollPosition.current = current;
    };
    window.addEventListener("scroll", updateToolbar, { passive: true });
    return () => window.removeEventListener("scroll", updateToolbar);
  }, []);

  return (
    <>
      <div
        className={`sticky top-0 z-30 border-b border-white/15 bg-[var(--brand)] text-[var(--button-text)] shadow-sm transition-transform duration-300 ease-out will-change-transform sm:hidden ${toolbarVisible ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="flex items-center gap-2 px-4 pb-2.5 pt-[max(.65rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onOpenOverview}
            className="flex min-w-0 items-center gap-2 rounded-xl text-left transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Open Overview"
          >
            <span className="theme-static-white grid size-9 shrink-0 place-items-center rounded-lg bg-white">
              <img
                className="size-8 rounded-md"
                src="./studydesk-monogram.png"
                alt=""
              />
            </span>
            <strong className="truncate text-sm">StudyDesk</strong>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {utilityAction}
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="theme-static-white inline-flex size-10 items-center justify-center rounded-xl border border-white/70 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
                aria-label={primaryAction.label}
                title={primaryAction.label}
              >
                {primaryAction.icon}
              </button>
            )}
            <ThemeToggle className="text-[var(--button-text)] hover:bg-white/10" />
            <button
              type="button"
              onClick={onSearch}
              className="inline-flex size-10 items-center justify-center rounded-xl transition hover:bg-white/10"
              aria-label="Search members"
              title="Search members"
            >
              <SearchIcon className="size-5" />
            </button>
            <button
              type="button"
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10"
              onClick={onToggleMenu}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <MenuIcon
                className={`absolute size-5 transition duration-200 ${menuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
              />
              <CloseIcon
                className={`absolute size-5 transition duration-200 ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
              />
            </button>
          </div>
        </div>
      </div>

      <header className="border-b border-slate-200 bg-[#f3f5f2]/95 px-4 pb-4 pt-3 text-slate-900 backdrop-blur sm:px-7 sm:pb-7 sm:pt-[max(1rem,env(safe-area-inset-top))] lg:px-9 lg:pt-8">
        <div className="mx-auto max-w-[1500px] sm:hidden">
          <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] font-extrabold tracking-[.14em] opacity-70">
              {mobileDateLabel}
            </p>
            {saveLabel && (
              <span
                className={`text-[11px] font-bold ${saveError ? "status-danger-text" : "text-slate-500"}`}
              >
                {saveLabel}
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold leading-[1.05] tracking-[-.02em] text-slate-900">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-snug opacity-75">
            {subtitle}
          </p>
        </div>

        <div className="mx-auto hidden max-w-[1500px] items-start gap-4 sm:flex">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="eyebrow">{dateLabel}</p>
              {saveLabel && (
                <span
                  className={`text-xs font-bold ${saveError ? "status-danger-text" : "text-slate-500"}`}
                >
                  {saveLabel}
                </span>
              )}
              {utilityAction}
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] tracking-[-.02em] text-slate-900">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              {subtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="text-slate-700 hover:bg-slate-200/70" />
            <button
              type="button"
              onClick={onSearch}
              className="inline-flex size-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-200/70"
              aria-label="Search members"
              title="Search members"
            >
              <SearchIcon className="size-5" />
            </button>
            {primaryAction && <DesktopPrimaryAction action={primaryAction} />}
            <button
              type="button"
              className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-200/70 lg:hidden"
              onClick={onToggleMenu}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <MenuIcon
                className={`absolute size-6 transition duration-200 ${menuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
              />
              <CloseIcon
                className={`absolute size-6 transition duration-200 ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
              />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
