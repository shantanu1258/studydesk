import { InstallApp } from "../components/pwa/InstallApp";
import { useAuthController } from "../controllers/useAuthController";
import { AuthScreen } from "../features/auth/AuthScreen";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";

export function App() {
  const auth = useAuthController();
  let screen;
  if (auth.loading) {
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
      <InstallApp />
    </>
  );
}
