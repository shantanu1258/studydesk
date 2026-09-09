import { DEMO_USER, STORAGE_KEYS } from "../config/constants";
import { seedData } from "../data/seed";
import type { AppUser, WorkspaceData } from "../types/domain";

function parse<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function resolveDemoUser() {
  const session = parse<{ id?: string } | null>(
    localStorage.getItem(STORAGE_KEYS.session),
    null,
  );
  return session?.id === DEMO_USER.id ? DEMO_USER : null;
}

export const saveDemoSession = (userId: string) =>
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ id: userId }));

export const clearDemoSession = () =>
  localStorage.removeItem(STORAGE_KEYS.session);

export function loadLocalWorkspace(user: AppUser) {
  const key = STORAGE_KEYS.data + user.id;
  const stored = parse<WorkspaceData | null>(localStorage.getItem(key), null);
  if (stored) return stored;
  const workspace = seedData(user.library, user.id !== DEMO_USER.id);
  saveLocalWorkspace(user.id, workspace);
  return workspace;
}

export const saveLocalWorkspace = (userId: string, data: WorkspaceData) =>
  localStorage.setItem(STORAGE_KEYS.data + userId, JSON.stringify(data));
