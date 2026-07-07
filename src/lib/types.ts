export type EggLog = {
  id: string;
  date: string;
  totalEggs: number;
  crackedEggs: number;
  sizeBreakdown?: EggSizeBreakdown;
  feedConsumedKg: number;
  vitaminInWater: string;
  vitaminInFeed: string;
  notes?: string;
  synced: boolean;
  createdAt: string;
};

export type AccountingWeekSettings = {
  startDate: string;
  startWeek: number;
};

export type EggSizeCategory = "C" | "B" | "A" | "AA" | "AAA" | "Jumbo";

export type EggTrayType = "B" | "A" | "AA" | "AAA";

export type EggSizeBreakdown = Record<EggSizeCategory, number>;

export type EggWeightClassification = {
  category: EggSizeCategory;
  label: string;
  minGrams?: number;
  maxGrams?: number;
  trayType: EggTrayType;
};

export type FlockArrival = {
  id: string;
  date: string;
  quantity: number;
  breed?: string;
  notes?: string;
};

export type MortalityRecord = {
  id: string;
  date: string;
  deaths: number;
  cause?: string;
  notes?: string;
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
  type: "sick" | "death" | "vaccination" | "medicine";
  sickBirds?: number;
  deaths?: number;
  notes: string;
};

export type MaintenanceTask = {
  id: string;
  title: string;
  dueDate: string;
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

export type InvestmentCategory =
  | "galpon_construccion"
  | "galpon_materiales_olga"
  | "galpon_materiales_homecenter"
  | "galpon_materiales_laroca"
  | "gallinas_compra"
  | "gallinas_alimento"
  | "gallinas_medicina_vacunas"
  | "gallinas_implementos"
  | "gastos_semanales"
  | "cuidandero"
  | "otros";

export type InvestmentItem = {
  id: string;
  category: InvestmentCategory;
  subcategory: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  date?: string;
  supplier?: string;
};

export type UserRole = "owner" | "operator";

export type FarmState = {
  accountingWeekSettings: AccountingWeekSettings;
  flockArrivals: FlockArrival[];
  mortalityRecords: MortalityRecord[];
  eggLogs: EggLog[];
  sales: Sale[];
  feedPurchases: FeedPurchase[];
  feedUsage: FeedUsage[];
  expenses: Expense[];
  inventoryItems: InventoryItem[];
  healthRecords: HealthRecord[];
  maintenanceTasks: MaintenanceTask[];
  investments: InvestmentItem[];
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
