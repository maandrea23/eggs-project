import {
  EGG_SIZE_ORDER,
  getEggSizeTotal,
  normalizeEggSizeBreakdown,
} from "./egg-classification";
import type {
  AccountingWeekSettings,
  EggSizeBreakdown,
  EggSizeCategory,
  FarmState,
} from "./types";

const DEFAULT_ACCOUNTING_WEEK_SETTINGS: AccountingWeekSettings = {
  startDate: "2026-06-02",
  startWeek: 17,
};

function normalizeAccountingWeekSettings(
  settings?: Partial<AccountingWeekSettings>,
): AccountingWeekSettings {
  const startDate =
    typeof settings?.startDate === "string" && settings.startDate
      ? settings.startDate
      : DEFAULT_ACCOUNTING_WEEK_SETTINGS.startDate;
  const startWeek = Number(settings?.startWeek);

  return {
    startDate,
    startWeek: Number.isFinite(startWeek) && startWeek > 0
      ? Math.round(startWeek)
      : DEFAULT_ACCOUNTING_WEEK_SETTINGS.startWeek,
  };
}

function parseSizeBreakdownFromNotes(notes?: string) {
  if (!notes) {
    return undefined;
  }

  const parsed: Partial<EggSizeBreakdown> = {};

  for (const category of EGG_SIZE_ORDER) {
    const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = notes.match(
      new RegExp(`(?:^|[\\s|,;])${escapedCategory}\\s*:\\s*(\\d+)`, "i"),
    );

    if (match) {
      parsed[category] = Number.parseInt(match[1], 10);
    }
  }

  const normalized = normalizeEggSizeBreakdown(parsed);
  return getEggSizeTotal(normalized) > 0 ? normalized : undefined;
}

function parseSaleCategory(customerName?: string) {
  const normalized = String(customerName ?? "").toLowerCase();

  if (normalized.includes("jumbo")) {
    return "Jumbo";
  }

  const match = normalized.match(/\b(aaa|aa|a|b|c)\b/i);

  return match ? (match[1].toUpperCase() as EggSizeCategory) : undefined;
}

function buildBreakdownByDateFromSales(state: FarmState) {
  const byDate = new Map<string, EggSizeBreakdown>();

  for (const sale of state.sales ?? []) {
    const summaryBreakdown = parseSizeBreakdownFromNotes(sale.customerName);
    const current = byDate.get(sale.date) ?? normalizeEggSizeBreakdown();

    if (summaryBreakdown) {
      EGG_SIZE_ORDER.forEach((category) => {
        current[category] += summaryBreakdown[category];
      });
      byDate.set(sale.date, current);
      continue;
    }

    const category = parseSaleCategory(sale.customerName);

    if (!category) {
      continue;
    }

    current[category] += Math.max(Math.round(Number(sale.cartons) || 0), 0);
    byDate.set(sale.date, current);
  }

  return byDate;
}

export function migrateFarmState(state: FarmState): FarmState {
  const legacyState = state as Partial<FarmState>;
  const withDefaults: FarmState = {
    ...state,
    accountingWeekSettings: normalizeAccountingWeekSettings(
      legacyState.accountingWeekSettings,
    ),
    flockArrivals: (state as any).flockArrivals ?? [],
    mortalityRecords: (state as any).mortalityRecords ?? [],
  };

  const salesBreakdownByDate = buildBreakdownByDateFromSales(withDefaults);

  return {
    ...withDefaults,
    eggLogs: (withDefaults.eggLogs ?? []).map((log) => {
      const existingBreakdown = normalizeEggSizeBreakdown(
        (log as any).sizeBreakdown,
      );
      const notesBreakdown = parseSizeBreakdownFromNotes(log.notes);
      const salesBreakdown = salesBreakdownByDate.get(log.date);
      const sizeBreakdown =
        getEggSizeTotal(existingBreakdown) > 0
          ? existingBreakdown
          : notesBreakdown ?? salesBreakdown;

      return {
        id: (log as any).id,
        date: (log as any).date,
        totalEggs:
          (log as any).totalEggs ??
          ((log as any).coop1Eggs ?? 0) + ((log as any).coop2Eggs ?? 0),
        crackedEggs: (log as any).crackedEggs ?? 0,
        feedConsumedKg: (log as any).feedConsumedKg ?? 0,
        vitaminInWater: (log as any).vitaminInWater ?? "",
        vitaminInFeed: (log as any).vitaminInFeed ?? "",
        notes: (log as any).notes,
        synced: (log as any).synced ?? true,
        createdAt: (log as any).createdAt ?? new Date().toISOString(),
        ...(sizeBreakdown
          ? { sizeBreakdown: normalizeEggSizeBreakdown(sizeBreakdown) }
          : {}),
      };
    }),
  };
}
