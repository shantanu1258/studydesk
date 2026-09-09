import { registerSW } from "virtual:pwa-register";

export function registerPwa() {
  if (import.meta.env.DEV) {
    void navigator.serviceWorker
      ?.getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      );
    return;
  }

  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.warn("StudyDesk could not enable offline app support.", error);
    },
  });
}
