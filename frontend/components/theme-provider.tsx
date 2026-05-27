"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemeTransitionOverlay() {
  const { resolvedTheme } = useTheme();
  const previousTheme = React.useRef<string | undefined>(undefined);
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    if (!resolvedTheme) return;
    const prev = previousTheme.current;
    previousTheme.current = resolvedTheme;

    if (prev === "dark" && resolvedTheme === "light") {
      setIsActive(true);
    }
  }, [resolvedTheme]);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(() => setIsActive(false), 500);
    return () => window.clearTimeout(timer);
  }, [isActive]);

  if (!isActive) return null;

  // Overlay animation for dark-to-light transitions.
  return <div className="theme-transition-overlay" aria-hidden="true" />;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <ThemeTransitionOverlay />
    </NextThemesProvider>
  );
}
