"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

type ReportTheme = "dark" | "light";

const STORAGE_KEY = "kl-report-theme";
const THEME_EVENT = "kl-report-theme-change";

const readTheme = (value: string | null): ReportTheme =>
  value === "light" ? "light" : "dark";

const applyThemeClass = (shell: Element | null, theme: ReportTheme) => {
  if (!shell) return;

  shell.classList.toggle("kl-theme-light", theme === "light");
  shell.classList.toggle("kl-theme-dark", theme === "dark");
};

const getThemeSnapshot = (): ReportTheme => {
  if (typeof window === "undefined") return "dark";
  return readTheme(window.localStorage.getItem(STORAGE_KEY));
};

const getServerThemeSnapshot = (): ReportTheme => "dark";

const subscribeToTheme = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
};

export function ReportThemeButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyThemeClass(buttonRef.current?.closest(".kl") ?? null, theme);
  }, [theme]);

  const nextTheme: ReportTheme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Light mode" : "Dark mode";

  const btn: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "10.5px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: "var(--background)",
    background: "transparent",
    border: "1px solid var(--background)",
    padding: "3px 10px",
    cursor: "pointer",
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={theme === "light"}
      style={btn}
      onClick={() => {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
        window.dispatchEvent(new Event(THEME_EVENT));
        applyThemeClass(buttonRef.current?.closest(".kl") ?? null, nextTheme);
      }}
    >
      {label}
    </button>
  );
}
