import { useEffect, useState, type FormEvent } from "react";
import type { SignUpInput, SignUpResult } from "../../types/domain";
import { Button } from "../../components/ui/Button";
import { PasswordInput } from "../../components/ui/PasswordInput";

interface AuthScreenProps {
  initialError?: string;
  cloudConfigured: boolean;
  onSignIn: (input: { email: string; password: string }) => Promise<void>;
  onSignUp: (input: SignUpInput) => Promise<SignUpResult>;
  passwordRecovery: boolean;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onCancelPasswordRecovery: () => Promise<void>;
  onDemo: () => void;
}

type AuthMode = "login" | "signup" | "forgot" | "update";

export function AuthScreen({
  initialError = "",
  cloudConfigured,
  onSignIn,
  onSignUp,
  passwordRecovery,
  onRequestPasswordReset,
  onUpdatePassword,
  onCancelPasswordRecovery,
  onDemo,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(
    passwordRecovery ? "update" : "login",
  );
  const [signupKind, setSignupKind] = useState<"create" | "join">("create");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  useEffect(() => {
    if (passwordRecovery) {
      setMode("update");
      setError("");
      setNotice("");
    }
  }, [passwordRecovery]);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    setNotice("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();
    const email = value("email").toLowerCase();
    try {
      if (mode === "forgot") {
        await onRequestPasswordReset(email);
        setNotice(
          "If an account uses that address, a secure reset link is on its way. Check your spam folder too.",
        );
      } else if (mode === "update") {
        const password = value("password");
        if (password !== value("confirmPassword")) {
          throw new Error("The two passwords do not match.");
        }
        await onUpdatePassword(password);
        setMode("login");
        setNotice(
          "Password updated. You can now log in with your new password.",
        );
      } else if (signup) {
        const password = value("password");
        if (password !== value("confirmPassword")) {
          throw new Error("The two passwords do not match.");
        }
        const result = await onSignUp({
          email,
          password,
          name: value("name"),
          library: value("library"),
          seatCount: Number(value("seatCount")) || 24,
          primaryColor: value("primaryColor"),
          secondaryColor: value("secondaryColor"),
          inviteCode: signupKind === "join" ? value("inviteCode") : "",
        });
        if (result.needsEmailConfirmation) {
          setNotice(
            "Account created. Check your email, confirm the address, then log in.",
          );
          setMode("login");
        }
      } else {
        await onSignIn({ email, password: value("password") });
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "forgot"
      ? "Reset your password"
      : mode === "update"
        ? "Choose a new password"
        : signup
          ? signupKind === "join"
            ? "Join your team"
            : "Create your workspace"
          : "Welcome back";
  const description =
    mode === "forgot"
      ? "Enter your account email and we’ll send you a secure reset link."
      : mode === "update"
        ? "Use a strong password you haven’t used for StudyDesk before."
        : signup
          ? signupKind === "join"
            ? "Use the one-time code shared by your library."
            : "Set up your study library in under a minute."
          : "Sign in to manage your study library.";

  return (
    <main className="grid min-h-dvh bg-[#f3f5f2] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-slate-800 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <img
            className="size-11 rounded-xl"
            src="./studydesk-monogram.png"
            alt=""
          />
          <strong className="text-xl">StudyDesk</strong>
        </div>
        <div className="relative max-w-2xl">
          <p className="eyebrow !text-slate-300">
            Built for Indian study libraries
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[1.06] text-white xl:text-6xl">
            Run your reading room,
            <br />
            without the register.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200">
            Keep every seat, monthly fee, renewal and long-term payment record
            in one calm place.
          </p>
          <div className="mt-8 grid gap-3 text-sm font-bold text-slate-100">
            <span>✓ Visual seat allocation</span>
            <span>✓ Monthly fee tracking</span>
            <span>✓ Searchable fee archive</span>
          </div>
        </div>
        <p className="relative text-sm text-slate-300">
          {cloudConfigured
            ? "Secure cloud accounts and database storage."
            : "Demo mode keeps data in this browser."}
        </p>
      </section>

      <section className="flex items-center justify-center p-4 py-8 sm:p-8">
        <div className="w-full max-w-xl rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              className="size-11 rounded-xl"
              src="./studydesk-monogram.png"
              alt=""
            />
            <strong className="text-xl">StudyDesk</strong>
          </div>
          <p className="eyebrow">
            {mode === "forgot" || mode === "update"
              ? "Password recovery"
              : "Library access"}
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
            {title}
          </h2>
          <p className="mt-3 text-slate-600">{description}</p>

          {mode !== "forgot" && mode !== "update" && (
            <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              {(["login", "signup"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchMode(item)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-extrabold transition ${mode === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                >
                  {item === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>
          )}

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {signup && (
              <div
                className="grid grid-cols-2 rounded-xl border border-slate-200 p-1"
                role="group"
                aria-label="Choose account setup"
              >
                <button
                  type="button"
                  className={`rounded-lg p-2.5 text-sm font-bold ${signupKind === "create" ? "bg-slate-800 text-white" : "text-slate-600"}`}
                  onClick={() => setSignupKind("create")}
                >
                  Create a library
                </button>
                <button
                  type="button"
                  className={`rounded-lg p-2.5 text-sm font-bold ${signupKind === "join" ? "bg-slate-800 text-white" : "text-slate-600"}`}
                  onClick={() => setSignupKind("join")}
                >
                  Join with code
                </button>
              </div>
            )}
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  required
                  placeholder="e.g. Arjun Sharma"
                />
              </label>
            )}
            {signup && signupKind === "create" && (
              <>
                <label>
                  Library name
                  <input
                    name="library"
                    maxLength={120}
                    required
                    placeholder="e.g. The Focus Room"
                  />
                </label>
                <label>
                  Number of seats
                  <input
                    name="seatCount"
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={24}
                    required
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Primary colour
                    <span className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                      <input
                        className="!size-10 !min-h-0 !w-12 !border-0 !p-0"
                        name="primaryColor"
                        type="color"
                        defaultValue="#334155"
                      />
                      <small className="font-medium text-slate-500">
                        Navigation and buttons
                      </small>
                    </span>
                  </label>
                  <label>
                    Secondary colour
                    <span className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                      <input
                        className="!size-10 !min-h-0 !w-12 !border-0 !p-0"
                        name="secondaryColor"
                        type="color"
                        defaultValue="#e2e8f0"
                      />
                      <small className="font-medium text-slate-500">
                        Highlights and badges
                      </small>
                    </span>
                  </label>
                </div>
              </>
            )}
            {signup && signupKind === "join" && (
              <label>
                Invitation code
                <input
                  name="inviteCode"
                  autoCapitalize="characters"
                  maxLength={10}
                  required
                  placeholder="e.g. A1B2C3D4E5"
                />
              </label>
            )}
            {mode !== "update" && (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                {mode === "update" ? "New password" : "Password"}
                <PasswordInput
                  name="password"
                  autoComplete={
                    signup || mode === "update"
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={mode === "update" ? 8 : 6}
                  required
                  placeholder={
                    mode === "update"
                      ? "At least 8 characters"
                      : "At least 6 characters"
                  }
                />
              </label>
            )}
            {mode === "update" && (
              <label>
                Confirm new password
                <PasswordInput
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  placeholder="Enter it again"
                />
              </label>
            )}
            {signup && (
              <label>
                Confirm password
                <PasswordInput
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  placeholder="Enter it again"
                />
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setNotice("");
                }}
                className="justify-self-end text-sm font-extrabold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
              >
                Forgot password?
              </button>
            )}
            <p className="field-error">{error}</p>
            {notice && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {notice}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={busy}
              loadingLabel={
                mode === "forgot"
                  ? "Sending reset link…"
                  : mode === "update"
                    ? "Updating password…"
                    : signup
                      ? signupKind === "join"
                        ? "Joining library…"
                        : "Creating account…"
                      : "Signing in…"
              }
            >
              {mode === "forgot"
                ? notice
                  ? "Send another link"
                  : "Send reset link"
                : mode === "update"
                  ? "Update password"
                  : signup
                    ? signupKind === "join"
                      ? "Join library"
                      : "Create account"
                    : "Log in"}
            </Button>
            {(mode === "forgot" || mode === "update") && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  if (mode === "update") await onCancelPasswordRecovery();
                  setMode("login");
                  setError("");
                  setNotice("");
                }}
              >
                Back to login
              </Button>
            )}
          </form>

          {mode === "login" && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="block text-sm">
                  Want to explore first?
                </strong>
                <span className="text-sm text-slate-600">
                  Open a workspace with sample data.
                </span>
              </div>
              <Button variant="secondary" onClick={onDemo}>
                Use demo
              </Button>
            </div>
          )}
          <p
            className={`mt-5 text-center text-xs font-semibold ${cloudConfigured ? "text-emerald-700" : "status-warning-text"}`}
          >
            {cloudConfigured
              ? "Connected to Supabase · Protected by database access rules."
              : "Cloud login is not connected yet · Use demo for now."}
          </p>
        </div>
      </section>
    </main>
  );
}
