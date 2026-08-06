"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyThemeMode,
  DEVICE_COLOR_SCHEME_QUERY,
  getAutomaticThemeMode,
  type ThemeMode,
} from "@/lib/theme-mode";

export function useThemeMode() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("daylight");

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    applyThemeMode(mode);
  }, []);

  useEffect(() => {
    const syncAutomaticTheme = () => {
      setThemeMode(getAutomaticThemeMode(window));
    };

    syncAutomaticTheme();

    const colorSchemeQuery = window.matchMedia?.(DEVICE_COLOR_SCHEME_QUERY);
    colorSchemeQuery?.addEventListener("change", syncAutomaticTheme);

    const clockTimer = window.setInterval(syncAutomaticTheme, 60_000);

    return () => {
      colorSchemeQuery?.removeEventListener("change", syncAutomaticTheme);
      window.clearInterval(clockTimer);
    };
  }, [setThemeMode]);

  return [themeMode, setThemeMode] as const;
}
