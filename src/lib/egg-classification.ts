import type {
  EggSizeBreakdown,
  EggSizeCategory,
  EggWeightClassification,
} from "./types";

export const EGG_SIZE_ORDER: EggSizeCategory[] = [
  "C",
  "B",
  "A",
  "AA",
  "AAA",
  "Jumbo",
];

export const EGG_WEIGHT_CLASSIFICATIONS: EggWeightClassification[] = [
  { category: "C", label: "< 46 g", maxGrams: 45.999, trayType: "B" },
  { category: "B", label: "46 - 52.9 g", minGrams: 46, maxGrams: 52.9, trayType: "B" },
  { category: "A", label: "53 - 59.9 g", minGrams: 53, maxGrams: 59.9, trayType: "A" },
  { category: "AA", label: "60 - 66.9 g", minGrams: 60, maxGrams: 66.9, trayType: "AA" },
  { category: "AAA", label: "67 - 77.9 g", minGrams: 67, maxGrams: 77.9, trayType: "AAA" },
  { category: "Jumbo", label: "> 78 g", minGrams: 78, trayType: "AAA" },
];

export const EMPTY_EGG_SIZE_BREAKDOWN: EggSizeBreakdown = {
  C: 0,
  B: 0,
  A: 0,
  AA: 0,
  AAA: 0,
  Jumbo: 0,
};

export function normalizeEggSizeBreakdown(
  value?: Partial<Record<EggSizeCategory, number>>,
): EggSizeBreakdown {
  return EGG_SIZE_ORDER.reduce((breakdown, category) => {
    const count = Math.round(Number(value?.[category] ?? 0));
    breakdown[category] = Number.isFinite(count) ? Math.max(count, 0) : 0;
    return breakdown;
  }, { ...EMPTY_EGG_SIZE_BREAKDOWN });
}

export function getEggSizeTotal(
  value?: Partial<Record<EggSizeCategory, number>>,
) {
  const breakdown = normalizeEggSizeBreakdown(value);
  return EGG_SIZE_ORDER.reduce((sum, category) => sum + breakdown[category], 0);
}

export function formatEggSizeBreakdown(
  value?: Partial<Record<EggSizeCategory, number>>,
) {
  const breakdown = normalizeEggSizeBreakdown(value);

  return EGG_SIZE_ORDER
    .filter((category) => breakdown[category] > 0)
    .map((category) => `${category}: ${breakdown[category]}`)
    .join(" | ");
}

export function classifyEggWeight(grams: number) {
  return EGG_WEIGHT_CLASSIFICATIONS.find((classification) => {
    const aboveMinimum =
      classification.minGrams === undefined || grams >= classification.minGrams;
    const belowMaximum =
      classification.maxGrams === undefined || grams <= classification.maxGrams;
    return aboveMinimum && belowMaximum;
  });
}
