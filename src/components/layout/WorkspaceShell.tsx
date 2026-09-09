import { useEffect, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { InstallAppHeaderAction } from "../pwa/InstallApp";
import { PageHeader } from "./PageHeader";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/Modal";
import {
  ArrowUpIcon,
  CalendarIcon,
  GridIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "../ui/Icons";
import { Toast } from "../ui/Toast";
import { NAV_ITEMS } from "../../config/constants";
import { useTheme } from "../../context/ThemeContext";
import { useWorkspaceController } from "../../controllers/useWorkspaceController";
import { AccountDialog } from "../../features/account/AccountDialog";
import { AttendancePage } from "../../features/attendance/AttendancePage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { FeesPage } from "../../features/fees/FeesPage";
import { MemberDialogRouter } from "../../features/members/MemberDialogs";
import { MembersPage } from "../../features/members/MembersPage";
import { SearchPage } from "../../features/search/SearchPage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import type { AppUser, ProfileUpdateInput, ViewId } from "../../types/domain";
import { initials } from "../../utils/format";
import { libraryTheme } from "../../utils/theme";

const PAGE_COPY: Record<Exclude<ViewId, "overview">, [string, string]> = {
  members: ["Members", "Admissions, plans and renewals in one list."],
  fees: ["Fees", "Track monthly collections and revisit any past month."],
  search: ["Search", "Find any member by name, phone, seat or shift."],
  attendance: [
    "Attendance",
    "A simple daily record for a monitored front desk.",
  ],
  settings: ["Settings", "Shape StudyDesk around your library."],
};

const icons = {
  overview: GridIcon,
  members: UsersIcon,
  fees: WalletIcon,
  search: SearchIcon,
  attendance: CalendarIcon,
  settings: SettingsIcon,
};

const VIEW_PATHS: Record<ViewId, string> = {
  overview: "/",
  members: "/members",
  fees: "/fees",
  search: "/search",
  attendance: "/attendance",
  settings: "/settings",
};

function viewForPath(pathname: string): ViewId | null {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  const match = Object.entries(VIEW_PATHS).find(
    ([, path]) => path === normalized,
  );
  return (match?.[0] as ViewId | undefined) || null;
}

export function WorkspaceShell({
  user,
  onLogout,
  onUpdateProfile,
  onChangePassword,
}: {
  user: AppUser;
  onLogout: () => Promise<void>;
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<void>;
  onChangePassword: (password: string) => Promise<void>;
}) {
  const controller = useWorkspaceController(user);
  const { setBrowserThemeColor } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const currentView = viewForPath(location.pathname) || "overview";

  useEffect(() => {
    controller.setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname, controller.setMenuOpen]);

  useEffect(() => {
    if (
      controller.data &&
      !controller.data.settings.attendanceEnabled &&
      currentView === "attendance"
    ) {
      navigate("/", { replace: true });
    }
  }, [controller.data, currentView, navigate]);

  useEffect(() => {
    const color = controller.data?.settings.primaryColor || null;
    setBrowserThemeColor(color);
    return () => setBrowserThemeColor(null);
  }, [controller.data?.settings.primaryColor, setBrowserThemeColor]);

  const openView = (view: ViewId) => {
    controller.setQuery("");
    controller.setMenuOpen(false);
    const path = VIEW_PATHS[view];
    if (view === "search" && location.pathname !== path) {
      navigate(path, { state: { from: location.pathname } });
      return;
    }
    navigate(path);
  };

  const closeSearch = () => {
    controller.setQuery("");
    controller.setMenuOpen(false);
    const state = location.state as { from?: string } | null;
    if (state?.from && state.from !== VIEW_PATHS.search) {
      navigate(-1);
      return;
    }
    navigate(VIEW_PATHS.overview, { replace: true });
  };

  if (controller.loadError)
    return (
      <main className="grid min-h-dvh place-content-center gap-4 bg-[#f3f5f2] p-6 text-center">
        <img
          className="mx-auto size-14 rounded-2xl"
          src="./studydesk-monogram.png"
          alt=""
        />
        <h1 className="font-display text-4xl font-bold">
          We couldn’t open your workspace
        </h1>
        <p className="max-w-lg text-slate-600">{controller.loadError}</p>
        <div className="flex justify-center gap-3">
          <Button loading={controller.retrying} onClick={controller.retry}>
            Try again
          </Button>
          <Button
            variant="secondary"
            loading={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await onLogout();
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            Log out
          </Button>
        </div>
      </main>
    );
  if (!controller.data)
    return (
      <main className="grid min-h-dvh place-content-center gap-4 bg-[#f3f5f2] text-center">
        <img
          className="mx-auto size-14 animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-2xl"
          src="./studydesk-monogram.png"
          alt=""
        />
        <p className="font-bold text-slate-600">Loading your library…</p>
      </main>
    );

  const data = controller.data;
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.id !== "attendance" || data.settings.attendanceEnabled,
  );
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [title, subtitle] =
    currentView === "overview"
      ? [
          `${greeting}, ${firstName}.`,
          "Here’s how your study hall is doing today.",
        ]
      : PAGE_COPY[currentView];
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date())
    .toUpperCase();
  const mobileDateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date())
    .toUpperCase();
  const saveLabel =
    controller.saveState === "saving"
      ? "Saving…"
      : controller.saveState === "error"
        ? "Save issue"
        : "";
  const canAddFromHeader = currentView === "overview";

  const page = (
    <Routes>
      <Route
        path="/"
        element={
          <DashboardPage
            data={data}
            shift={controller.shift}
            setShift={controller.setShift}
            setModal={controller.setModal}
            openView={openView}
          />
        }
      />
      <Route
        path="/members"
        element={
          <MembersPage
            data={data}
            shift={controller.shift}
            query={controller.query}
            setQuery={controller.setQuery}
            setModal={controller.setModal}
          />
        }
      />
      <Route
        path="/fees"
        element={<FeesPage data={data} setModal={controller.setModal} />}
      />
      <Route
        path="/search"
        element={
          <SearchPage
            data={data}
            query={controller.query}
            setQuery={controller.setQuery}
            setModal={controller.setModal}
            onClose={closeSearch}
          />
        }
      />
      <Route
        path="/attendance"
        element={
          data.settings.attendanceEnabled ? (
            <AttendancePage data={data} commit={controller.commit} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/settings"
        element={
          <SettingsPage
            data={data}
            commit={controller.commit}
            storageMode={controller.mode}
            user={user}
            showToast={controller.showToast}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <main
      className="min-h-dvh bg-[#f3f5f2] text-slate-900"
      style={libraryTheme(data.settings)}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col bg-[var(--brand)] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${controller.menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <NavLink
          to="/"
          onClick={() => controller.setMenuOpen(false)}
          className="flex items-center gap-3 border-b border-white/15 p-5 transition hover:bg-white/5"
          aria-label="Open Overview"
        >
          <span className="theme-static-white grid size-11 place-items-center rounded-xl bg-white">
            <img
              className="size-9 rounded-lg"
              src="./studydesk-monogram.png"
              alt=""
            />
          </span>
          <div>
            <strong className="block text-lg">StudyDesk</strong>
            <small className="text-white/70">Reading room manager</small>
          </div>
        </NavLink>
        <div className="mx-4 mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
          <small className="text-[10px] font-extrabold tracking-[.18em] text-white/65">
            YOUR WORKSPACE
          </small>
          <strong className="mt-1 block font-display text-xl leading-tight text-white">
            {data.settings.library}
          </strong>
        </div>
        <nav className="mt-5 grid gap-1 px-3" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const Icon = icons[item.id];
            return (
              <NavLink
                key={item.id}
                to={VIEW_PATHS[item.id]}
                end={item.id === "overview"}
                onClick={() => {
                  controller.setQuery("");
                  controller.setMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-left text-sm font-extrabold transition ${isActive ? "theme-static-white bg-white text-slate-900 shadow-sm" : "text-white hover:bg-white/10"}`
                }
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/15 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAccountOpen(true);
                controller.setMenuOpen(false);
              }}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-white/10"
              aria-label="Open account settings"
            >
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/15 text-xs font-extrabold">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initials(user.name)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-white">
                  {user.name}
                </strong>
                <small className="block truncate text-white/65">
                  {controller.mode === "demo"
                    ? "Demo account"
                    : data.settings.isFounder
                      ? "Core admin"
                      : "Admin"}
                </small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="grid size-10 place-items-center rounded-xl text-white transition hover:bg-white/10"
              aria-label="Log out"
            >
              <LogoutIcon className="size-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-2.5 text-sm font-extrabold text-white hover:bg-white/10"
          >
            <LogoutIcon className="size-4" />
            Log out
          </button>
        </div>
      </aside>
      {controller.menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => controller.setMenuOpen(false)}
        />
      )}

      <section className="min-h-dvh lg:ml-[286px]">
        <PageHeader
          title={title}
          subtitle={subtitle}
          dateLabel={dateLabel}
          mobileDateLabel={mobileDateLabel}
          saveLabel={saveLabel}
          saveError={controller.saveState === "error"}
          utilityAction={
            currentView === "settings" ? <InstallAppHeaderAction /> : undefined
          }
          primaryAction={
            canAddFromHeader
              ? {
                  label: "Add member",
                  icon: <PlusIcon className="size-4" />,
                  onClick: () =>
                    controller.setModal({
                      type: "member",
                      shift: controller.shift,
                    }),
                }
              : undefined
          }
          onOpenOverview={() => openView("overview")}
          onSearch={() => openView("search")}
          menuOpen={controller.menuOpen}
          onToggleMenu={() => controller.setMenuOpen(!controller.menuOpen)}
        />
        <div className="mx-auto max-w-[1500px] p-4 pb-24 sm:p-7 lg:p-9">
          {page}
        </div>
      </section>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] right-4 z-20 grid size-11 place-items-center rounded-full bg-[var(--brand)] text-[var(--button-text)] shadow-lg transition hover:brightness-95 sm:hidden"
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUpIcon className="size-5" />
      </button>
      {controller.modal && (
        <MemberDialogRouter
          modal={controller.modal}
          data={data}
          shift={controller.shift}
          commit={controller.commit}
          setModal={controller.setModal}
        />
      )}
      {accountOpen && (
        <AccountDialog
          user={user}
          onClose={() => setAccountOpen(false)}
          onUpdateProfile={onUpdateProfile}
          onChangePassword={onChangePassword}
        />
      )}
      {confirmLogout && (
        <ConfirmDialog
          title="Log out of StudyDesk?"
          text="You’ll need to sign in again to manage this library."
          confirmLabel="Log out"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={async () => {
            await onLogout();
            setConfirmLogout(false);
          }}
        />
      )}
      <Toast toast={controller.toast} onDismiss={controller.dismissToast} />
    </main>
  );
}
