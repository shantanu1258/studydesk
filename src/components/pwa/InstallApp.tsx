import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/Icons";
import { Modal, ModalHeader } from "../ui/Modal";

const DISMISSED_KEY = "studydesk-install-reminder-dismissed";
const OPEN_EVENT = "studydesk:open-install";

function deviceType() {
  const userAgent = navigator.userAgent || "";
  const ipad =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || ipad) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

export const openInstallApp = () => window.dispatchEvent(new Event(OPEN_EVENT));

export function InstallAppHeaderAction() {
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const markInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", markInstalled);
    return () => window.removeEventListener("appinstalled", markInstalled);
  }, []);
  if (installed) return null;
  return (
    <button
      type="button"
      onClick={openInstallApp}
      className="inline-flex size-10 items-center justify-center rounded-xl border border-white/70 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 sm:size-auto sm:min-h-8 sm:gap-1.5 sm:rounded-full sm:border-slate-300 sm:px-3 sm:py-1 sm:text-xs sm:text-slate-700 sm:hover:border-slate-400"
      aria-label="Install app"
      title="Install app"
    >
      <DownloadIcon className="size-3.5" />
      <span className="hidden sm:inline">Install app</span>
    </button>
  );
}

export function InstallApp() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [platform] = useState(deviceType);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true",
  );
  const [showHelp, setShowHelp] = useState(false);

  async function install() {
    if (!promptRef.current) {
      setShowHelp(true);
      return;
    }
    const prompt = promptRef.current;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    promptRef.current = null;
    setCanPrompt(false);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  useEffect(() => {
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    const markInstalled = () => {
      promptRef.current = null;
      setCanPrompt(false);
      setShowHelp(false);
      setInstalled(true);
    };
    const openFromSettings = () => {
      setShowHelp(true);
    };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener(OPEN_EVENT, openFromSettings);
    return () => {
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener(OPEN_EVENT, openFromSettings);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };
  const showReminder =
    !installed && !dismissed && (canPrompt || platform !== "other");
  if (installed) return null;

  return (
    <>
      {showReminder && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl">
          <button
            type="button"
            onClick={() => void install()}
            className="flex min-h-12 items-center gap-2 px-4 text-sm font-extrabold"
          >
            <DownloadIcon className="size-4" />
            Install app
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-12 border-l border-white/15 px-3 text-xl text-slate-300"
            aria-label="Dismiss install reminder"
          >
            ×
          </button>
        </div>
      )}
      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} labelledBy="install-title">
          <ModalHeader
            eyebrow="StudyDesk mobile app"
            title="Add to your Home Screen"
            text="StudyDesk opens like an app while staying connected to the same secure website and data."
            onClose={() => setShowHelp(false)}
            id="install-title"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="eyebrow">iPhone & iPad</p>
              <h3 className="mt-1 font-extrabold text-slate-900">Use Safari</h3>
              <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm text-slate-700">
                <li>Open the StudyDesk website in Safari.</li>
                <li>Tap the Share button—the square with an upward arrow.</li>
                <li>Choose “Add to Home Screen”, then tap “Add”.</li>
              </ol>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="eyebrow">Android</p>
              <h3 className="mt-1 font-extrabold text-slate-900">Use Chrome</h3>
              <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm text-slate-700">
                <li>Open the StudyDesk website in Chrome.</li>
                <li>Tap the three-dot menu.</li>
                <li>Choose “Install app” or “Add to Home screen”.</li>
              </ol>
            </section>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowHelp(false)}>
              Close
            </Button>
            {canPrompt && (
              <Button onClick={() => void install()}>Install now</Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
