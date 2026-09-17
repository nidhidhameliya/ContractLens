"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {}
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  // Apply theme immediately on first render (blocking script in <head> handles the flash)
  // Run synchronously before paint
  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem("ContractLens_theme");
    let resolved;
    if (saved === "light" || saved === "dark") {
      resolved = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      resolved = "dark";
    } else {
      resolved = "light";
    }

    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Apply to DOM whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("ContractLens_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
