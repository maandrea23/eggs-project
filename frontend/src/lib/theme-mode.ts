export type ThemeMode = "daylight" | "nighttime";

const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 18;
export const DEVICE_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function getClockThemeMode(date = new Date()): ThemeMode {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR
    ? "daylight"
    : "nighttime";
}

export function getAutomaticThemeMode(windowRef: Window): ThemeMode {
  const clockMode = getClockThemeMode();
  const prefersDark =
    typeof windowRef.matchMedia === "function" &&
    windowRef.matchMedia(DEVICE_COLOR_SCHEME_QUERY).matches;

  return prefersDark || clockMode === "nighttime" ? "nighttime" : "daylight";
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = mode;
  }
}
