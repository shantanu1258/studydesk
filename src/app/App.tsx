import { InstallApp } from "../components/pwa/InstallApp";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAuthController } from "../controllers/useAuthController";
import { AuthScreen } from "../features/auth/AuthScreen";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";

export function App() {
  const auth = useAuthController();
  let screen;
  let showFloatingThemeToggle = false;
  if (auth.loading) {
    showFloatingThemeToggle = true;
    screen = (
      <main className="grid min-h-dvh place-content-center gap-4 bg-[#f3f5f2] text-center">
        <img
          className="mx-auto size-14 animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-2xl"
          src="./studydesk-monogram.png"
          alt=""
        />
        <p className="font-bold text-slate-600">Opening StudyDesk…</p>
      </main>
    );
  } else if (!auth.user || auth.passwordRecovery) {
    showFloatingThemeToggle = true;
    screen = (
      <AuthScreen
        initialError={auth.error}
        cloudConfigured={auth.cloudConfigured}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        passwordRecovery={auth.passwordRecovery}
        onRequestPasswordReset={auth.requestPasswordReset}
        onUpdatePassword={auth.updatePassword}
        onCancelPasswordRecovery={auth.cancelPasswordRecovery}
        onDemo={auth.openDemo}
      />
    );
  } else {
    screen = (
      <WorkspaceShell
        key={auth.user.id}
        user={auth.user}
        onLogout={auth.signOut}
        onUpdateProfile={auth.updateProfile}
        onChangePassword={auth.changePassword}
      />
    );
  }
  return (
    <>
      {screen}
      {showFloatingThemeToggle && (
        <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-40 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
          <ThemeToggle />
        </div>
      )}
      <InstallApp />
    </>
  );
}
