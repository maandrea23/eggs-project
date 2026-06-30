"use client";

import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bird,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  Download,
  Egg,
  HeartPulse,
  Home,
  Package,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingCart,
  Sprout,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildAlerts,
  buildInsights,
  calculateFarmMetrics,
  formatCop,
  formatNumber,
  getEggChartData,
  getReportRows,
} from "@/lib/calculations";
import { createDemoFarmState, createFreshFarmState } from "@/lib/demo-data";
import { loadFarmState, saveFarmState } from "@/lib/local-store";
import InvestmentSection from "@/components/InvestmentSection";
import type {
  Coop,
  Expense,
  FarmState,
  HealthRecord,
  InventoryItem,
} from "@/lib/types";

type AdminSection =
  | "overview"
  | "eggs"
  | "sales"
  | "expenses"
  | "flock"
  | "inventory"
  | "health"
  | "investment"
  | "reports";

type DatabaseStatus = "checking" | "ready" | "local";

type AdminNavItem = {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type SpreadsheetCell = string | number | boolean | Date | null | undefined;

type ImportedEggLog = FarmState["eggLogs"][number];

type SpreadsheetSheet = {
  sheet: string;
  data: SpreadsheetCell[][];
};

type EggImportResult = {
  entries: ImportedEggLog[];
  skippedRows: number;
  warnings: string[];
  detectedColumns: string[];
};

type FarmImportResult = {
  source: "andrea-template" | "egg-log";
  eggLogs: ImportedEggLog[];
  sales: FarmState["sales"];
  feedPurchases: FarmState["feedPurchases"];
  expenses: FarmState["expenses"];
  investments: FarmState["investments"];
  healthRecords: FarmState["healthRecords"];
  coops?: FarmState["coops"];
  skippedRows: number;
  warnings: string[];
  detectedColumns: string[];
  detectedSheets: string[];
};

type EggImportSummary = {
  fileName: string;
  importedEggLogs: number;
  importedSales: number;
  importedFeedPurchases: number;
  importedExpenses: number;
  importedInvestments: number;
  importedHealthRecords: number;
  replacedEggLogs: number;
  replacedSales: number;
  replacedFeedPurchases: number;
  replacedExpenses: number;
  replacedInvestments: number;
  replacedHealthRecords: number;
  skipped: number;
  warnings: string[];
  detectedColumns: string[];
  detectedSheets: string[];
  preview: ImportedEggLog[];
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;

const adminNav: AdminNavItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "eggs", label: "Egg Logs", icon: Egg },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "expenses", label: "Feed & Expenses", icon: ReceiptText },
  { id: "flock", label: "Coops", icon: Bird },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "investment", label: "Investment", icon: PiggyBank },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const expenseCategories: Expense["category"][] = [
  "maintenance",
  "medicine",
  "vaccines",
  "bedding",
  "transport",
  "labour",
  "electricity",
  "water",
  "repairs",
  "packaging",
  "cleaning",
];

const inventoryCategories: InventoryItem["category"][] = [
  "feed",
  "medicine",
  "vaccines",
  "cleaning",
  "packaging",
];

async function saveFarmStateToDailey(state: FarmState) {
  const response = await fetch("/api/farm-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Dailey database save failed.");
  }
}

function parseNumber(value: string) {
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseSpreadsheetNumber(value: SpreadsheetCell) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(Math.round(value), 0);
  }

  if (typeof value === "string") {
    return Math.max(parseNumber(value), 0);
  }

  return 0;
}

function parseSpreadsheetDecimal(value: SpreadsheetCell) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(value, 0);
  }

  if (typeof value === "string") {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }

  return 0;
}

function normalizeHeader(value: SpreadsheetCell) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);

  return headers.findIndex((header) =>
    normalizedAliases.some(
      (alias) => header === alias || header.includes(alias),
    ),
  );
}

function parseSpreadsheetDate(value: SpreadsheetCell) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "number" && value > 20000 && value < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return format(new Date(excelEpoch + value * 86400000), "yyyy-MM-dd");
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);

  if (slashMatch) {
    const [, first, second, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const day = firstNumber > 12 ? first : secondNumber > 12 ? second : first;
    const month = firstNumber > 12 ? second : secondNumber > 12 ? first : second;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, "yyyy-MM-dd");
  }

  return null;
}

const spanishMonthNumbers: Record<string, string> = {
  enero: "01",
  ene: "01",
  febrero: "02",
  feb: "02",
  marzo: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  mayo: "05",
  may: "05",
  junio: "06",
  jun: "06",
  julio: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  septiembre: "09",
  setiembre: "09",
  sep: "09",
  sept: "09",
  octubre: "10",
  oct: "10",
  noviembre: "11",
  nov: "11",
  diciembre: "12",
  dic: "12",
};

function parseSpanishDateInText(value: string, year = "2026") {
  const match = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/(\d{1,2})\s*(?:de\s*)?([a-z]+)/);

  if (!match) {
    return undefined;
  }

  const [, rawDay, rawMonth] = match;
  const month = spanishMonthNumbers[rawMonth];

  if (!month) {
    return undefined;
  }

  return `${year}-${month}-${rawDay.padStart(2, "0")}`;
}

function getCell(row: SpreadsheetCell[] | undefined, index: number) {
  return row?.[index];
}

function getSheet(sheets: SpreadsheetSheet[], sheetName: string) {
  const normalizedTarget = normalizeHeader(sheetName);

  return sheets.find(
    (sheet) =>
      normalizeHeader(sheet.sheet) === normalizedTarget ||
      normalizeHeader(sheet.sheet).includes(normalizedTarget),
  );
}

function parseDelimitedSpreadsheet(text: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim()));
}

async function readSpreadsheetWorkbook(file: File): Promise<SpreadsheetSheet[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "xlsx") {
    const sheets = await readXlsxFile(file);
    return sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: sheet.data as SpreadsheetCell[][],
    }));
  }

  if (extension === "csv" || extension === "tsv" || extension === "txt") {
    const text = await file.text();
    const delimiter =
      extension === "tsv" || text.split("\n")[0]?.includes("\t") ? "\t" : ",";
    return [
      {
        sheet: file.name,
        data: parseDelimitedSpreadsheet(text, delimiter),
      },
    ];
  }

  throw new Error("Please upload an .xlsx, .csv, or .tsv file.");
}

function parseEggImportRows(rows: SpreadsheetCell[][]): EggImportResult {
  const warnings: string[] = [];
  const compactRows = rows.filter((row) =>
    row.some((cell) => String(cell ?? "").trim()),
  );

  if (!compactRows.length) {
    return {
      entries: [],
      skippedRows: 0,
      warnings: ["The uploaded spreadsheet was empty."],
      detectedColumns: [],
    };
  }

  const headerRowIndex = compactRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    const dateIndex = findColumn(headers, ["date", "fecha", "day", "dia"]);
    const eggIndex = findColumn(headers, [
      "coop1",
      "coop2",
      "eggs",
      "huevos",
      "totaleggs",
    ]);

    return dateIndex >= 0 && eggIndex >= 0;
  });

  const hasHeaders = headerRowIndex >= 0;
  const headerRow = hasHeaders
    ? compactRows[headerRowIndex]
    : ["Date", "Coop 1", "Coop 2", "Cracked", "Notes"];
  const headers = headerRow.map(normalizeHeader);
  const firstDataRowIndex = hasHeaders ? headerRowIndex + 1 : 0;

  if (!hasHeaders) {
    warnings.push(
      "No header row was detected, so the importer assumed columns are Date, Coop 1, Coop 2, Cracked, Notes.",
    );
  }

  const columnMap = {
    date: findColumn(headers, [
      "date",
      "fecha",
      "day",
      "dia",
      "collectiondate",
      "eggdate",
    ]),
    coop1: findColumn(headers, [
      "coop1",
      "coop1eggs",
      "coopone",
      "cooponeeggs",
      "galpon1",
      "gallinero1",
      "house1",
    ]),
    coop2: findColumn(headers, [
      "coop2",
      "coop2eggs",
      "cooptwo",
      "cooptwoeggs",
      "galpon2",
      "gallinero2",
      "house2",
    ]),
    total: findColumn(headers, [
      "total",
      "totaleggs",
      "eggs",
      "huevos",
      "totalhuevos",
      "collected",
      "collectedeggs",
    ]),
    cracked: findColumn(headers, [
      "cracked",
      "crackedeggs",
      "broken",
      "damaged",
      "rotos",
      "quebrados",
      "huevosrotos",
    ]),
    notes: findColumn(headers, [
      "notes",
      "note",
      "notas",
      "observaciones",
      "comments",
    ]),
  };

  if (columnMap.date < 0) {
    return {
      entries: [],
      skippedRows: compactRows.length - firstDataRowIndex,
      warnings: ["A Date or Fecha column is required."],
      detectedColumns: headerRow.map((cell) => String(cell ?? "")),
    };
  }

  if (columnMap.coop1 < 0 && columnMap.coop2 < 0 && columnMap.total < 0) {
    return {
      entries: [],
      skippedRows: compactRows.length - firstDataRowIndex,
      warnings: ["At least one egg count column is required."],
      detectedColumns: headerRow.map((cell) => String(cell ?? "")),
    };
  }

  if (columnMap.total >= 0 && columnMap.coop1 < 0 && columnMap.coop2 < 0) {
    warnings.push(
      "Rows with Total Eggs but no coop split were imported into Coop 1.",
    );
  }

  const entries: ImportedEggLog[] = [];
  let skippedRows = 0;

  compactRows.slice(firstDataRowIndex).forEach((row) => {
    const date = parseSpreadsheetDate(row[columnMap.date]);

    if (!date) {
      skippedRows += 1;
      return;
    }

    const totalEggs =
      columnMap.total >= 0 ? parseSpreadsheetNumber(row[columnMap.total]) : 0;
    const coop1Eggs =
      columnMap.coop1 >= 0
        ? parseSpreadsheetNumber(row[columnMap.coop1])
        : totalEggs;
    const coop2Eggs =
      columnMap.coop2 >= 0 ? parseSpreadsheetNumber(row[columnMap.coop2]) : 0;
    const crackedEggs =
      columnMap.cracked >= 0
        ? parseSpreadsheetNumber(row[columnMap.cracked])
        : 0;
    const notes =
      columnMap.notes >= 0 ? String(row[columnMap.notes] ?? "").trim() : "";

    if (coop1Eggs + coop2Eggs + crackedEggs <= 0) {
      skippedRows += 1;
      return;
    }

    entries.push({
      id: makeId("egg-import"),
      date,
      coop1Eggs,
      coop2Eggs,
      crackedEggs,
      notes:
        columnMap.total >= 0 && columnMap.coop1 < 0 && columnMap.coop2 < 0
          ? [notes, "Imported from total egg count; no coop split in source."]
              .filter(Boolean)
              .join(" ")
          : notes,
      synced: true,
      createdAt: nowIso(),
    });
  });

  return {
    entries,
    skippedRows,
    warnings,
    detectedColumns: headerRow.map((cell) => String(cell ?? "")),
  };
}

function buildWeekStartMap(productionRows: SpreadsheetCell[][]) {
  const weekStarts = new Map<string, string>();
  let currentWeek = "";

  productionRows.forEach((row) => {
    const weekLabel = String(getCell(row, 1) ?? "").trim();
    const date = parseSpreadsheetDate(getCell(row, 2));

    if (weekLabel) {
      currentWeek = weekLabel;
    }

    if (currentWeek && date && !weekStarts.has(normalizeHeader(currentWeek))) {
      weekStarts.set(normalizeHeader(currentWeek), date);
    }
  });

  return weekStarts;
}

function buildEggNotes(row: SpreadsheetCell[], weekLabel: string) {
  const pieces = [
    weekLabel,
    String(getCell(row, 3) ?? "").trim(),
    parseSpreadsheetNumber(getCell(row, 4))
      ? `${parseSpreadsheetNumber(getCell(row, 4))} aves vivas`
      : "",
    `C: ${parseSpreadsheetNumber(getCell(row, 6))}`,
    `B: ${parseSpreadsheetNumber(getCell(row, 7))}`,
    `A: ${parseSpreadsheetNumber(getCell(row, 8))}`,
    `AA: ${parseSpreadsheetNumber(getCell(row, 9))}`,
    `AAA: ${parseSpreadsheetNumber(getCell(row, 10))}`,
  ].filter(Boolean);

  return pieces.join(" | ");
}

function parseAndreaProductionRows(
  productionRows: SpreadsheetCell[][],
): ImportedEggLog[] {
  let currentWeek = "";

  return productionRows.flatMap((row) => {
    const weekLabel = String(getCell(row, 1) ?? "").trim();
    const date = parseSpreadsheetDate(getCell(row, 2));

    if (weekLabel) {
      currentWeek = weekLabel;
    }

    if (!date) {
      return [];
    }

    const crackedEggs = parseSpreadsheetNumber(getCell(row, 11));
    const totalEggs =
      parseSpreadsheetNumber(getCell(row, 12)) ||
      parseSpreadsheetNumber(getCell(row, 5));
    const goodEggs = Math.max(totalEggs - crackedEggs, 0);

    if (goodEggs + crackedEggs <= 0) {
      return [];
    }

    return [
      {
        id: makeId("egg-import"),
        date,
        coop1Eggs: goodEggs,
        coop2Eggs: 0,
        crackedEggs,
        notes: buildEggNotes(row, currentWeek),
        synced: true,
        createdAt: nowIso(),
      },
    ];
  });
}

function parseAndreaSalesRows(ventaRows: SpreadsheetCell[][]): FarmState["sales"] {
  return ventaRows.flatMap((row) => {
    const date = parseSpreadsheetDate(getCell(row, 2));

    if (!date) {
      return [];
    }

    const eggCount = parseSpreadsheetDecimal(getCell(row, 4));
    const totalCop = parseSpreadsheetDecimal(getCell(row, 18));

    if (eggCount <= 0 || totalCop <= 0) {
      return [];
    }

    const cartons = eggCount / 30;
    const pricePerCartonCop = Math.round(totalCop / cartons);
    const sizeSummary = [
      ["C", getCell(row, 6)],
      ["B", getCell(row, 7)],
      ["A", getCell(row, 8)],
      ["AA", getCell(row, 9)],
      ["AAA", getCell(row, 10)],
      ["Jumbo/Rotos", getCell(row, 11)],
    ]
      .map(([label, value]) => `${label}: ${parseSpreadsheetNumber(value)}`)
      .join(", ");

    return [
      {
        id: makeId("sale-import"),
        date,
        cartons,
        pricePerCartonCop,
        customerName: `Andrea template sale (${sizeSummary})`,
      },
    ];
  });
}

function parseAndreaExpenseRows(
  gastosRows: SpreadsheetCell[][],
  weekStarts: Map<string, string>,
) {
  const feedPurchases: FarmState["feedPurchases"] = [];
  const expenses: FarmState["expenses"] = [];

  gastosRows.forEach((row) => {
    const weekLabel = String(getCell(row, 0) ?? "").trim();

    if (!weekLabel || !normalizeHeader(weekLabel).includes("semana")) {
      return;
    }

    const date = weekStarts.get(normalizeHeader(weekLabel)) || todayIso();
    const bultos = parseSpreadsheetDecimal(getCell(row, 1));
    const feedUnitPrice = parseSpreadsheetDecimal(getCell(row, 2));
    const feedTotal = parseSpreadsheetDecimal(getCell(row, 3)) || bultos * feedUnitPrice;
    const caretaker = parseSpreadsheetDecimal(getCell(row, 4));
    const otherDescription = String(getCell(row, 5) ?? "").trim();
    const otherAmount = parseSpreadsheetDecimal(getCell(row, 6));
    const transport = parseSpreadsheetDecimal(getCell(row, 7));

    if (bultos > 0 || feedTotal > 0) {
      feedPurchases.push({
        id: makeId("feed-import"),
        date,
        feedType: "Alimento concentrado",
        quantityKg: bultos * 50,
        priceCop: Math.round(feedTotal),
        supplier: weekLabel,
      });
    }

    if (caretaker > 0) {
      expenses.push({
        id: makeId("expense-import"),
        date,
        category: "labour",
        amountCop: Math.round(caretaker),
        description: `Cuidandero - ${weekLabel}`,
      });
    }

    if (otherAmount > 0) {
      expenses.push({
        id: makeId("expense-import"),
        date,
        category: "maintenance",
        amountCop: Math.round(otherAmount),
        description: otherDescription || `Otro gasto - ${weekLabel}`,
      });
    }

    if (transport > 0) {
      expenses.push({
        id: makeId("expense-import"),
        date,
        category: "transport",
        amountCop: Math.round(transport),
        description: `Transporte - ${weekLabel}`,
      });
    }
  });

  return { feedPurchases, expenses };
}

function buildInvestmentItem({
  category,
  subcategory,
  description,
  quantity,
  unitPrice,
  totalPrice,
  supplier,
}: {
  category: FarmState["investments"][number]["category"];
  subcategory: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  supplier?: string;
}): FarmState["investments"][number] | null {
  const cleanDescription = description.trim();
  const cleanQuantity = quantity || (unitPrice || totalPrice ? 1 : 0);
  const cleanTotal = Math.round(totalPrice || cleanQuantity * unitPrice);

  if (!cleanDescription || cleanDescription.toLowerCase().includes("total")) {
    return null;
  }

  if (cleanQuantity <= 0 && unitPrice <= 0 && cleanTotal <= 0) {
    return null;
  }

  return {
    id: makeId("investment-import"),
    category,
    subcategory,
    description: cleanDescription,
    quantity: cleanQuantity,
    unit: "unidad",
    unitPrice: Math.round(unitPrice || (cleanQuantity ? cleanTotal / cleanQuantity : cleanTotal)),
    totalPrice: cleanTotal,
    supplier,
  };
}

function parseGalponInvestments(
  galponRows: SpreadsheetCell[][],
): FarmState["investments"] {
  const investments: FarmState["investments"] = [];
  let rightSupplier = "OLGA";

  galponRows.forEach((row, index) => {
    const rowNumber = index + 1;
    const leftDescription = String(getCell(row, 1) ?? "").trim();
    const rightHeading = String(getCell(row, 6) ?? getCell(row, 9) ?? "").trim();

    if (normalizeHeader(rightHeading).includes("homecenter")) {
      rightSupplier = "Homecenter";
    } else if (normalizeHeader(rightHeading).includes("laroca")) {
      rightSupplier = "La Roca";
    } else if (normalizeHeader(rightHeading).includes("olga")) {
      rightSupplier = "OLGA";
    }

    const leftItem = buildInvestmentItem({
      category: "galpon_construccion",
      subcategory: rowNumber >= 26 ? "Material usado" : "Construccion del galpon",
      description: leftDescription,
      quantity: parseSpreadsheetDecimal(getCell(row, 0)),
      unitPrice: parseSpreadsheetDecimal(getCell(row, 2)),
      totalPrice: parseSpreadsheetDecimal(getCell(row, 3)),
    });

    if (leftItem) {
      investments.push(leftItem);
    }

    const rightDescription = String(getCell(row, 6) ?? "").trim();
    const normalizedSupplier = normalizeHeader(rightSupplier);
    const category = normalizedSupplier.includes("homecenter")
      ? "galpon_materiales_homecenter"
      : normalizedSupplier.includes("laroca")
        ? "galpon_materiales_laroca"
        : "galpon_materiales_olga";
    const rightItem = buildInvestmentItem({
      category,
      subcategory: rightSupplier,
      description: rightDescription,
      quantity: parseSpreadsheetDecimal(getCell(row, 5)),
      unitPrice: parseSpreadsheetDecimal(getCell(row, 7)),
      totalPrice: parseSpreadsheetDecimal(getCell(row, 8)),
      supplier: rightSupplier,
    });

    if (rightItem) {
      investments.push(rightItem);
    }
  });

  return investments;
}

function inferChickenInvestmentCategory(description: string) {
  const normalized = normalizeHeader(description);

  if (normalized.includes("gallina") || normalized.includes("cuidandero")) {
    return "gallinas_compra" as const;
  }

  if (
    normalized.includes("pollito") ||
    normalized.includes("pollita") ||
    normalized.includes("polla") ||
    normalized.includes("prepico") ||
    normalized.includes("levante")
  ) {
    return "gallinas_alimento" as const;
  }

  return "gallinas_compra" as const;
}

function parseGallinasInvestments(
  gallinasRows: SpreadsheetCell[][],
): FarmState["investments"] {
  const investments: FarmState["investments"] = [];
  let section: "birds" | "medicine" | "implements" = "birds";

  gallinasRows.forEach((row) => {
    const label = String(getCell(row, 1) ?? "").trim();
    const normalizedLabel = normalizeHeader(label);

    if (normalizedLabel.includes("medicamento") || normalizedLabel.includes("vitamina")) {
      section = "medicine";
      return;
    }

    if (normalizedLabel.includes("implementos")) {
      section = "implements";
      return;
    }

    const leftCategory =
      section === "medicine"
        ? "gallinas_medicina_vacunas"
        : section === "implements"
          ? "gallinas_implementos"
          : inferChickenInvestmentCategory(label);
    const leftItem = buildInvestmentItem({
      category: leftCategory,
      subcategory:
        section === "medicine"
          ? "Medicina y vacunas"
          : section === "implements"
            ? "Implementos del galpon"
            : "Gallinas y comidas",
      description: label,
      quantity: parseSpreadsheetDecimal(getCell(row, 0)),
      unitPrice: parseSpreadsheetDecimal(getCell(row, 2)),
      totalPrice: parseSpreadsheetDecimal(getCell(row, 3)),
    });

    if (leftItem) {
      investments.push(leftItem);
    }

    const rightDescription = String(getCell(row, 6) ?? "").trim();
    const rightItem = buildInvestmentItem({
      category: "gallinas_implementos",
      subcategory: "La Roca",
      description: rightDescription,
      quantity: parseSpreadsheetDecimal(getCell(row, 5)),
      unitPrice: parseSpreadsheetDecimal(getCell(row, 7)),
      totalPrice: parseSpreadsheetDecimal(getCell(row, 8)),
      supplier: rightDescription ? "La Roca" : undefined,
    });

    if (rightItem) {
      investments.push(rightItem);
    }
  });

  return investments;
}

function parseGallinasHealthRecords(
  gallinasRows: SpreadsheetCell[][],
): FarmState["healthRecords"] {
  return gallinasRows.flatMap((row) => {
    const description = String(getCell(row, 1) ?? "").trim();
    const normalized = normalizeHeader(description);

    if (!normalized.includes("vacuna")) {
      return [];
    }

    return [
      {
        id: makeId("health-import"),
        date: parseSpanishDateInText(description) || todayIso(),
        type: "vaccination" as const,
        sickBirds: 0,
        deaths: 0,
        notes: description,
      },
    ];
  });
}

function parseAndreaCoops(
  productionRows: SpreadsheetCell[][],
): FarmState["coops"] | undefined {
  const aliveValues = productionRows
    .map((row) => parseSpreadsheetNumber(getCell(row, 4)))
    .filter((value) => value > 0);
  const latestAlive = aliveValues.at(-1);

  if (!latestAlive) {
    return undefined;
  }

  const coop1Hens = Math.ceil(latestAlive / 2);
  const coop2Hens = Math.floor(latestAlive / 2);

  return [
    {
      id: "coop-1",
      name: "Coop 1",
      capacity: 200,
      hens: coop1Hens,
      chicks: 0,
      notes: "Imported from PRODUCCION ALIVE count.",
    },
    {
      id: "coop-2",
      name: "Coop 2",
      capacity: 200,
      hens: coop2Hens,
      chicks: 0,
      notes: "Imported from PRODUCCION ALIVE count.",
    },
  ];
}

function parseAndreaTemplateImport(
  sheets: SpreadsheetSheet[],
): FarmImportResult | null {
  const productionSheet = getSheet(sheets, "PRODUCCION");
  const ventaSheet = getSheet(sheets, "VENTA");
  const gastosSheet = getSheet(sheets, "GASTOS");
  const galponSheet = getSheet(sheets, "GALPON");
  const gallinasSheet = getSheet(sheets, "GALLINAS");

  if (!productionSheet && !ventaSheet && !gastosSheet && !galponSheet && !gallinasSheet) {
    return null;
  }

  const weekStarts = buildWeekStartMap(productionSheet?.data || []);
  const weeklyCosts = parseAndreaExpenseRows(gastosSheet?.data || [], weekStarts);
  const investments = [
    ...parseGalponInvestments(galponSheet?.data || []),
    ...parseGallinasInvestments(gallinasSheet?.data || []),
  ];
  const warnings: string[] = [
    "Andrea's template tracks egg sizes instead of coop splits, so imported good eggs are stored in Coop 1 and size details are kept in notes/sales summaries.",
  ];

  if (!productionSheet) {
    warnings.push("No PRODUCCION sheet was found, so egg logs were not imported.");
  }

  if (!ventaSheet) {
    warnings.push("No VENTA sheet was found, so sales were not imported.");
  }

  if (!gastosSheet) {
    warnings.push("No GASTOS sheet was found, so weekly feed and expense rows were not imported.");
  }

  return {
    source: "andrea-template",
    eggLogs: parseAndreaProductionRows(productionSheet?.data || []),
    sales: parseAndreaSalesRows(ventaSheet?.data || []),
    feedPurchases: weeklyCosts.feedPurchases,
    expenses: weeklyCosts.expenses,
    investments,
    healthRecords: parseGallinasHealthRecords(gallinasSheet?.data || []),
    coops: parseAndreaCoops(productionSheet?.data || []),
    skippedRows: 0,
    warnings,
    detectedColumns: [
      "PRODUCCION: Fecha, T, C, B, A, AA, AAA, Rotos, HUEVOS",
      "VENTA: Fecha, T.HUEVOS, COSTO/HUEVO, C, B, A, AA, AAA, JUMBO, TOTAL",
      "GASTOS: SEMANAS, # BULTOS, P.BULTO, CUIDANDERO, OTRO, TRANSPORTE, TOTAL",
      "GALPON/GALLINAS: CANTIDAD, DESCRIPCION, VALOR, TOTAL",
    ],
    detectedSheets: sheets.map((sheet) => sheet.sheet),
  };
}

function parseFarmImport(sheets: SpreadsheetSheet[]): FarmImportResult {
  const templateImport = parseAndreaTemplateImport(sheets);

  if (templateImport) {
    return templateImport;
  }

  const parsedEggs = parseEggImportRows(sheets[0]?.data || []);

  return {
    source: "egg-log",
    eggLogs: parsedEggs.entries,
    sales: [],
    feedPurchases: [],
    expenses: [],
    investments: [],
    healthRecords: [],
    skippedRows: parsedEggs.skippedRows,
    warnings: parsedEggs.warnings,
    detectedColumns: parsedEggs.detectedColumns,
    detectedSheets: sheets.map((sheet) => sheet.sheet),
  };
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const cell = String(row[header] ?? "");
          return `"${cell.replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FarmAdminPage() {
  const [state, setState] = useState<FarmState>(() => createFreshFarmState());
  const [loaded, setLoaded] = useState(false);
  const [activeSection, setActiveSection] =
    useState<AdminSection>("overview");
  const [databaseStatus, setDatabaseStatus] =
    useState<DatabaseStatus>("checking");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const loadTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      const localState = loadFarmState();
      setState(localState);
      setLoaded(true);

      fetch("/api/farm-state")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Dailey database is not ready yet.");
          }

          return (await response.json()) as { state: FarmState | null };
        })
        .then(({ state: databaseState }) => {
          if (databaseState) {
            setState(databaseState);
            saveFarmState(databaseState);
            setNotice("Loaded the latest farm data from Dailey.");
          } else {
            void saveFarmStateToDailey(localState);
            setNotice("Started a fresh farm record in Dailey.");
          }

          setDatabaseStatus("ready");
        })
        .catch((error) => {
          setDatabaseStatus("local");
          setNotice(
            error instanceof Error
              ? `Local mode active: ${error.message}`
              : "Local mode active. Changes are saved in this browser.",
          );
        });
    }, 0);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const metrics = useMemo(() => calculateFarmMetrics(state), [state]);
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const eggChartData = useMemo(() => getEggChartData(state), [state]);
  const reportRows = useMemo(() => getReportRows(state), [state]);

  function updateState(nextState: FarmState, message: string) {
    setState(nextState);
    saveFarmState(nextState);
    setNotice(message);

    if (!navigator.onLine) {
      setDatabaseStatus("local");
      return;
    }

    setSyncing(true);
    void saveFarmStateToDailey(nextState)
      .then(() => {
        setDatabaseStatus("ready");
        setNotice(`${message} Synced to Dailey.`);
      })
      .catch((error) => {
        setDatabaseStatus("local");
        setNotice(
          error instanceof Error
            ? `${message} Dailey sync paused: ${error.message}`
            : `${message} Dailey sync paused.`,
        );
      })
      .finally(() => setSyncing(false));
  }

  function syncNow() {
    setSyncing(true);
    void saveFarmStateToDailey(state)
      .then(() => {
        setDatabaseStatus("ready");
        setNotice("Farm data synced to Dailey.");
      })
      .catch((error) => {
        setDatabaseStatus("local");
        setNotice(
          error instanceof Error
            ? `Dailey sync failed: ${error.message}`
            : "Dailey sync failed.",
        );
      })
      .finally(() => setSyncing(false));
  }

  if (!loaded) {
    return (
      <main className="admin-shell grid min-h-screen place-items-center">
        <div className="admin-loading">
          <Egg size={34} />
          <p>Loading farm admin...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <Egg size={24} />
          </div>
          <div>
            <p>Brianna Eggs</p>
            <strong>Admin</strong>
          </div>
        </div>

        <nav className="admin-nav">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const selected = activeSection === item.id;

            return (
              <button
                key={item.id}
                className={selected ? "is-active" : ""}
                onClick={() => setActiveSection(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Web admin workspace</p>
            <h1>Brianna Eggs Farm Manager</h1>
            <p>
              Manage production, coops, sales, feed, inventory, health, and
              reports from one full-width page.
            </p>
          </div>

          <div className="admin-header-actions">
            <StatusPill
              icon={online ? Cloud : CloudOff}
              label={online ? "Online" : "Offline"}
              tone={online ? "success" : "warning"}
            />
            <StatusPill
              icon={databaseStatus === "ready" ? CheckCircle2 : AlertTriangle}
              label={
                databaseStatus === "checking"
                  ? "Checking DB"
                  : databaseStatus === "ready"
                    ? "Dailey DB"
                    : "Local save"
              }
              tone={databaseStatus === "ready" ? "success" : "warning"}
            />
            <button className="admin-icon-button" onClick={syncNow} title="Sync now">
              <RefreshCw className={syncing ? "animate-spin" : ""} size={18} />
            </button>
          </div>
        </header>

        {notice ? <div className="admin-notice">{notice}</div> : null}

        <div className="admin-content">
          {activeSection === "overview" ? (
            <OverviewSection
              state={state}
              metrics={metrics}
              alerts={alerts}
              insights={insights}
              chartData={eggChartData}
              setActiveSection={setActiveSection}
            />
          ) : null}

          {activeSection === "eggs" ? (
            <EggsSection state={state} updateState={updateState} />
          ) : null}

          {activeSection === "sales" ? (
            <SalesSection
              state={state}
              metrics={metrics}
              updateState={updateState}
            />
          ) : null}

          {activeSection === "expenses" ? (
            <ExpensesSection
              state={state}
              metrics={metrics}
              updateState={updateState}
            />
          ) : null}

          {activeSection === "flock" ? (
            <CoopsSection state={state} updateState={updateState} />
          ) : null}

          {activeSection === "inventory" ? (
            <InventorySection state={state} updateState={updateState} />
          ) : null}

          {activeSection === "health" ? (
            <HealthSection state={state} updateState={updateState} />
          ) : null}

          {activeSection === "investment" ? (
            <InvestmentSection state={state} />
          ) : null}

          {activeSection === "reports" ? (
            <ReportsSection
              metrics={metrics}
              rows={reportRows}
              updateState={updateState}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function OverviewSection({
  state,
  metrics,
  alerts,
  insights,
  chartData,
  setActiveSection,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  alerts: ReturnType<typeof buildAlerts>;
  insights: ReturnType<typeof buildInsights>;
  chartData: ReturnType<typeof getEggChartData>;
  setActiveSection: (section: AdminSection) => void;
}) {
  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Today</p>
            <h2>Production command center</h2>
          </div>
          <button
            className="admin-primary-button"
            onClick={() => setActiveSection("eggs")}
          >
            <Plus size={17} />
            Log Eggs
          </button>
        </div>

        <div className="admin-metrics">
          <MetricTile
            label="Eggs Today"
            value={metrics.eggsToday || "0"}
            detail="good eggs logged"
            icon={Egg}
            tone="gold"
          />
          <MetricTile
            label="Cartons Ready"
            value={metrics.cartonsAvailable}
            detail={`${metrics.looseEggs} loose eggs`}
            icon={Package}
            tone="green"
          />
          <MetricTile
            label="Monthly Profit"
            value={formatCop(metrics.monthlyProfit)}
            detail="sales minus expenses"
            icon={Wallet}
            tone="blue"
          />
          <MetricTile
            label="Feed Stock"
            value={`${formatNumber(metrics.feedStockKg)} kg`}
            detail={`${metrics.feedDaysRemaining} days remaining`}
            icon={Sprout}
            tone="red"
          />
        </div>

        <div className="admin-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#66736b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#66736b" }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="Coop 1"
                stroke="#4f7f64"
                fill="#4f7f64"
                fillOpacity={0.22}
              />
              <Area
                type="monotone"
                dataKey="Coop 2"
                stroke="#c78643"
                fill="#d8aa56"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Attention</p>
            <h2>Alerts</h2>
          </div>
          <AlertTriangle size={20} />
        </div>
        <div className="admin-stack">
          {alerts.length ? (
            alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`admin-alert ${alert.tone}`}>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
            ))
          ) : (
            <div className="admin-empty">No urgent alerts right now.</div>
          )}
        </div>
      </section>

      <section className="admin-panel admin-span-5">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Coops</p>
            <h2>Flock capacity</h2>
          </div>
          <Bird size={20} />
        </div>
        <div className="admin-stack">
          {state.coops.map((coop) => {
            const total = coop.hens + coop.chicks;
            const fill = coop.capacity ? Math.min((total / coop.capacity) * 100, 100) : 0;

            return (
              <div key={coop.id} className="admin-progress-row">
                <div>
                  <strong>{coop.name}</strong>
                  <span>
                    {total} birds / {coop.capacity} capacity
                  </span>
                </div>
                <div className="admin-progress">
                  <span style={{ width: `${fill}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-panel admin-span-7">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Signals</p>
            <h2>Farm insights</h2>
          </div>
          <Activity size={20} />
        </div>
        <div className="admin-insights">
          {insights.slice(0, 4).map((insight) => (
            <div key={insight.id}>
              <span>{insight.title}</span>
              <strong>{insight.value}</strong>
              <p>{insight.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EggsSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({
    date: todayIso(),
    coop1Eggs: 0,
    coop2Eggs: 0,
    crackedEggs: 0,
    notes: "",
  });
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<EggImportSummary | null>(
    null,
  );

  const totalEggs = form.coop1Eggs + form.coop2Eggs;
  const goodEggs = Math.max(totalEggs - form.crackedEggs, 0);
  const cartons = Math.floor(goodEggs / 30);
  const looseEggs = goodEggs % 30;

  function submit(event: FormEvent) {
    event.preventDefault();
    const entry = {
      id: makeId("egg"),
      ...form,
      synced: true,
      createdAt: nowIso(),
    };

    updateState(
      {
        ...state,
        eggLogs: [
          ...state.eggLogs.filter((log) => log.date !== form.date),
          entry,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      },
      "Egg log saved.",
    );

    setForm({
      date: todayIso(),
      coop1Eggs: 0,
      coop2Eggs: 0,
      crackedEggs: 0,
      notes: "",
    });
  }

  function removeLog(id: string) {
    updateState(
      {
        ...state,
        eggLogs: state.eggLogs.filter((log) => log.id !== id),
      },
      "Egg log deleted.",
    );
  }

  async function uploadEggSpreadsheet(file: File | null) {
    if (!file) {
      return;
    }

    setImporting(true);

    try {
      const sheets = await readSpreadsheetWorkbook(file);
      const parsed = parseFarmImport(sheets);
      const importWarnings = [...parsed.warnings];
      const uniqueEntries = Array.from(
        new Map(parsed.eggLogs.map((entry) => [entry.date, entry])).values(),
      );
      const duplicateRows = parsed.eggLogs.length - uniqueEntries.length;

      if (duplicateRows > 0) {
        importWarnings.push(
          `${duplicateRows} duplicate date row${duplicateRows === 1 ? "" : "s"} in the file were collapsed; the last row for each date was used.`,
        );
      }

      const hasImportedData =
        uniqueEntries.length ||
        parsed.sales.length ||
        parsed.feedPurchases.length ||
        parsed.expenses.length ||
        parsed.investments.length ||
        parsed.healthRecords.length ||
        parsed.coops?.length;

      if (!hasImportedData) {
        setImportSummary({
          fileName: file.name,
          importedEggLogs: 0,
          importedSales: 0,
          importedFeedPurchases: 0,
          importedExpenses: 0,
          importedInvestments: 0,
          importedHealthRecords: 0,
          replacedEggLogs: 0,
          replacedSales: 0,
          replacedFeedPurchases: 0,
          replacedExpenses: 0,
          replacedInvestments: 0,
          replacedHealthRecords: 0,
          skipped: parsed.skippedRows,
          warnings: importWarnings.length
            ? importWarnings
            : ["No valid farm rows were found."],
          detectedColumns: parsed.detectedColumns,
          detectedSheets: parsed.detectedSheets,
          preview: [],
        });
        return;
      }

      const incomingDates = new Set(uniqueEntries.map((entry) => entry.date));
      const replacedEggLogs = state.eggLogs.filter((log) =>
        incomingDates.has(log.date),
      ).length;
      const incomingSaleDates = new Set(parsed.sales.map((sale) => sale.date));
      const incomingFeedDates = new Set(
        parsed.feedPurchases.map((purchase) => purchase.date),
      );
      const incomingExpenseDates = new Set(
        parsed.expenses.map((expense) => expense.date),
      );
      const incomingHealthKeys = new Set(
        parsed.healthRecords.map((record) => `${record.date}-${record.notes}`),
      );
      const replacedSales = state.sales.filter((sale) =>
        incomingSaleDates.has(sale.date),
      ).length;
      const replacedFeedPurchases = state.feedPurchases.filter((purchase) =>
        incomingFeedDates.has(purchase.date),
      ).length;
      const replacedExpenses = state.expenses.filter((expense) =>
        incomingExpenseDates.has(expense.date),
      ).length;
      const replacedHealthRecords = state.healthRecords.filter((record) =>
        incomingHealthKeys.has(`${record.date}-${record.notes}`),
      ).length;
      const replacedInvestments =
        parsed.source === "andrea-template" && parsed.investments.length
          ? state.investments.length
          : 0;
      const nextEggLogs = [
        ...state.eggLogs.filter((log) => !incomingDates.has(log.date)),
        ...uniqueEntries,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const nextSales = [
        ...state.sales.filter((sale) => !incomingSaleDates.has(sale.date)),
        ...parsed.sales,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const nextFeedPurchases = [
        ...state.feedPurchases.filter(
          (purchase) => !incomingFeedDates.has(purchase.date),
        ),
        ...parsed.feedPurchases,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const nextExpenses = [
        ...state.expenses.filter(
          (expense) => !incomingExpenseDates.has(expense.date),
        ),
        ...parsed.expenses,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const nextHealthRecords = [
        ...state.healthRecords.filter(
          (record) => !incomingHealthKeys.has(`${record.date}-${record.notes}`),
        ),
        ...parsed.healthRecords,
      ].sort((a, b) => a.date.localeCompare(b.date));

      updateState(
        {
          ...state,
          eggLogs: nextEggLogs,
          sales: nextSales,
          feedPurchases: nextFeedPurchases,
          expenses: nextExpenses,
          healthRecords: nextHealthRecords,
          investments:
            parsed.source === "andrea-template" && parsed.investments.length
              ? parsed.investments
              : state.investments,
          coops: parsed.coops || state.coops,
        },
        `Imported Andrea farm data from ${file.name}.`,
      );

      setImportSummary({
        fileName: file.name,
        importedEggLogs: uniqueEntries.length,
        importedSales: parsed.sales.length,
        importedFeedPurchases: parsed.feedPurchases.length,
        importedExpenses: parsed.expenses.length,
        importedInvestments: parsed.investments.length,
        importedHealthRecords: parsed.healthRecords.length,
        replacedEggLogs,
        replacedSales,
        replacedFeedPurchases,
        replacedExpenses,
        replacedInvestments,
        replacedHealthRecords,
        skipped: parsed.skippedRows,
        warnings: importWarnings,
        detectedColumns: parsed.detectedColumns,
        detectedSheets: parsed.detectedSheets,
        preview: uniqueEntries.slice(0, 5),
      });
    } catch (error) {
      setImportSummary({
        fileName: file.name,
        importedEggLogs: 0,
        importedSales: 0,
        importedFeedPurchases: 0,
        importedExpenses: 0,
        importedInvestments: 0,
        importedHealthRecords: 0,
        replacedEggLogs: 0,
        replacedSales: 0,
        replacedFeedPurchases: 0,
        replacedExpenses: 0,
        replacedInvestments: 0,
        replacedHealthRecords: 0,
        skipped: 0,
        warnings: [
          error instanceof Error
            ? error.message
            : "The spreadsheet could not be imported.",
        ],
        detectedColumns: [],
        detectedSheets: [],
        preview: [],
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Production</p>
            <h2>Daily egg log</h2>
          </div>
          <Egg size={20} />
        </div>
        <form className="admin-form" onSubmit={submit}>
          <AdminField label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </AdminField>
          <AdminField label="Coop 1 eggs">
            <input
              inputMode="numeric"
              value={form.coop1Eggs || ""}
              onChange={(event) =>
                setForm({ ...form, coop1Eggs: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Coop 2 eggs">
            <input
              inputMode="numeric"
              value={form.coop2Eggs || ""}
              onChange={(event) =>
                setForm({ ...form, coop2Eggs: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Cracked eggs">
            <input
              inputMode="numeric"
              value={form.crackedEggs || ""}
              onChange={(event) =>
                setForm({ ...form, crackedEggs: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
            />
          </AdminField>
          <div className="admin-summary-strip">
            <span>Total {totalEggs}</span>
            <span>Good {goodEggs}</span>
            <span>{cartons} cartons</span>
            <span>{looseEggs} loose</span>
          </div>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Egg Log
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Bulk import</p>
            <h2>Upload Andrea&apos;s egg spreadsheet</h2>
          </div>
          <Upload size={20} />
        </div>

        <div className="admin-import-layout">
          <label className="admin-upload-box">
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              onChange={(event) => {
                void uploadEggSpreadsheet(event.currentTarget.files?.[0] || null);
                event.currentTarget.value = "";
              }}
            />
            <Upload size={22} />
            <strong>
              {importing ? "Reading spreadsheet..." : "Choose spreadsheet"}
            </strong>
            <span>.xlsx, .csv, or .tsv files</span>
          </label>

          <div className="admin-import-help">
            <strong>Columns this importer understands</strong>
            <p>
              Andrea&apos;s workbook tabs: PRODUCCION, VENTA, GASTOS, GALPON,
              and GALLINAS. Simple CSV files can still use Date or Fecha, Coop
              1, Coop 2, Cracked, Total Eggs, and Notes.
            </p>
          </div>
        </div>

        {importSummary ? (
          <div className="admin-import-summary">
            <div className="admin-summary-strip">
              <span>{importSummary.importedEggLogs} egg logs</span>
              <span>{importSummary.importedSales} sales</span>
              <span>{importSummary.importedFeedPurchases} feed buys</span>
              <span>{importSummary.importedExpenses} expenses</span>
              <span>{importSummary.importedInvestments} investments</span>
              <span>{importSummary.importedHealthRecords} health notes</span>
              <span>{importSummary.skipped} skipped</span>
            </div>
            <p>
              <strong>{importSummary.fileName}</strong>
              {importSummary.detectedSheets.length
                ? ` sheets: ${importSummary.detectedSheets.join(", ")}`
                : ""}
              {importSummary.detectedColumns.length
                ? ` fields: ${importSummary.detectedColumns.join(" | ")}`
                : ""}
            </p>
            {importSummary.replacedEggLogs ||
            importSummary.replacedSales ||
            importSummary.replacedFeedPurchases ||
            importSummary.replacedExpenses ||
            importSummary.replacedInvestments ||
            importSummary.replacedHealthRecords ? (
              <p>
                Updated existing records: {importSummary.replacedEggLogs} egg
                logs, {importSummary.replacedSales} sales,{" "}
                {importSummary.replacedFeedPurchases} feed buys,{" "}
                {importSummary.replacedExpenses} expenses,{" "}
                {importSummary.replacedInvestments} investments,{" "}
                {importSummary.replacedHealthRecords} health notes.
              </p>
            ) : null}
            {importSummary.warnings.length ? (
              <div className="admin-warning-list">
                {importSummary.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            ) : null}
            {importSummary.preview.length ? (
              <AdminTable
                headers={["Preview Date", "Coop 1", "Coop 2", "Cracked", "Notes"]}
                rows={importSummary.preview.map((entry) => [
                  entry.date,
                  entry.coop1Eggs,
                  entry.coop2Eggs,
                  entry.crackedEggs,
                  entry.notes || "-",
                ])}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">History</p>
            <h2>Recent egg logs</h2>
          </div>
          <button
            className="admin-secondary-button"
            onClick={() =>
              downloadCsv(
                "egg-logs.csv",
                state.eggLogs.map((log) => ({
                  date: log.date,
                  coop1Eggs: log.coop1Eggs,
                  coop2Eggs: log.coop2Eggs,
                  crackedEggs: log.crackedEggs,
                  notes: log.notes || "",
                })),
              )
            }
          >
            <Download size={16} />
            CSV
          </button>
        </div>
        <AdminTable
          headers={["Date", "Coop 1", "Coop 2", "Cracked", "Good", "Notes", ""]}
          rows={state.eggLogs
            .slice()
            .reverse()
            .map((log) => [
              log.date,
              log.coop1Eggs,
              log.coop2Eggs,
              log.crackedEggs,
              log.coop1Eggs + log.coop2Eggs - log.crackedEggs,
              log.notes || "-",
              <button
                key={log.id}
                className="admin-table-action"
                onClick={() => removeLog(log.id)}
                title="Delete log"
              >
                <Trash2 size={15} />
              </button>,
            ])}
        />
      </section>
    </div>
  );
}

function SalesSection({
  state,
  metrics,
  updateState,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({
    date: todayIso(),
    cartons: 0,
    pricePerCartonCop: 19000,
    customerName: "",
  });

  const total = form.cartons * form.pricePerCartonCop;

  function submit(event: FormEvent) {
    event.preventDefault();
    const sale = { id: makeId("sale"), ...form };
    updateState(
      {
        ...state,
        sales: [...state.sales, sale],
      },
      "Sale saved.",
    );
    setForm({
      date: todayIso(),
      cartons: 0,
      pricePerCartonCop: 19000,
      customerName: "",
    });
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Revenue</p>
            <h2>Record a sale</h2>
          </div>
          <ShoppingCart size={20} />
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-summary-strip">
            <span>{metrics.cartonsAvailable} cartons ready</span>
            <span>{formatCop(total)}</span>
          </div>
          <AdminField label="Sale date">
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </AdminField>
          <AdminField label="Cartons sold">
            <input
              inputMode="numeric"
              value={form.cartons || ""}
              onChange={(event) =>
                setForm({ ...form, cartons: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Price per carton COP">
            <input
              inputMode="numeric"
              value={form.pricePerCartonCop || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  pricePerCartonCop: parseNumber(event.target.value),
                })
              }
            />
          </AdminField>
          <AdminField label="Customer">
            <input
              value={form.customerName}
              onChange={(event) =>
                setForm({ ...form, customerName: event.target.value })
              }
            />
          </AdminField>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Sale
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Ledger</p>
            <h2>Sales records</h2>
          </div>
          <Wallet size={20} />
        </div>
        <AdminTable
          headers={["Date", "Customer", "Cartons", "Price", "Total"]}
          rows={state.sales
            .slice()
            .reverse()
            .map((sale) => [
              sale.date,
              sale.customerName || "-",
              sale.cartons,
              formatCop(sale.pricePerCartonCop),
              formatCop(sale.cartons * sale.pricePerCartonCop),
            ])}
        />
      </section>
    </div>
  );
}

function ExpensesSection({
  state,
  metrics,
  updateState,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [feedPurchase, setFeedPurchase] = useState({
    date: todayIso(),
    feedType: "Layer pellet",
    quantityKg: 0,
    priceCop: 0,
    supplier: "",
  });
  const [feedUsage, setFeedUsage] = useState({
    date: todayIso(),
    quantityKg: 0,
    notes: "",
  });
  const [expense, setExpense] = useState({
    date: todayIso(),
    category: "maintenance" as Expense["category"],
    amountCop: 0,
    description: "",
  });

  function submitFeedPurchase(event: FormEvent) {
    event.preventDefault();
    const purchase = { id: makeId("feed-purchase"), ...feedPurchase };
    updateState(
      {
        ...state,
        feedPurchases: [...state.feedPurchases, purchase],
        inventoryItems: state.inventoryItems.map((item) =>
          item.id === "inv-feed"
            ? { ...item, quantity: item.quantity + feedPurchase.quantityKg }
            : item,
        ),
      },
      "Feed purchase saved.",
    );
    setFeedPurchase({
      date: todayIso(),
      feedType: "Layer pellet",
      quantityKg: 0,
      priceCop: 0,
      supplier: "",
    });
  }

  function submitFeedUsage(event: FormEvent) {
    event.preventDefault();
    const usage = { id: makeId("feed-use"), ...feedUsage };
    updateState(
      {
        ...state,
        feedUsage: [...state.feedUsage, usage],
        inventoryItems: state.inventoryItems.map((item) =>
          item.id === "inv-feed"
            ? { ...item, quantity: Math.max(item.quantity - feedUsage.quantityKg, 0) }
            : item,
        ),
      },
      "Feed usage saved.",
    );
    setFeedUsage({ date: todayIso(), quantityKg: 0, notes: "" });
  }

  function submitExpense(event: FormEvent) {
    event.preventDefault();
    const nextExpense = { id: makeId("expense"), ...expense };
    updateState(
      {
        ...state,
        expenses: [...state.expenses, nextExpense],
      },
      "Expense saved.",
    );
    setExpense({
      date: todayIso(),
      category: "maintenance",
      amountCop: 0,
      description: "",
    });
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Feed stock</p>
            <h2>Purchase feed</h2>
          </div>
          <Sprout size={20} />
        </div>
        <form className="admin-form" onSubmit={submitFeedPurchase}>
          <AdminField label="Date">
            <input
              type="date"
              value={feedPurchase.date}
              onChange={(event) =>
                setFeedPurchase({ ...feedPurchase, date: event.target.value })
              }
            />
          </AdminField>
          <AdminField label="Feed type">
            <input
              value={feedPurchase.feedType}
              onChange={(event) =>
                setFeedPurchase({ ...feedPurchase, feedType: event.target.value })
              }
            />
          </AdminField>
          <AdminField label="Quantity kg">
            <input
              inputMode="numeric"
              value={feedPurchase.quantityKg || ""}
              onChange={(event) =>
                setFeedPurchase({
                  ...feedPurchase,
                  quantityKg: parseNumber(event.target.value),
                })
              }
            />
          </AdminField>
          <AdminField label="Total price COP">
            <input
              inputMode="numeric"
              value={feedPurchase.priceCop || ""}
              onChange={(event) =>
                setFeedPurchase({
                  ...feedPurchase,
                  priceCop: parseNumber(event.target.value),
                })
              }
            />
          </AdminField>
          <AdminField label="Supplier">
            <input
              value={feedPurchase.supplier}
              onChange={(event) =>
                setFeedPurchase({ ...feedPurchase, supplier: event.target.value })
              }
            />
          </AdminField>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Purchase
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Feed use</p>
            <h2>Record daily usage</h2>
          </div>
          <Package size={20} />
        </div>
        <form className="admin-form" onSubmit={submitFeedUsage}>
          <div className="admin-summary-strip">
            <span>{formatNumber(metrics.feedStockKg)} kg in stock</span>
            <span>{metrics.feedDaysRemaining} days left</span>
          </div>
          <AdminField label="Date">
            <input
              type="date"
              value={feedUsage.date}
              onChange={(event) =>
                setFeedUsage({ ...feedUsage, date: event.target.value })
              }
            />
          </AdminField>
          <AdminField label="Quantity used kg">
            <input
              inputMode="numeric"
              value={feedUsage.quantityKg || ""}
              onChange={(event) =>
                setFeedUsage({
                  ...feedUsage,
                  quantityKg: parseNumber(event.target.value),
                })
              }
            />
          </AdminField>
          <AdminField label="Notes">
            <input
              value={feedUsage.notes}
              onChange={(event) =>
                setFeedUsage({ ...feedUsage, notes: event.target.value })
              }
            />
          </AdminField>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Usage
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Costs</p>
            <h2>Other expense</h2>
          </div>
          <ReceiptText size={20} />
        </div>
        <form className="admin-form" onSubmit={submitExpense}>
          <AdminField label="Date">
            <input
              type="date"
              value={expense.date}
              onChange={(event) => setExpense({ ...expense, date: event.target.value })}
            />
          </AdminField>
          <AdminField label="Category">
            <select
              value={expense.category}
              onChange={(event) =>
                setExpense({
                  ...expense,
                  category: event.target.value as Expense["category"],
                })
              }
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Amount COP">
            <input
              inputMode="numeric"
              value={expense.amountCop || ""}
              onChange={(event) =>
                setExpense({ ...expense, amountCop: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Description">
            <input
              value={expense.description}
              onChange={(event) =>
                setExpense({ ...expense, description: event.target.value })
              }
            />
          </AdminField>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Expense
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Expense history</p>
            <h2>Feed purchases and other costs</h2>
          </div>
          <ReceiptText size={20} />
        </div>
        <AdminTable
          headers={["Date", "Type", "Description", "Amount"]}
          rows={[
            ...state.feedPurchases.map((item) => [
              item.date,
              "Feed",
              `${item.quantityKg} kg ${item.feedType} ${item.supplier ? `from ${item.supplier}` : ""}`,
              formatCop(item.priceCop),
            ]),
            ...state.expenses.map((item) => [
              item.date,
              item.category,
              item.description,
              formatCop(item.amountCop),
            ]),
          ].sort((a, b) => String(b[0]).localeCompare(String(a[0])))}
        />
      </section>
    </div>
  );
}

function CoopsSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  function updateCoop(coopId: string, patch: Partial<Coop>) {
    updateState(
      {
        ...state,
        coops: state.coops.map((coop) =>
          coop.id === coopId ? { ...coop, ...patch } : coop,
        ),
      },
      "Coop updated.",
    );
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Flock setup</p>
            <h2>Coop management</h2>
          </div>
          <Bird size={20} />
        </div>
        <div className="admin-coop-grid">
          {state.coops.map((coop) => (
            <div key={coop.id} className="admin-edit-row">
              <AdminField label="Name">
                <input
                  value={coop.name}
                  onChange={(event) =>
                    updateCoop(coop.id, { name: event.target.value })
                  }
                />
              </AdminField>
              <AdminField label="Capacity">
                <input
                  inputMode="numeric"
                  value={coop.capacity || ""}
                  onChange={(event) =>
                    updateCoop(coop.id, { capacity: parseNumber(event.target.value) })
                  }
                />
              </AdminField>
              <AdminField label="Hens">
                <input
                  inputMode="numeric"
                  value={coop.hens || ""}
                  onChange={(event) =>
                    updateCoop(coop.id, { hens: parseNumber(event.target.value) })
                  }
                />
              </AdminField>
              <AdminField label="Chicks">
                <input
                  inputMode="numeric"
                  value={coop.chicks || ""}
                  onChange={(event) =>
                    updateCoop(coop.id, { chicks: parseNumber(event.target.value) })
                  }
                />
              </AdminField>
              <AdminField label="Notes">
                <input
                  value={coop.notes || ""}
                  onChange={(event) =>
                    updateCoop(coop.id, { notes: event.target.value })
                  }
                />
              </AdminField>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Movement log</p>
            <h2>Recent bird movements</h2>
          </div>
          <ClipboardList size={20} />
        </div>
        <AdminTable
          headers={["Date", "Coop", "Type", "Quantity", "Notes"]}
          rows={state.birdMovements
            .slice()
            .reverse()
            .map((movement) => [
              movement.date,
              state.coops.find((coop) => coop.id === movement.coopId)?.name ||
                movement.coopId,
              movement.type,
              movement.quantity,
              movement.notes || "-",
            ])}
        />
      </section>
    </div>
  );
}

function InventorySection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    category: "feed" as InventoryItem["category"],
    quantity: 0,
    unit: "",
    reorderLevel: 0,
  });

  function updateItem(itemId: string, patch: Partial<InventoryItem>) {
    updateState(
      {
        ...state,
        inventoryItems: state.inventoryItems.map((item) =>
          item.id === itemId ? { ...item, ...patch } : item,
        ),
      },
      "Inventory updated.",
    );
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    updateState(
      {
        ...state,
        inventoryItems: [
          ...state.inventoryItems,
          { id: makeId("inv"), ...form },
        ],
      },
      "Inventory item added.",
    );
    setForm({
      name: "",
      category: "feed",
      quantity: 0,
      unit: "",
      reorderLevel: 0,
    });
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Stockroom</p>
            <h2>Add item</h2>
          </div>
          <Boxes size={20} />
        </div>
        <form className="admin-form" onSubmit={addItem}>
          <AdminField label="Name">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </AdminField>
          <AdminField label="Category">
            <select
              value={form.category}
              onChange={(event) =>
                setForm({
                  ...form,
                  category: event.target.value as InventoryItem["category"],
                })
              }
            >
              {inventoryCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Quantity">
            <input
              inputMode="numeric"
              value={form.quantity || ""}
              onChange={(event) =>
                setForm({ ...form, quantity: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Unit">
            <input
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder="kg, bottles, cartons"
            />
          </AdminField>
          <AdminField label="Reorder level">
            <input
              inputMode="numeric"
              value={form.reorderLevel || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  reorderLevel: parseNumber(event.target.value),
                })
              }
            />
          </AdminField>
          <button className="admin-primary-button">
            <Plus size={17} />
            Add Item
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Live stock</p>
            <h2>Inventory controls</h2>
          </div>
          <Settings size={20} />
        </div>
        <div className="admin-inventory-list">
          {state.inventoryItems.map((item) => (
            <div key={item.id} className="admin-edit-row">
              <AdminField label="Item">
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateItem(item.id, { name: event.target.value })
                  }
                />
              </AdminField>
              <AdminField label="Quantity">
                <input
                  inputMode="numeric"
                  value={item.quantity || ""}
                  onChange={(event) =>
                    updateItem(item.id, {
                      quantity: parseNumber(event.target.value),
                    })
                  }
                />
              </AdminField>
              <AdminField label="Unit">
                <input
                  value={item.unit}
                  onChange={(event) =>
                    updateItem(item.id, { unit: event.target.value })
                  }
                />
              </AdminField>
              <AdminField label="Reorder at">
                <input
                  inputMode="numeric"
                  value={item.reorderLevel || ""}
                  onChange={(event) =>
                    updateItem(item.id, {
                      reorderLevel: parseNumber(event.target.value),
                    })
                  }
                />
              </AdminField>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({
    date: todayIso(),
    coopId: "",
    type: "medicine" as HealthRecord["type"],
    sickBirds: 0,
    deaths: 0,
    notes: "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const record = {
      id: makeId("health"),
      ...form,
      coopId: form.coopId || undefined,
    };
    updateState(
      {
        ...state,
        healthRecords: [...state.healthRecords, record],
      },
      "Health record saved.",
    );
    setForm({
      date: todayIso(),
      coopId: "",
      type: "medicine",
      sickBirds: 0,
      deaths: 0,
      notes: "",
    });
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Animal care</p>
            <h2>Add health note</h2>
          </div>
          <HeartPulse size={20} />
        </div>
        <form className="admin-form" onSubmit={submit}>
          <AdminField label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </AdminField>
          <AdminField label="Coop">
            <select
              value={form.coopId}
              onChange={(event) => setForm({ ...form, coopId: event.target.value })}
            >
              <option value="">All coops</option>
              {state.coops.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Type">
            <select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value as HealthRecord["type"] })
              }
            >
              <option value="sick">Sick birds</option>
              <option value="death">Death</option>
              <option value="vaccination">Vaccination</option>
              <option value="medicine">Medicine</option>
            </select>
          </AdminField>
          <AdminField label="Sick birds">
            <input
              inputMode="numeric"
              value={form.sickBirds || ""}
              onChange={(event) =>
                setForm({ ...form, sickBirds: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Deaths">
            <input
              inputMode="numeric"
              value={form.deaths || ""}
              onChange={(event) =>
                setForm({ ...form, deaths: parseNumber(event.target.value) })
              }
            />
          </AdminField>
          <AdminField label="Notes">
            <textarea
              value={form.notes}
              rows={4}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              required
            />
          </AdminField>
          <button className="admin-primary-button">
            <Save size={17} />
            Save Health Record
          </button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Care history</p>
            <h2>Health records</h2>
          </div>
          <HeartPulse size={20} />
        </div>
        <AdminTable
          headers={["Date", "Coop", "Type", "Sick", "Deaths", "Notes"]}
          rows={state.healthRecords
            .slice()
            .reverse()
            .map((record) => [
              record.date,
              state.coops.find((coop) => coop.id === record.coopId)?.name ||
                "All coops",
              record.type,
              record.sickBirds || 0,
              record.deaths || 0,
              record.notes,
            ])}
        />
      </section>
    </div>
  );
}

function ReportsSection({
  metrics,
  rows,
  updateState,
}: {
  metrics: ReturnType<typeof calculateFarmMetrics>;
  rows: ReturnType<typeof getReportRows>;
  updateState: (state: FarmState, message: string) => void;
}) {
  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Reports</p>
            <h2>Production and finance summary</h2>
          </div>
          <div className="admin-button-row">
            <button
              className="admin-secondary-button"
              onClick={() => downloadCsv("farm-report.csv", rows)}
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              className="admin-secondary-button"
              onClick={() =>
                updateState(createDemoFarmState(), "Demo data loaded.")
              }
            >
              <Plus size={16} />
              Demo Data
            </button>
            <button
              className="admin-danger-button"
              onClick={() =>
                updateState(createFreshFarmState(), "Farm workspace reset.")
              }
            >
              <Trash2 size={16} />
              Reset
            </button>
          </div>
        </div>

        <div className="admin-report-grid">
          <MetricTile
            label="Monthly Sales"
            value={formatCop(metrics.monthlySales)}
            detail="current month"
            icon={Wallet}
            tone="green"
          />
          <MetricTile
            label="Monthly Expenses"
            value={formatCop(metrics.monthlyExpenses)}
            detail="feed plus farm costs"
            icon={ReceiptText}
            tone="red"
          />
          <MetricTile
            label="Feed Cost / Egg"
            value={formatCop(metrics.feedCostPerEgg)}
            detail="current month"
            icon={Sprout}
            tone="gold"
          />
          <MetricTile
            label="Eggs Available"
            value={metrics.eggsAvailable}
            detail={`${metrics.cartonsAvailable} cartons`}
            icon={Egg}
            tone="blue"
          />
        </div>

        <div className="admin-chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#66736b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#66736b" }} />
              <Tooltip />
              <Bar dataKey="goodEggs" fill="#4f7f64" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cartonsSold" fill="#c78643" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Last 14 logs</p>
            <h2>Report table</h2>
          </div>
          <ClipboardList size={20} />
        </div>
        <AdminTable
          headers={[
            "Date",
            "Coop 1",
            "Coop 2",
            "Cracked",
            "Good Eggs",
            "Cartons Sold",
            "Sales",
            "Expenses",
          ]}
          rows={rows
            .slice()
            .reverse()
            .map((row) => [
              row.date,
              row.coop1Eggs,
              row.coop2Eggs,
              row.crackedEggs,
              row.goodEggs,
              row.cartonsSold,
              formatCop(row.salesCop),
              formatCop(row.expensesCop),
            ])}
        />
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "green" | "gold" | "blue" | "red";
}) {
  return (
    <div className={`admin-metric ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      <Icon size={22} />
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  tone: "success" | "warning";
}) {
  return (
    <div className={`admin-status ${tone}`}>
      <Icon size={16} />
      {label}
    </div>
  );
}

function AdminField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <div className="admin-empty">No records yet.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
