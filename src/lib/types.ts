export type Coop = {
  id: string;
  name: string;
  capacity: number;
  hens: number;
  chicks: number;
  notes?: string;
};

export type BirdMovement = {
  id: string;
  date: string;
  coopId: string;
  type: "new_birds" | "death" | "removal" | "transfer_in" | "transfer_out";
  quantity: number;
  notes?: string;
};

export type EggLog = {
  id: string;
  date: string;
  coop1Eggs: number;
  coop2Eggs: number;
  crackedEggs: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
};

export type Sale = {
  id: string;
  date: string;
  cartons: number;
  pricePerCartonCop: number;
  customerName?: string;
};

export type FeedPurchase = {
  id: string;
  date: string;
  feedType: string;
  quantityKg: number;
  priceCop: number;
  supplier?: string;
};

export type FeedUsage = {
  id: string;
  date: string;
  quantityKg: number;
  coopId?: string;
  notes?: string;
};

export type Expense = {
  id: string;
  date: string;
  category:
    | "maintenance"
    | "medicine"
    | "vaccines"
    | "bedding"
    | "transport"
    | "labour"
    | "electricity"
    | "water"
    | "repairs"
    | "packaging"
    | "cleaning";
  amountCop: number;
  description: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: "feed" | "medicine" | "vaccines" | "cleaning" | "packaging";
  quantity: number;
  unit: string;
  reorderLevel: number;
};

export type HealthRecord = {
  id: string;
  date: string;
  coopId?: string;
  type: "sick" | "death" | "vaccination" | "medicine";
  sickBirds?: number;
  deaths?: number;
  notes: string;
};

export type MaintenanceTask = {
  id: string;
  title: string;
  dueDate: string;
  coopId?: string;
  status: "open" | "done";
  notes?: string;
};

export type OfflineQueueItem = {
  id: string;
  tableName: "egg_logs" | "sales" | "feed_usage" | "expenses";
  action: "insert";
  payload: unknown;
  createdAt: string;
  syncedAt?: string;
};

export type FarmState = {
  coops: Coop[];
  birdMovements: BirdMovement[];
  eggLogs: EggLog[];
  sales: Sale[];
  feedPurchases: FeedPurchase[];
  feedUsage: FeedUsage[];
  expenses: Expense[];
  inventoryItems: InventoryItem[];
  healthRecords: HealthRecord[];
  maintenanceTasks: MaintenanceTask[];
  offlineQueue: OfflineQueueItem[];
};

export type Alert = {
  id: string;
  tone: "warning" | "danger" | "info" | "success";
  title: string;
  detail: string;
};

export type Insight = {
  id: string;
  title: string;
  value: string;
  detail: string;
};
