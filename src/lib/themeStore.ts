import { useEffect, useState } from "react";
import { ensureSettings, getDb } from "./db";

export function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  useEffect(() => {
    ensureSettings().then((s) => {
      setThemeState(s.theme);
      applyTheme(s.theme);
    });
  }, []);
  const setTheme = async (t: "light" | "dark") => {
    setThemeState(t);
    applyTheme(t);
    await getDb().settings.update(1, { theme: t });
  };
  return { theme, setTheme };
}
