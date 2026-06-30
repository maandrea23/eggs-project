import { createFreshFarmState } from "./demo-data";
import type { FarmState } from "./types";

const STORAGE_KEY = "brianna-egg-farm-state-v2";

export function loadFarmState(): FarmState {
  if (typeof window === "undefined") {
    return createFreshFarmState();
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    const freshState = createFreshFarmState();
    saveFarmState(freshState);
    return freshState;
  }

  try {
    return JSON.parse(saved) as FarmState;
  } catch {
    const freshState = createFreshFarmState();
    saveFarmState(freshState);
    return freshState;
  }
}

export function saveFarmState(state: FarmState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetFarmState() {
  const freshState = createFreshFarmState();
  saveFarmState(freshState);
  return freshState;
}
