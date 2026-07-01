import { migrateFarmState } from "./farm-state-migration";
import type { FarmState } from "./types";

export function createFreshFarmState(): FarmState {
  return migrateFarmState({
    coops: [],
    birdMovements: [],
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
  });
}
