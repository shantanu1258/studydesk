import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ColorTheme = "light" | "dark";

const THEME_STORAGE_KEY = "studydesk-color-theme";

interface ThemeContextValue {
  theme: ColorTheme;
  toggleTheme: () => void;
  setBrowserThemeColor: (color: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function storedTheme(): ColorTheme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function initialTheme(): ColorTheme {
  const saved = storedTheme();
  if (saved) return saved;
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === "light" || documentTheme === "dark") {
    return documentTheme;
  }
  return "light";
}

function saveTheme(theme: ColorTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);
  const [browserThemeColor, setBrowserThemeColor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        browserThemeColor || (theme === "dark" ? "#111b18" : "#334155"),
      );
    saveTheme(theme);
  }, [browserThemeColor, theme]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setTheme(event.newValue);
      }
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      saveTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setBrowserThemeColor,
    }),
    [theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
