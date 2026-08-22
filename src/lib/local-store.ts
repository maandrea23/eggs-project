import { createFreshFarmState } from "./farm-state-defaults";
import { migrateFarmState } from "./farm-state-migration";
import type { FarmState } from "./types";

const STORAGE_KEY = "brianna-egg-farm-state-v3";

export function loadFarmState(): FarmState {
  if (typeof window === "undefined") {
    return createFreshFarmState();
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const freshState = createFreshFarmState();
      saveFarmState(freshState);
      return freshState;
    }

    const migratedState = migrateFarmState(JSON.parse(saved) as FarmState);
    saveFarmState(migratedState);
    return migratedState;
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

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(migrateFarmState(state)),
    );
  } catch {
    // La aplicación continúa usando la base de datos cuando el navegador bloquea el almacenamiento local.
  }
}

export function resetFarmState() {
  const freshState = createFreshFarmState();
  saveFarmState(freshState);
  return freshState;
}
