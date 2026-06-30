import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import type {
  Alert,
  FarmState,
  Insight,
  InvestmentCategory,
  InvestmentItem,
} from "./types";

export const CARTON_SIZE = 30;

export const formatCop = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);

export function getMonthRange(date = new Date()) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function isDateInCurrentMonth(date: string) {
  return isWithinInterval(parseISO(date), getMonthRange());
}

export function calculateFarmMetrics(state: FarmState) {
  const today = format(new Date(), "yyyy-MM-dd");
  const totalHens = state.coops.reduce((sum, coop) => sum + coop.hens, 0);
  const totalChicks = state.coops.reduce((sum, coop) => sum + coop.chicks, 0);
  const totalBirds = totalHens + totalChicks;
  const todayLog = state.eggLogs.find((log) => log.date === today);
  const eggsToday = todayLog
    ? todayLog.coop1Eggs + todayLog.coop2Eggs - todayLog.crackedEggs
    : 0;

  const goodEggsCollected = state.eggLogs.reduce(
    (sum, log) => sum + log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
    0,
  );
  const eggsSold = state.sales.reduce(
    (sum, sale) => sum + sale.cartons * CARTON_SIZE,
    0,
  );
  const eggsAvailable = Math.max(goodEggsCollected - eggsSold, 0);
  const cartonsAvailable = Math.floor(eggsAvailable / CARTON_SIZE);
  const looseEggs = eggsAvailable % CARTON_SIZE;

  const feedPurchasedKg = state.feedPurchases.reduce(
    (sum, item) => sum + item.quantityKg,
    0,
  );
  const feedUsedKg = state.feedUsage.reduce(
    (sum, item) => sum + item.quantityKg,
    0,
  );
  const feedStockKg = Math.max(feedPurchasedKg - feedUsedKg, 0);
  const monthlySales = state.sales
    .filter((sale) => isDateInCurrentMonth(sale.date))
    .reduce((sum, sale) => sum + sale.cartons * sale.pricePerCartonCop, 0);
  const monthlyFeedSpend = state.feedPurchases
    .filter((purchase) => isDateInCurrentMonth(purchase.date))
    .reduce((sum, purchase) => sum + purchase.priceCop, 0);
  const monthlyOtherExpenses = state.expenses
    .filter((expense) => isDateInCurrentMonth(expense.date))
    .reduce((sum, expense) => sum + expense.amountCop, 0);
  const monthlyExpenses = monthlyFeedSpend + monthlyOtherExpenses;
  const monthlyProfit = monthlySales - monthlyExpenses;
  const monthlyGoodEggs = state.eggLogs
    .filter((log) => isDateInCurrentMonth(log.date))
    .reduce(
      (sum, log) => sum + log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
      0,
    );
  const monthlyCartonsProduced = monthlyGoodEggs / CARTON_SIZE || 1;
  const feedCostPerEgg = monthlyGoodEggs
    ? monthlyFeedSpend / monthlyGoodEggs
    : 0;
  const feedCostPerCarton = monthlyFeedSpend / monthlyCartonsProduced;
  const avgDailyFeedKg =
    state.feedUsage.slice(-7).reduce((sum, item) => sum + item.quantityKg, 0) /
      Math.max(state.feedUsage.slice(-7).length, 1) || 0;
  const feedDaysRemaining = avgDailyFeedKg
    ? Math.floor(feedStockKg / avgDailyFeedKg)
    : 0;

  return {
    totalHens,
    totalChicks,
    totalBirds,
    eggsToday,
    cartonsAvailable,
    looseEggs,
    eggsAvailable,
    feedStockKg,
    monthlySales,
    monthlyExpenses,
    monthlyProfit,
    feedCostPerEgg,
    feedCostPerCarton,
    feedDaysRemaining,
  };
}

export function getEggChartData(state: FarmState) {
  return state.eggLogs.slice(-10).map((log) => ({
    date: format(parseISO(log.date), "MMM d"),
    "Coop 1": log.coop1Eggs,
    "Coop 2": log.coop2Eggs,
    Cracked: log.crackedEggs,
  }));
}

export function getReportRows(state: FarmState) {
  return state.eggLogs.slice(-14).map((log) => {
    const salesForDay = state.sales.filter((sale) => sale.date === log.date);
    const expensesForDay = state.expenses.filter(
      (expense) => expense.date === log.date,
    );

    return {
      date: log.date,
      coop1Eggs: log.coop1Eggs,
      coop2Eggs: log.coop2Eggs,
      crackedEggs: log.crackedEggs,
      goodEggs: log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
      cartonsSold: salesForDay.reduce((sum, sale) => sum + sale.cartons, 0),
      salesCop: salesForDay.reduce(
        (sum, sale) => sum + sale.cartons * sale.pricePerCartonCop,
        0,
      ),
      expensesCop: expensesForDay.reduce(
        (sum, expense) => sum + expense.amountCop,
        0,
      ),
    };
  });
}

export function buildAlerts(state: FarmState): Alert[] {
  const metrics = calculateFarmMetrics(state);
  const latestLogs = state.eggLogs.slice(-7);
  const avgEggs =
    latestLogs.reduce(
      (sum, log) => sum + log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
      0,
    ) / Math.max(latestLogs.length, 1);
  const latestLog = state.eggLogs.at(-1);
  const latestGoodEggs = latestLog
    ? latestLog.coop1Eggs + latestLog.coop2Eggs - latestLog.crackedEggs
    : 0;
  const alerts: Alert[] = [];

  if (metrics.feedStockKg < 90) {
    alerts.push({
      id: "low-feed",
      tone: "danger",
      title: "Low feed stock",
      detail: `Only ${formatNumber(metrics.feedStockKg)} kg remaining.`,
    });
  } else if (metrics.feedDaysRemaining <= 7) {
    alerts.push({
      id: "feed-days",
      tone: "warning",
      title: "Feed buying reminder",
      detail: `Estimated ${metrics.feedDaysRemaining} days of feed left.`,
    });
  }

  if (latestGoodEggs < avgEggs * 0.85) {
    alerts.push({
      id: "production-drop",
      tone: "warning",
      title: "Production dropped",
      detail: "Latest egg collection is below the recent 7-day average.",
    });
  }

  const recentHealth = state.healthRecords.find(
    (record) => differenceInCalendarDays(new Date(), parseISO(record.date)) <= 7,
  );

  if (recentHealth) {
    alerts.push({
      id: "health",
      tone: "info",
      title: "Recent health note",
      detail: recentHealth.notes,
    });
  }

  const dueTask = state.maintenanceTasks.find(
    (task) =>
      task.status === "open" &&
      differenceInCalendarDays(parseISO(task.dueDate), new Date()) <= 2,
  );

  if (dueTask) {
    alerts.push({
      id: "maintenance",
      tone: "warning",
      title: "Maintenance due",
      detail: `${dueTask.title} is due ${dueTask.dueDate}.`,
    });
  }

  state.inventoryItems
    .filter((item) => item.quantity <= item.reorderLevel)
    .forEach((item) => {
      alerts.push({
        id: `stock-${item.id}`,
        tone: "warning",
        title: `${item.name} low`,
        detail: `${formatNumber(item.quantity)} ${item.unit} on hand.`,
      });
    });

  return alerts.slice(0, 5);
}

export const INVESTMENT_CATEGORIES: {
  key: InvestmentCategory;
  label: string;
  color: string;
}[] = [
  { key: "galpon_construccion", label: "Galpon - Construccion", color: "var(--base-clay)" },
  { key: "galpon_materiales_olga", label: "Galpon - Materiales OLGA", color: "var(--base-harvest)" },
  { key: "galpon_materiales_homecenter", label: "Galpon - Materiales Homecenter", color: "var(--base-moss)" },
  { key: "galpon_materiales_laroca", label: "Galpon - Materiales La Roca", color: "var(--base-plum)" },
  { key: "gallinas_compra", label: "Gallinas - Compra", color: "#e8c4a0" },
  { key: "gallinas_alimento", label: "Gallinas - Alimento", color: "#c4d4b0" },
  { key: "gallinas_medicina_vacunas", label: "Gallinas - Medicina/Vacunas", color: "#d4b0c4" },
  { key: "gallinas_implementos", label: "Gallinas - Implementos", color: "#b0c4d4" },
  { key: "gastos_semanales", label: "Gastos Semanales Pre-Produccion", color: "#e0d0a0" },
];

export function calculateInvestmentByCategory(
  investments: InvestmentItem[],
): Record<InvestmentCategory, number> {
  const result: Record<string, number> = {};
  for (const inv of investments) {
    result[inv.category] = (result[inv.category] ?? 0) + inv.totalPrice;
  }
  return result as Record<InvestmentCategory, number>;
}

export function calculateTotalInvestment(investments: InvestmentItem[]): number {
  return investments.reduce((sum, inv) => sum + inv.totalPrice, 0);
}

export function calculateInvestmentBreakdown(
  investments: InvestmentItem[],
) {
  const byCategory = calculateInvestmentByCategory(investments);
  const total = calculateTotalInvestment(investments);

  return {
    total,
    byCategory,
    categories: INVESTMENT_CATEGORIES.map((cat) => ({
      ...cat,
      amount: byCategory[cat.key] ?? 0,
      percentage: total ? ((byCategory[cat.key] ?? 0) / total) * 100 : 0,
    })),
  };
}

export function getGalponTotal(investments: InvestmentItem[]): number {
  const galponCategories: InvestmentCategory[] = [
    "galpon_construccion",
    "galpon_materiales_olga",
    "galpon_materiales_homecenter",
    "galpon_materiales_laroca",
  ];
  return investments
    .filter((inv) => galponCategories.includes(inv.category))
    .reduce((sum, inv) => sum + inv.totalPrice, 0);
}

export function getBirdsTotalInvestment(investments: InvestmentItem[]): number {
  const birdCategories: InvestmentCategory[] = [
    "gallinas_compra",
    "gallinas_alimento",
    "gallinas_medicina_vacunas",
    "gallinas_implementos",
  ];
  return investments
    .filter((inv) => birdCategories.includes(inv.category))
    .reduce((sum, inv) => sum + inv.totalPrice, 0);
}

export function buildInsights(state: FarmState): Insight[] {
  const metrics = calculateFarmMetrics(state);
  const thisWeek = state.eggLogs.filter(
    (log) => parseISO(log.date) >= subDays(new Date(), 7),
  );
  const previousWeek = state.eggLogs.filter((log) => {
    const date = parseISO(log.date);
    return date >= subDays(new Date(), 14) && date < subDays(new Date(), 7);
  });
  const coop1Week = thisWeek.reduce((sum, log) => sum + log.coop1Eggs, 0);
  const coop2Week = thisWeek.reduce((sum, log) => sum + log.coop2Eggs, 0);
  const thisWeekEggs = thisWeek.reduce(
    (sum, log) => sum + log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
    0,
  );
  const previousWeekEggs = previousWeek.reduce(
    (sum, log) => sum + log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
    0,
  );
  const productionChange = previousWeekEggs
    ? ((thisWeekEggs - previousWeekEggs) / previousWeekEggs) * 100
    : 0;

  const totalInvestment = calculateTotalInvestment(
    state.investments ?? [],
  );

  return [
    {
      id: "coop-comparison",
      title:
        coop1Week >= coop2Week
          ? "Coop 1 produced more eggs this week."
          : "Coop 2 produced more eggs this week.",
      value: `${Math.abs(coop1Week - coop2Week)} egg difference`,
      detail: `Coop 1: ${coop1Week} eggs. Coop 2: ${coop2Week} eggs.`,
    },
    {
      id: "cartons-ready",
      title: "Cartons ready to sell",
      value: `${metrics.cartonsAvailable} cartons`,
      detail: `${metrics.looseEggs} loose eggs remain after full cartons.`,
    },
    {
      id: "feed-days",
      title: "Feed runway",
      value: `${metrics.feedDaysRemaining} days`,
      detail: `${formatNumber(metrics.feedStockKg)} kg estimated stock.`,
    },
    {
      id: "profit",
      title: "Estimated profit this month",
      value: formatCop(metrics.monthlyProfit),
      detail: `Sales minus feed and operating expenses.`,
    },
    {
      id: "feed-cost",
      title: "Feed cost per carton",
      value: formatCop(metrics.feedCostPerCarton),
      detail: `${formatCop(metrics.feedCostPerEgg)} per egg this month.`,
    },
    {
      id: "egg-trend",
      title:
        productionChange >= 0
          ? "Egg production improved."
          : "Egg production dropped.",
      value: `${formatNumber(Math.abs(productionChange))}%`,
      detail: "Compared with the previous 7 days.",
    },
    ...(totalInvestment > 0
      ? [
          {
            id: "total-investment",
            title: "Total inversion hasta la fecha",
            value: formatCop(totalInvestment),
            detail: `Galpon + gallinas + alimento + implementos`,
          } as Insight,
        ]
      : []),
  ];
}
