import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceRepository } from "../repositories/workspaceRepository";
import type {
  AppUser,
  ModalState,
  ToastMessage,
  ToastTone,
  ViewId,
  WorkspaceData,
  WorkspaceMutation,
} from "../types/domain";
import { configuredShifts } from "../utils/shifts";

export type SaveState = "saved" | "saving" | "error";

export function useWorkspaceController(user: AppUser) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [view, setView] = useState<ViewId>("overview");
  const [shift, setShift] = useState("Morning");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const previousViewRef = useRef<ViewId>("overview");
  const dataRef = useRef<WorkspaceData | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingWrites = useRef(0);
  const mode = workspaceRepository.mode(user);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      setToast({ id: Date.now(), message, tone });
    },
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let active = true;
    workspaceRepository
      .load(user)
      .then((workspace) => {
        if (!active) return;
        dataRef.current = workspace;
        setData(workspace);
        setLoadError("");
        setRetrying(false);
      })
      .catch((reason: Error) => {
        if (!active) return;
        setLoadError(reason.message || "Could not load your workspace.");
        setRetrying(false);
      });
    return () => {
      active = false;
    };
  }, [user, reloadKey]);

  useEffect(() => {
    if (!data) return;
    const shifts = configuredShifts(data.settings);
    if (!shifts.some((item) => item.name === shift))
      setShift(shifts[0]?.name || "Daily");
  }, [data, shift]);

  useEffect(() => {
    if (data && !data.settings.attendanceEnabled && view === "attendance") {
      setView("overview");
    }
  }, [data, view]);

  const retry = useCallback(() => {
    setRetrying(true);
    setReloadKey((value) => value + 1);
  }, []);

  const openView = useCallback((next: ViewId) => {
    setView((current) => {
      if (next === "search" && current !== "search")
        previousViewRef.current = current;
      return next;
    });
    setQuery("");
    setMenuOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    setView(previousViewRef.current);
    setQuery("");
    setMenuOpen(false);
  }, []);

  const commit = useCallback(
    (update: WorkspaceMutation, message?: string) => {
      const previous = dataRef.current;
      if (!previous) return Promise.resolve(false);

      const next = structuredClone(previous);
      update(next);
      next.settings.id = previous.settings.id;
      dataRef.current = next;
      setData(next);
      pendingWrites.current += 1;
      setSaveState("saving");

      const operation = writeQueue.current
        .then(() => workspaceRepository.persist(user, previous, next))
        .then(() => {
          pendingWrites.current -= 1;
          if (pendingWrites.current === 0) setSaveState("saved");
          if (message) showToast(message, "success");
          return true;
        })
        .catch(async (reason: Error) => {
          pendingWrites.current = Math.max(0, pendingWrites.current - 1);
          setSaveState("error");
          showToast(
            reason.message || "That change could not be saved.",
            "error",
          );
          try {
            const fresh = await workspaceRepository.load(user);
            dataRef.current = fresh;
            setData(fresh);
          } catch {
            setLoadError("Your data could not be refreshed. Please try again.");
          }
          return false;
        });

      writeQueue.current = operation.then(() => undefined);
      return operation;
    },
    [showToast, user],
  );

  return {
    data,
    loadError,
    retrying,
    retry,
    saveState,
    mode,
    view,
    openView,
    closeSearch,
    shift,
    setShift,
    query,
    setQuery,
    modal,
    setModal,
    toast,
    dismissToast,
    showToast,
    menuOpen,
    setMenuOpen,
    commit,
  };
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
