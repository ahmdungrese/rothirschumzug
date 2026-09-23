"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Standard-Modus: Hell-Modus (Light) as default for system
    const hasDefaultedToLight = localStorage.getItem("rothirsch-theme-default-v2");
    if (!hasDefaultedToLight) {
      localStorage.setItem("rothirsch-theme", "light");
      localStorage.setItem("rothirsch-theme-default-v2", "true");
      setTheme("light");
    } else {
      const storedTheme = localStorage.getItem("rothirsch-theme") as Theme;
      setTheme(storedTheme === "dark" ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Update local storage
    localStorage.setItem("rothirsch-theme", theme);
    
    // Apply classes to HTML element (both 'dark'/'light' for Tailwind and 'dark-mode'/'light-mode' for legacy CSS)
    if (theme === "light") {
      document.documentElement.classList.add("light", "light-mode");
      document.documentElement.classList.remove("dark", "dark-mode");
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
    } else {
      document.documentElement.classList.add("dark", "dark-mode");
      document.documentElement.classList.remove("light", "light-mode");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  // Prevent flash of incorrect theme during hydration
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
