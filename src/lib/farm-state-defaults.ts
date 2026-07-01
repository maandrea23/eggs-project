import { migrateFarmState } from "./farm-state-migration";
import type { FarmState } from "./types";

export function createFreshFarmState(): FarmState {
  return migrateFarmState({
    flockArrivals: [],
    mortalityRecords: [],
    eggLogs: [],
    sales: [],
    feedPurchases: [],
    feedUsage: [],
    expenses: [],
    inventoryItems: [],
    healthRecords: [],
    maintenanceTasks: [],
    investments: [],
    offlineQueue: [],
  } as any);
}
