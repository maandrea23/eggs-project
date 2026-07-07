import { migrateFarmState } from "./farm-state-migration";
import type { FarmState } from "./types";

export function createFreshFarmState(): FarmState {
  return migrateFarmState({
    accountingWeekSettings: {
      startDate: "2026-06-02",
      startWeek: 17,
    },
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
