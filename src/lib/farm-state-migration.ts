import {
  EGG_SIZE_ORDER,
  getEggSizeTotal,
  normalizeEggSizeBreakdown,
} from "./egg-classification";
import type { Coop, EggSizeBreakdown, EggSizeCategory, FarmState } from "./types";

const PRIMARY_COOP_ID = "coop-1";

function buildPrimaryCoop(coops: Coop[] = []): Coop {
  const primaryCoop = coops.find((coop) => coop.id === PRIMARY_COOP_ID) ??
    coops[0] ?? {
      id: PRIMARY_COOP_ID,
      name: "Coop 1",
      capacity: 0,
      hens: 0,
      chicks: 0,
    };

  const combinedCapacity = coops.reduce((sum, coop) => sum + (coop.capacity || 0), 0);
  const combinedHens = coops.reduce((sum, coop) => sum + (coop.hens || 0), 0);
  const combinedChicks = coops.reduce((sum, coop) => sum + (coop.chicks || 0), 0);

  return {
    ...primaryCoop,
    id: PRIMARY_COOP_ID,
    name: primaryCoop.name || "Coop 1",
    capacity: combinedCapacity || primaryCoop.capacity || 0,
    hens: combinedHens || primaryCoop.hens || 0,
    chicks: combinedChicks || primaryCoop.chicks || 0,
  };
}

function normalizeOneCoopState(state: FarmState): FarmState {
  return {
    ...state,
    coops: [buildPrimaryCoop(state.coops ?? [])],
    birdMovements: (state.birdMovements ?? []).map((movement) => ({
      ...movement,
      coopId: PRIMARY_COOP_ID,
      notes: movement.notes?.replace(/Coop\s*2/g, "Coop 1"),
    })),
    eggLogs: (state.eggLogs ?? []).map((log) => ({
      ...log,
      coop1Eggs: (log.coop1Eggs || 0) + (log.coop2Eggs || 0),
      coop2Eggs: 0,
    })),
    feedUsage: (state.feedUsage ?? []).map((usage) => ({
      ...usage,
      coopId: usage.coopId ? PRIMARY_COOP_ID : usage.coopId,
    })),
    healthRecords: (state.healthRecords ?? []).map((record) => ({
      ...record,
      coopId: record.coopId ? PRIMARY_COOP_ID : record.coopId,
    })),
    maintenanceTasks: (state.maintenanceTasks ?? []).map((task) => ({
      ...task,
      coopId: task.coopId ? PRIMARY_COOP_ID : task.coopId,
    })),
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
  const normalizedState = normalizeOneCoopState(state);
  const salesBreakdownByDate = buildBreakdownByDateFromSales(normalizedState);

  return {
    ...normalizedState,
    eggLogs: (normalizedState.eggLogs ?? []).map((log) => {
      const existingBreakdown = normalizeEggSizeBreakdown(log.sizeBreakdown);
      const notesBreakdown = parseSizeBreakdownFromNotes(log.notes);
      const salesBreakdown = salesBreakdownByDate.get(log.date);
      const sizeBreakdown =
        getEggSizeTotal(existingBreakdown) > 0
          ? existingBreakdown
          : notesBreakdown ?? salesBreakdown;

      return {
        ...log,
        ...(sizeBreakdown
          ? { sizeBreakdown: normalizeEggSizeBreakdown(sizeBreakdown) }
          : {}),
      };
    }),
  };
}
