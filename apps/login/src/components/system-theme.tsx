"use client";

// MAETRY: replaces ThemeSwitch on auth.maetry.com. The login always follows the
// system light/dark setting; a choice stored while the switch was still shown is reset.
// A light or dark mode forced in Zitadel Branding still wins (theme-wrapper.tsx).
import { ThemeMode } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useThemeMode } from "./branding-context";

export function SystemTheme() {
  const { theme, setTheme } = useTheme();
  const themeMode = useThemeMode();

  useEffect(() => {
    const isForced = themeMode === ThemeMode.LIGHT || themeMode === ThemeMode.DARK;
    if (!isForced && theme !== undefined && theme !== "system") {
      setTheme("system");
    }
  }, [theme, themeMode, setTheme]);

  return null;
}
