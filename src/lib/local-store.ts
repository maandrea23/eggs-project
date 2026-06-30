import { createDemoFarmState } from "./demo-data";
import type { FarmState } from "./types";

const STORAGE_KEY = "brianna-egg-farm-state-v1";

export function loadFarmState(): FarmState {
  if (typeof window === "undefined") {
    return createDemoFarmState();
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    const demoState = createDemoFarmState();
    saveFarmState(demoState);
    return demoState;
  }

  try {
    return JSON.parse(saved) as FarmState;
  } catch {
    const demoState = createDemoFarmState();
    saveFarmState(demoState);
    return demoState;
  }
}

export function saveFarmState(state: FarmState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetFarmState() {
  const demoState = createDemoFarmState();
  saveFarmState(demoState);
  return demoState;
}
