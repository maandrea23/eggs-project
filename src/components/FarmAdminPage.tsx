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
  LineChart as LineChartIcon,
  Package,
  PieChart as PieChartIcon,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingCart,
  Moon,
  Sprout,
  Sun,
  Trash2,
  Wallet,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
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
  getEggStockByCategoryData,
  getFeedChartData,
  getReportRows,
  getSalesChartData,
  getWeekId,
  getCostPerEggByWeek,
  getDayName,
  getWeeklyData,
  getAllWeeks,
} from "@/lib/calculations";
import {
  EGG_SIZE_ORDER,
  formatEggSizeBreakdown,
  getEggSizeTotal,
  normalizeEggSizeBreakdown,
} from "@/lib/egg-classification";
import { createFreshFarmState } from "@/lib/farm-state-defaults";
import { loadFarmState, saveFarmState } from "@/lib/local-store";
import InvestmentSection from "@/components/InvestmentSection";
import type {
  Expense,
  FarmState,
  HealthRecord,
  InventoryItem,
  EggSizeCategory,
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
type ReportGraphType = "production" | "finance" | "feed";
type ReportGraphStyle = "bar" | "line" | "area" | "pie";
type ThemeMode = "daylight" | "nighttime";

const THEME_KEY = "brianna-egg-theme-mode";

type AdminNavItem = {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
  { id: "flock", label: "Flock", icon: Bird },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "investment", label: "Investment", icon: PiggyBank },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const expenseCategories: Expense["category"][] = [
  "maintenance", "medicine", "vaccines", "bedding", "transport",
  "labour", "electricity", "water", "repairs", "packaging", "cleaning",
];

const inventoryCategories: InventoryItem["category"][] = [
  "feed", "medicine", "vaccines", "cleaning", "packaging",
];

const adminChartMetricLabels: Record<string, string> = {
  cartons: "Cartons",
  cartonsSold: "Cartons sold",
  eggs: "Eggs in stock",
  expensesCop: "Expenses",
  goodEggs: "Good eggs",
  purchasedKg: "Purchased kg",
  revenueCop: "Revenue",
  salesCop: "Sales",
  spendCop: "Feed spend",
  usedKg: "Used kg",
};

const eggCategoryColors: Record<EggSizeCategory, string> = {
  C: "#c9a167",
  B: "#d8aa56",
  A: "#e7bf68",
  AA: "#8e9f70",
  AAA: "#5f8660",
  Jumbo: "#315f42",
};

function formatAdminChartTooltipValue(value: unknown, name: unknown) {
  const metric = String(name);
  const numberValue = Number(value);
  return [
    metric === "revenueCop" || metric === "spendCop" || metric === "salesCop" || metric === "expensesCop"
      ? formatCop(Number.isFinite(numberValue) ? numberValue : 0)
      : formatNumber(Number.isFinite(numberValue) ? numberValue : 0),
    adminChartMetricLabels[metric] ?? metric,
  ];
}

function formatAdminPieTooltipValue(value: unknown, name: unknown, item: unknown) {
  const payload = item && typeof item === "object" && "payload" in item
    ? (item as { payload?: { metric?: string } }).payload : undefined;
  return formatAdminChartTooltipValue(value, payload?.metric ?? name);
}

async function saveFarmRecord(state: FarmState) {
  const response = await fetch("/api/farm-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Farm data save failed.");
  }
}

function parseNumber(value: string) {
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => String(row[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FarmAdminPage() {
  const [state, setState] = useState<FarmState>(() => createFreshFarmState());
  const [loaded, setLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>("daylight");
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>("checking");
  const [authMessage, setAuthMessage] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "daylight" || savedTheme === "nighttime") {
      setThemeMode(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }

    const localState = loadFarmState();
    setState(localState);
    setLoaded(true);
    setOnline(navigator.onLine);

    fetch("/api/farm-state")
      .then(async (r) => {
        if (!r.ok) throw new Error("Not ready");
        return (await r.json()) as { state: FarmState | null };
      })
      .then(({ state: dbState }) => {
        if (dbState) { setState(dbState); saveFarmState(dbState); }
        else { void saveFarmRecord(localState); }
        setDatabaseStatus("ready");
      })
      .catch(() => setDatabaseStatus("local"));
  }, []);

  useEffect(() => {
    if (loaded) saveFarmState(state);
  }, [loaded, state]);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [loaded, themeMode]);

  const metrics = useMemo(() => calculateFarmMetrics(state), [state]);
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const eggChartData = useMemo(() => getEggChartData(state), [state]);
  const salesChartData = useMemo(() => getSalesChartData(state), [state]);
  const feedChartData = useMemo(() => getFeedChartData(state), [state]);
  const reportRows = useMemo(() => getReportRows(state), [state]);

  function updateState(next: FarmState, message?: string) {
    setState(next);
    saveFarmState(next);
    if (!navigator.onLine) { setDatabaseStatus("local"); return; }
    void saveFarmRecord(next)
      .then(() => setDatabaseStatus("ready"))
      .catch((err) => {
        setDatabaseStatus("local");
        setAuthMessage(err instanceof Error ? err.message : "Save paused.");
      });
    if (message) setAuthMessage(message);
  }

  function handleReset() {
    updateState(createFreshFarmState(), "Farm data reset.");
  }

  if (!loaded) {
    return (
      <main className="admin-layout">
        <div className="admin-loading">Waking up the farm...</div>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Egg size={24} />
          <span>Brianna Eggs</span>
        </div>
        {adminNav.map((item) => {
          const Icon = item.icon;
          const selected = activeSection === item.id;
          return (
            <button key={item.id}
              className={`admin-nav-item ${selected ? "admin-nav-selected" : ""}`}
              onClick={() => setActiveSection(item.id)}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="admin-sidebar-footer">
          <button className="admin-nav-item" onClick={() => setThemeMode(themeMode === "daylight" ? "nighttime" : "daylight")}>
            {themeMode === "daylight" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{themeMode === "daylight" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </nav>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-title">Brianna Eggs Farm Manager</h1>
            <p className="admin-subtitle">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} &mdash;{" "}
              {databaseStatus === "ready" ? "Synced" : databaseStatus === "checking" ? "Loading..." : "Local only"}
            </p>
          </div>
          {authMessage && <p className="admin-toast">{authMessage}</p>}
        </header>

        <div className="admin-content">
          {activeSection === "overview" && (
            <OverviewSection state={state} metrics={metrics} alerts={alerts} insights={insights} chartData={eggChartData} />
          )}
          {activeSection === "eggs" && (
            <EggsSection state={state} updateState={updateState} />
          )}
          {activeSection === "sales" && (
            <SalesSection state={state} metrics={metrics} chartData={salesChartData} updateState={updateState} />
          )}
          {activeSection === "expenses" && (
            <ExpensesSection state={state} metrics={metrics} chartData={feedChartData} updateState={updateState} />
          )}
          {activeSection === "flock" && (
            <FlockSection state={state} updateState={updateState} />
          )}
          {activeSection === "inventory" && (
            <InventorySection state={state} updateState={updateState} />
          )}
          {activeSection === "health" && (
            <HealthSection state={state} updateState={updateState} />
          )}
          {activeSection === "investment" && (
            <InvestmentSection state={state} updateState={updateState} />
          )}
          {activeSection === "reports" && (
            <ReportsSection state={state} metrics={metrics} rows={reportRows} onReset={handleReset} />
          )}
        </div>
      </div>
    </main>
  );
}

function OverviewSection({
  state, metrics, alerts, insights, chartData,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  alerts: ReturnType<typeof buildAlerts>;
  insights: ReturnType<typeof buildInsights>;
  chartData: ReturnType<typeof getEggChartData>;
}) {
  const totalInvestment = (state.investments ?? []).reduce((s, i) => s + i.totalPrice, 0);
  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-12">
        <div className="admin-stats-row">
          <div className="admin-stat">
            <span className="admin-stat-value">{metrics.eggsToday}</span>
            <span className="admin-stat-label">Eggs today</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{metrics.totalBirds}</span>
            <span className="admin-stat-label">Birds</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{metrics.cartonsAvailable}</span>
            <span className="admin-stat-label">Cartons ready</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{formatNumber(metrics.feedStockKg)} kg</span>
            <span className="admin-stat-label">Feed stock</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{formatCop(metrics.monthlySales)}</span>
            <span className="admin-stat-label">Monthly sales</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{formatCop(metrics.monthlyProfit)}</span>
            <span className="admin-stat-label">Monthly profit</span>
          </div>
        </div>
      </section>

      <section className="admin-panel admin-span-5">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Production</p><h2>Egg chart</h2></div>
          <BarChart3 size={20} />
        </div>
        <div className="admin-chart">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#66736b" }} />
                <Tooltip formatter={formatAdminChartTooltipValue} />
                <Area type="monotone" dataKey="Eggs" stroke="#5f8660" fill="#5f8660" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <AdminChartEmpty label="No egg data yet." />}
        </div>
      </section>

      <section className="admin-panel admin-span-7">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Signals</p><h2>Farm insights</h2></div>
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

      {alerts.length ? (
        <section className="admin-panel admin-span-12">
          <div className="admin-panel-header"><div><h2>Alerts</h2></div><AlertTriangle size={20} /></div>
          <div className="admin-alerts-row">
            {alerts.map((a) => (
              <span key={a.id} className={`admin-alert ${a.tone}`}>{a.title}: {a.detail}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Birds</p><h2>Flock summary</h2></div>
          <Bird size={20} />
        </div>
        <div className="admin-stack">
          <div className="admin-progress-row">
            <div>
              <strong>Total birds</strong>
              <span>{metrics.totalBirds} birds ({state.flockArrivals.reduce((s, a) => s + a.quantity, 0)} arrivals - {state.mortalityRecords.reduce((s, m) => s + m.deaths, 0)} deaths)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EggsSection({
  state, updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({
    date: todayIso(),
    totalEggs: 0,
    crackedEggs: 0,
    sizeBreakdown: normalizeEggSizeBreakdown(),
    feedConsumedKg: 0,
    vitaminInWater: "",
    vitaminInFeed: "",
    notes: "",
  });
  const [searchWeek, setSearchWeek] = useState("");

  const totalEggs = form.totalEggs;
  const goodEggs = Math.max(totalEggs - form.crackedEggs, 0);
  const cartons = Math.floor(goodEggs / 30);
  const looseEggs = goodEggs % 30;
  const categorizedEggs = getEggSizeTotal(form.sizeBreakdown);
  const stockByCategory = useMemo(() => getEggStockByCategoryData(state), [state]);
  const allWeeks = useMemo(() => getAllWeeks(state), [state]);
  const weeklyData = useMemo(() => (searchWeek ? getWeeklyData(state, searchWeek) : null), [state, searchWeek]);

  function updateSizeBreakdown(category: EggSizeCategory, value: number) {
    setForm({ ...form, sizeBreakdown: normalizeEggSizeBreakdown({ ...form.sizeBreakdown, [category]: value }) });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const entry = { id: makeId("egg"), ...form, synced: true, createdAt: nowIso() };
    updateState({
      ...state,
      eggLogs: [...state.eggLogs.filter((log) => log.date !== form.date), entry].sort((a, b) => a.date.localeCompare(b.date)),
    }, "Egg log saved.");
    setForm({ date: todayIso(), totalEggs: 0, crackedEggs: 0, sizeBreakdown: normalizeEggSizeBreakdown(), feedConsumedKg: 0, vitaminInWater: "", vitaminInFeed: "", notes: "" });
  }

  function removeLog(id: string) {
    updateState({ ...state, eggLogs: state.eggLogs.filter((log) => log.id !== id) }, "Egg log deleted.");
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Production</p><h2>Daily egg log</h2></div>
          <Egg size={20} />
        </div>
        <form className="admin-form" onSubmit={submit}>
          <AdminField label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </AdminField>
          <AdminField label="Eggs collected">
            <input inputMode="numeric" value={form.totalEggs || ""} onChange={(e) => setForm({ ...form, totalEggs: parseNumber(e.target.value) })} />
          </AdminField>
          <AdminField label="Cracked eggs">
            <input inputMode="numeric" value={form.crackedEggs || ""} onChange={(e) => setForm({ ...form, crackedEggs: parseNumber(e.target.value) })} />
          </AdminField>
          <div className="egg-size-grid">
            {EGG_SIZE_ORDER.map((category) => (
              <EggSizeEntry key={category} category={category} value={form.sizeBreakdown[category]} onChange={(v) => updateSizeBreakdown(category, v)} />
            ))}
          </div>
          <AdminField label="Feed consumed (kg)">
            <input inputMode="numeric" value={form.feedConsumedKg || ""} onChange={(e) => setForm({ ...form, feedConsumedKg: parseNumber(e.target.value) })} />
          </AdminField>
          <AdminField label="Vitamin in water">
            <input value={form.vitaminInWater} onChange={(e) => setForm({ ...form, vitaminInWater: e.target.value })} placeholder="e.g. Compleland B12" />
          </AdminField>
          <AdminField label="Vitamin in feed">
            <input value={form.vitaminInFeed} onChange={(e) => setForm({ ...form, vitaminInFeed: e.target.value })} placeholder="e.g. Vitaponedora" />
          </AdminField>
          <AdminField label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </AdminField>
          <div className="admin-summary-strip">
            <span>Total {totalEggs}</span>
            <span>Good {goodEggs}</span>
            <span>Categorized {categorizedEggs}</span>
            <span>{cartons} cartons</span>
            <span>{looseEggs} loose</span>
          </div>
          <button className="admin-primary-button"><Save size={17} /> Save Egg Log</button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Stock</p><h2>Eggs in stock</h2></div>
          <Boxes size={20} />
        </div>
        <div className="admin-stock-chart-panel">
          <div className="admin-summary-strip">
            <span>{formatNumber(stockByCategory.categorizedAvailable)} categorized</span>
            <span>{Math.floor(stockByCategory.eggsAvailable / 30)} cartons</span>
            <span>{stockByCategory.eggsAvailable % 30} loose</span>
          </div>
          <div className="admin-chart stock">
            {stockByCategory.hasCategoryData ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stockByCategory.rows}>
                  <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#66736b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#66736b" }} />
                  <Tooltip formatter={formatAdminChartTooltipValue} />
                  <Bar dataKey="eggs" radius={[6, 6, 0, 0]}>
                    {stockByCategory.rows.map((row) => (<Cell key={row.category} fill={eggCategoryColors[row.category]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <AdminChartEmpty label="No size data yet." />}
          </div>
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Weekly search</p><h2>Search by week</h2></div>
          <ClipboardList size={20} />
        </div>
        <div className="admin-form">
          <AdminField label="Select week">
            <select value={searchWeek} onChange={(e) => setSearchWeek(e.target.value)}>
              <option value="">-- Select a week --</option>
              {allWeeks.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </AdminField>
          {weeklyData && (
            <div className="admin-stack">
              <div className="admin-summary-strip">
                <span>Week: {weeklyData.weekId}</span>
                <span>Eggs: {weeklyData.totalEggs}</span>
                <span>Good: {weeklyData.goodEggs}</span>
                <span>Laying: {weeklyData.layingPercentage}%</span>
                <span>Feed: {weeklyData.feedConsumed} kg</span>
                <span>Revenue: {formatCop(weeklyData.totalRevenue)}</span>
              </div>
              {weeklyData.vaccines.length > 0 && (
                <div className="admin-import-summary">
                  <p><strong>Vaccines this week:</strong> {weeklyData.vaccines.map((v) => `${v.date}: ${v.notes}`).join(", ")}</p>
                </div>
              )}
              <AdminTable
                headers={["Day", "Date", "Eggs", "Cracked", "Feed kg", "Vitamins"]}
                rows={weeklyData.logs.map((log) => [
                  <span key="day" className="capitalize">{getDayName(log.date)}</span>,
                  log.date,
                  log.totalEggs,
                  log.crackedEggs,
                  log.feedConsumedKg || "-",
                  [log.vitaminInWater ? `W:${log.vitaminInWater}` : "", log.vitaminInFeed ? `F:${log.vitaminInFeed}` : ""].filter(Boolean).join(" ") || "-",
                ])}
              />
            </div>
          )}
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">History</p><h2>Recent egg logs</h2></div>
          <button className="admin-secondary-button" onClick={() => downloadCsv("egg-logs.csv", state.eggLogs.map((log) => ({
            date: log.date, eggsCollected: log.totalEggs, crackedEggs: log.crackedEggs,
            feedKg: log.feedConsumedKg, vitaminWater: log.vitaminInWater, vitaminFeed: log.vitaminInFeed,
            sizeC: log.sizeBreakdown?.C || 0, sizeB: log.sizeBreakdown?.B || 0, sizeA: log.sizeBreakdown?.A || 0,
            sizeAA: log.sizeBreakdown?.AA || 0, sizeAAA: log.sizeBreakdown?.AAA || 0, sizeJumbo: log.sizeBreakdown?.Jumbo || 0,
            notes: log.notes || "",
          })))}><Download size={16} /> CSV</button>
        </div>
        <AdminTable
          headers={["Date", "Day", "Eggs", "Cracked", "Good", "Feed", "Vitamins", "Sizes / Notes", ""]}
          rows={state.eggLogs.slice().reverse().map((log) => [
            log.date,
            <span key="day" className="capitalize">{getDayName(log.date)}</span>,
            log.totalEggs,
            log.crackedEggs,
            log.totalEggs - log.crackedEggs,
            log.feedConsumedKg ? `${log.feedConsumedKg}kg` : "-",
            [log.vitaminInWater ? `W:${log.vitaminInWater}` : "", log.vitaminInFeed ? `F:${log.vitaminInFeed}` : ""].filter(Boolean).join(" ") || "-",
            [formatEggSizeBreakdown(log.sizeBreakdown), log.notes || ""].filter(Boolean).join(" | ") || "-",
            <button key="del" className="admin-table-action" onClick={() => removeLog(log.id)} title="Delete"><Trash2 size={15} /></button>,
          ])}
        />
      </section>
    </div>
  );
}

function SalesSection({
  state, metrics, chartData, updateState,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  chartData: ReturnType<typeof getSalesChartData>;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [form, setForm] = useState({ date: todayIso(), cartons: 0, pricePerCartonCop: 19000, customerName: "" });
  const total = form.cartons * form.pricePerCartonCop;
  const costPerEggByWeek = useMemo(() => getCostPerEggByWeek(state), [state]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const sale = { id: makeId("sale"), ...form };
    updateState({ ...state, sales: [...state.sales, sale] }, "Sale recorded.");
    setForm({ date: todayIso(), cartons: 0, pricePerCartonCop: 19000, customerName: "" });
  }

  function removeSale(id: string) {
    updateState({ ...state, sales: state.sales.filter((s) => s.id !== id) }, "Sale deleted.");
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Sales</p><h2>Record sale</h2></div>
          <ShoppingCart size={20} />
        </div>
        <form className="admin-form" onSubmit={submit}>
          <AdminField label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></AdminField>
          <AdminField label="Cartons sold"><input inputMode="numeric" value={form.cartons || ""} onChange={(e) => setForm({ ...form, cartons: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Price per carton COP"><input inputMode="numeric" value={form.pricePerCartonCop || ""} onChange={(e) => setForm({ ...form, pricePerCartonCop: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Customer name"><input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="e.g. Cliente A" /></AdminField>
          <div className="admin-summary-strip"><span>Total {formatCop(total)}</span></div>
          <button className="admin-primary-button"><Save size={17} /> Record Sale</button>
        </form>
      </section>

      <section className="admin-panel admin-span-8">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Revenue</p><h2>Sales list</h2></div>
          <Wallet size={20} />
        </div>
        <AdminTable
          headers={["Date", "Customer", "Cartons", "Price/carton", "Price/egg", "Total", "Cost/egg", ""]}
          rows={state.sales.slice().reverse().map((sale) => {
            const week = getWeekId(sale.date);
            const cost = costPerEggByWeek[week];
            return [
              sale.date,
              sale.customerName || "-",
              sale.cartons,
              formatCop(sale.pricePerCartonCop),
              formatCop(sale.pricePerCartonCop / 30),
              <strong key="t">{formatCop(sale.cartons * sale.pricePerCartonCop)}</strong>,
              cost ? formatCop(cost) : "-",
              <button key="del" className="admin-table-action" onClick={() => removeSale(sale.id)} title="Delete"><Trash2 size={15} /></button>,
            ];
          })}
        />
      </section>

      <section className="admin-panel admin-span-6">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Chart</p><h2>Revenue trend</h2></div>
          <BarChart3 size={20} />
        </div>
        <div className="admin-chart">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#66736b" }} />
                <Tooltip formatter={formatAdminChartTooltipValue} />
                <Bar dataKey="revenueCop" fill="#5f8660" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <AdminChartEmpty label="No sales yet." />}
        </div>
      </section>

      <section className="admin-panel admin-span-6">
        <div className="admin-panel-header">
          <div><p className="admin-eyebrow">Chart</p><h2>Cartons sold</h2></div>
          <ShoppingCart size={20} />
        </div>
        <div className="admin-chart">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#66736b" }} />
                <Tooltip formatter={formatAdminChartTooltipValue} />
                <Area type="monotone" dataKey="cartons" stroke="#b5926a" fill="#b5926a" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <AdminChartEmpty label="No carton sales." />}
        </div>
      </section>
    </div>
  );
}

function FlockSection({
  state, updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [arrival, setArrival] = useState({ date: todayIso(), quantity: 0, breed: "", notes: "" });
  const [death, setDeath] = useState({ date: todayIso(), deaths: 0, cause: "", notes: "" });

  const totalArrivals = state.flockArrivals.reduce((s, a) => s + a.quantity, 0);
  const totalDeaths = state.mortalityRecords.reduce((s, m) => s + m.deaths, 0);

  function submitArrival(e: FormEvent) {
    e.preventDefault();
    if (arrival.quantity <= 0) return;
    updateState({ ...state, flockArrivals: [...state.flockArrivals, { id: makeId("arrival"), ...arrival }] }, "Arrival saved.");
    setArrival({ date: todayIso(), quantity: 0, breed: "", notes: "" });
  }

  function submitDeath(e: FormEvent) {
    e.preventDefault();
    if (death.deaths <= 0) return;
    updateState({ ...state, mortalityRecords: [...state.mortalityRecords, { id: makeId("mort"), ...death }] }, "Mortality recorded.");
    setDeath({ date: todayIso(), deaths: 0, cause: "", notes: "" });
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-12">
        <div className="admin-stats-row">
          <div className="admin-stat"><span className="admin-stat-value">{totalArrivals - totalDeaths}</span><span className="admin-stat-label">Current birds</span></div>
          <div className="admin-stat"><span className="admin-stat-value">{totalArrivals}</span><span className="admin-stat-label">Total arrivals</span></div>
          <div className="admin-stat"><span className="admin-stat-value">{totalDeaths}</span><span className="admin-stat-label">Total deaths</span></div>
          <div className="admin-stat"><span className="admin-stat-value">{totalArrivals > 0 ? Math.round((totalDeaths / totalArrivals) * 100) : 0}%</span><span className="admin-stat-label">Mortality rate</span></div>
        </div>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Record arrival</h2></div><Plus size={20} /></div>
        <form className="admin-form" onSubmit={submitArrival}>
          <AdminField label="Date"><input type="date" value={arrival.date} onChange={(e) => setArrival({ ...arrival, date: e.target.value })} /></AdminField>
          <AdminField label="Quantity"><input inputMode="numeric" value={arrival.quantity || ""} onChange={(e) => setArrival({ ...arrival, quantity: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Breed"><input value={arrival.breed} onChange={(e) => setArrival({ ...arrival, breed: e.target.value })} placeholder="Ponedoras" /></AdminField>
          <AdminField label="Notes"><input value={arrival.notes} onChange={(e) => setArrival({ ...arrival, notes: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Save</button>
        </form>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Record mortality</h2></div><ClipboardList size={20} /></div>
        <form className="admin-form" onSubmit={submitDeath}>
          <AdminField label="Date"><input type="date" value={death.date} onChange={(e) => setDeath({ ...death, date: e.target.value })} /></AdminField>
          <AdminField label="Deaths"><input inputMode="numeric" value={death.deaths || ""} onChange={(e) => setDeath({ ...death, deaths: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Cause"><input value={death.cause} onChange={(e) => setDeath({ ...death, cause: e.target.value })} placeholder="Disease, accident..." /></AdminField>
          <AdminField label="Notes"><input value={death.notes} onChange={(e) => setDeath({ ...death, notes: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Record</button>
        </form>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Mortality log</h2></div><Trash2 size={20} /></div>
        <AdminTable
          headers={["Date", "Deaths", "Cause", "Notes"]}
          rows={state.mortalityRecords.slice().reverse().map((m) => [m.date, <strong key="d" className="text-red-600">{m.deaths}</strong>, m.cause || "-", m.notes || "-"])}
        />
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header"><div><h2>Arrivals log</h2></div><Bird size={20} /></div>
        <AdminTable
          headers={["Date", "Quantity", "Breed", "Notes"]}
          rows={state.flockArrivals.slice().reverse().map((a) => [a.date, a.quantity, a.breed || "-", a.notes || "-"])}
        />
      </section>
    </div>
  );
}

function ExpensesSection({
  state, metrics, chartData, updateState,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  chartData: ReturnType<typeof getFeedChartData>;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [purchase, setPurchase] = useState({ date: todayIso(), feedType: "Layer pellet", quantityKg: 0, priceCop: 0, supplier: "" });
  const [usage, setUsage] = useState({ date: todayIso(), quantityKg: 0, notes: "" });
  const [expense, setExpense] = useState({ date: todayIso(), category: "maintenance" as Expense["category"], amountCop: 0, description: "" });

  function submitPurchase(e: FormEvent) {
    e.preventDefault();
    const next = { id: makeId("feed-purchase"), ...purchase };
    updateState({
      ...state,
      feedPurchases: [...state.feedPurchases, next],
      inventoryItems: state.inventoryItems.map((item) => item.id === "inv-feed" ? { ...item, quantity: item.quantity + purchase.quantityKg } : item),
    }, "Feed purchase saved.");
    setPurchase({ date: todayIso(), feedType: "Layer pellet", quantityKg: 0, priceCop: 0, supplier: "" });
  }

  function submitUsage(e: FormEvent) {
    e.preventDefault();
    const next = { id: makeId("feed-use"), ...usage };
    updateState({ ...state, feedUsage: [...state.feedUsage, next] }, "Feed usage saved.");
    setUsage({ date: todayIso(), quantityKg: 0, notes: "" });
  }

  function submitExpense(e: FormEvent) {
    e.preventDefault();
    const next = { id: makeId("expense"), ...expense };
    updateState({ ...state, expenses: [...state.expenses, next] }, "Expense saved.");
    setExpense({ date: todayIso(), category: "maintenance", amountCop: 0, description: "" });
  }

  function removeFeedPurchase(id: string) { updateState({ ...state, feedPurchases: state.feedPurchases.filter((x) => x.id !== id) }, "Removed."); }
  function removeFeedUsage(id: string) { updateState({ ...state, feedUsage: state.feedUsage.filter((x) => x.id !== id) }, "Removed."); }
  function removeExpense(id: string) { updateState({ ...state, expenses: state.expenses.filter((x) => x.id !== id) }, "Removed."); }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Feed purchase</h2></div><Sprout size={20} /></div>
        <form className="admin-form" onSubmit={submitPurchase}>
          <AdminField label="Date"><input type="date" value={purchase.date} onChange={(e) => setPurchase({ ...purchase, date: e.target.value })} /></AdminField>
          <AdminField label="Type"><input value={purchase.feedType} onChange={(e) => setPurchase({ ...purchase, feedType: e.target.value })} /></AdminField>
          <AdminField label="Quantity kg"><input inputMode="numeric" value={purchase.quantityKg || ""} onChange={(e) => setPurchase({ ...purchase, quantityKg: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Price COP"><input inputMode="numeric" value={purchase.priceCop || ""} onChange={(e) => setPurchase({ ...purchase, priceCop: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Supplier"><input value={purchase.supplier} onChange={(e) => setPurchase({ ...purchase, supplier: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Save</button>
        </form>
        <AdminTable headers={["Date", "Kg", "Price", ""]} rows={state.feedPurchases.slice().reverse().map((p) => [p.date, `${p.quantityKg}kg`, formatCop(p.priceCop), <button key="del" className="admin-table-action" onClick={() => removeFeedPurchase(p.id)}><Trash2 size={14} /></button>])} />
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Feed usage</h2></div><Package size={20} /></div>
        <div className="admin-form">
          <div className="admin-summary-strip"><span>Stock: {formatNumber(metrics.feedStockKg)} kg</span><span>{metrics.feedDaysRemaining} days</span></div>
        </div>
        <form className="admin-form" onSubmit={submitUsage}>
          <AdminField label="Date"><input type="date" value={usage.date} onChange={(e) => setUsage({ ...usage, date: e.target.value })} /></AdminField>
          <AdminField label="Quantity kg"><input inputMode="numeric" value={usage.quantityKg || ""} onChange={(e) => setUsage({ ...usage, quantityKg: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Notes"><input value={usage.notes} onChange={(e) => setUsage({ ...usage, notes: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Save</button>
        </form>
        <AdminTable headers={["Date", "Kg", "Notes", ""]} rows={state.feedUsage.slice().reverse().map((u) => [u.date, `${u.quantityKg}kg`, u.notes || "-", <button key="del" className="admin-table-action" onClick={() => removeFeedUsage(u.id)}><Trash2 size={14} /></button>])} />
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Other expense</h2></div><ReceiptText size={20} /></div>
        <form className="admin-form" onSubmit={submitExpense}>
          <AdminField label="Date"><input type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} /></AdminField>
          <AdminField label="Category">
            <select value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value as Expense["category"] })}>
              {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </AdminField>
          <AdminField label="Amount COP"><input inputMode="numeric" value={expense.amountCop || ""} onChange={(e) => setExpense({ ...expense, amountCop: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Description"><input value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Save</button>
        </form>
        <AdminTable headers={["Date", "Category", "Amount", ""]} rows={state.expenses.slice().reverse().map((e) => [e.date, e.category, formatCop(e.amountCop), <button key="del" className="admin-table-action" onClick={() => removeExpense(e.id)}><Trash2 size={14} /></button>])} />
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header"><div><h2>Feed kg & spend</h2></div><BarChart3 size={20} /></div>
        <div className="admin-chart" style={{ height: 240 }}>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#66736b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#66736b" }} />
                <Tooltip formatter={formatAdminChartTooltipValue} />
                <Bar dataKey="purchasedKg" fill="#5f8660" radius={[4, 4, 0, 0]} />
                <Bar dataKey="usedKg" fill="#b5926a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <AdminChartEmpty label="No data." />}
        </div>
      </section>
    </div>
  );
}

function InventorySection({
  state, updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  function updateItem(id: string, patch: Partial<InventoryItem>) {
    updateState({ ...state, inventoryItems: state.inventoryItems.map((item) => item.id === id ? { ...item, ...patch } : item) }, "Updated.");
  }

  return (
    <div className="admin-grid">
      {state.inventoryItems.map((item) => {
        const low = item.quantity <= item.reorderLevel;
        return (
          <section key={item.id} className={`admin-panel admin-span-4 ${low ? "admin-panel-warning" : ""}`}>
            <div className="admin-panel-header"><div><h2>{item.name}</h2><p className="admin-eyebrow">{item.category}</p></div>{low ? <AlertTriangle size={18} /> : <Boxes size={18} />}</div>
            <div className="admin-form">
              <AdminField label={`Quantity (${item.unit})`}><input inputMode="numeric" value={item.quantity || ""} onChange={(e) => updateItem(item.id, { quantity: parseNumber(e.target.value) })} /></AdminField>
              <AdminField label="Reorder level"><input inputMode="numeric" value={item.reorderLevel || ""} onChange={(e) => updateItem(item.id, { reorderLevel: parseNumber(e.target.value) })} /></AdminField>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function HealthSection({
  state, updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState, message: string) => void;
}) {
  const [health, setHealth] = useState({ date: todayIso(), type: "vaccination" as HealthRecord["type"], sickBirds: 0, deaths: 0, notes: "" });
  const [task, setTask] = useState({ title: "", dueDate: todayIso(), notes: "" });

  function submitHealth(e: FormEvent) {
    e.preventDefault();
    updateState({ ...state, healthRecords: [...state.healthRecords, { id: makeId("health"), ...health }] }, "Health record saved.");
    setHealth({ date: todayIso(), type: "vaccination", sickBirds: 0, deaths: 0, notes: "" });
  }

  function submitTask(e: FormEvent) {
    e.preventDefault();
    updateState({ ...state, maintenanceTasks: [...state.maintenanceTasks, { id: makeId("task"), title: task.title, dueDate: task.dueDate, notes: task.notes, status: "open" }] }, "Reminder added.");
    setTask({ title: "", dueDate: todayIso(), notes: "" });
  }

  function removeHealth(id: string) { updateState({ ...state, healthRecords: state.healthRecords.filter((r) => r.id !== id) }, "Deleted."); }
  function toggleTask(id: string) { updateState({ ...state, maintenanceTasks: state.maintenanceTasks.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t) }, "Toggled."); }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Health record</h2></div><HeartPulse size={20} /></div>
        <form className="admin-form" onSubmit={submitHealth}>
          <AdminField label="Date"><input type="date" value={health.date} onChange={(e) => setHealth({ ...health, date: e.target.value })} /></AdminField>
          <AdminField label="Type">
            <select value={health.type} onChange={(e) => setHealth({ ...health, type: e.target.value as HealthRecord["type"] })}>
              <option value="vaccination">Vaccination</option>
              <option value="medicine">Medicine</option>
              <option value="sick">Sick</option>
              <option value="death">Death</option>
            </select>
          </AdminField>
          <AdminField label="Sick birds"><input inputMode="numeric" value={health.sickBirds || ""} onChange={(e) => setHealth({ ...health, sickBirds: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Deaths"><input inputMode="numeric" value={health.deaths || ""} onChange={(e) => setHealth({ ...health, deaths: parseNumber(e.target.value) })} /></AdminField>
          <AdminField label="Notes"><textarea value={health.notes} onChange={(e) => setHealth({ ...health, notes: e.target.value })} rows={3} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Save</button>
        </form>
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Reminders</h2></div><Settings size={20} /></div>
        <form className="admin-form" onSubmit={submitTask}>
          <AdminField label="Title"><input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Cleaning, feed buying..." /></AdminField>
          <AdminField label="Due date"><input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} /></AdminField>
          <AdminField label="Notes"><input value={task.notes} onChange={(e) => setTask({ ...task, notes: e.target.value })} /></AdminField>
          <button className="admin-primary-button"><Save size={17} /> Add</button>
        </form>
        <AdminTable headers={["Task", "Due", "Status", ""]} rows={state.maintenanceTasks.map((t) => [t.title, t.dueDate, <button key="s" className="admin-table-action" onClick={() => toggleTask(t.id)}>{t.status}</button>, <button key="del" className="admin-table-action" onClick={() => updateState({ ...state, maintenanceTasks: state.maintenanceTasks.filter((x) => x.id !== t.id) }, "Deleted.")}><Trash2 size={14} /></button>])} />
      </section>

      <section className="admin-panel admin-span-4">
        <div className="admin-panel-header"><div><h2>Health log</h2></div><ClipboardList size={20} /></div>
        <AdminTable headers={["Date", "Type", "Notes", ""]} rows={state.healthRecords.slice().reverse().map((r) => [r.date, r.type, r.notes, <button key="del" className="admin-table-action" onClick={() => removeHealth(r.id)}><Trash2 size={14} /></button>])} />
      </section>
    </div>
  );
}

function ReportsSection({
  state, metrics, rows, onReset,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  rows: ReturnType<typeof getReportRows>;
  onReset: () => void;
}) {
  function exportCsv() {
    const header = ["date", "eggsCollected", "crackedEggs", "goodEggs", "feedKg",
      "sizeC", "sizeB", "sizeA", "sizeAA", "sizeAAA", "sizeJumbo", "sizeTotal", "sizeSummary", "cartonsSold", "salesCop", "expensesCop"];
    const csv = [header.join(","), ...rows.map((r) => header.map((k) => String(r[k as keyof typeof r])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report-${todayIso()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Brianna Eggs Report", 14, 18);
    doc.setFontSize(11); doc.text(`Date: ${todayIso()}`, 14, 28);
    doc.text(`Cartons: ${metrics.cartonsAvailable}`, 14, 38);
    doc.text(`Sales: ${formatCop(metrics.monthlySales)}`, 14, 48);
    doc.text(`Expenses: ${formatCop(metrics.monthlyExpenses)}`, 14, 58);
    doc.text(`Profit: ${formatCop(metrics.monthlyProfit)}`, 14, 68);
    let y = 84;
    rows.slice(-10).forEach((r) => { doc.text(`${r.date}: ${r.goodEggs} eggs, ${r.cartonsSold} sold, ${formatCop(r.salesCop)}`, 14, y); y += 8; });
    doc.save(`report-${todayIso()}.pdf`);
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel admin-span-12">
        <div className="admin-stats-row">
          <div className="admin-stat"><span className="admin-stat-value">{metrics.eggsAvailable}</span><span className="admin-stat-label">Eggs available</span></div>
          <div className="admin-stat"><span className="admin-stat-value">{metrics.cartonsAvailable}</span><span className="admin-stat-label">Cartons</span></div>
          <div className="admin-stat"><span className="admin-stat-value">{formatCop(metrics.monthlyProfit)}</span><span className="admin-stat-label">Monthly profit</span></div>
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header"><div><h2>Exports</h2></div><Download size={20} /></div>
        <div className="admin-form" style={{ flexDirection: "row", gap: 12 }}>
          <button className="admin-primary-button" onClick={exportCsv}><Download size={17} /> CSV</button>
          <button className="admin-primary-button" onClick={() => void exportPdf()}><Download size={17} /> PDF</button>
          <button className="admin-secondary-button" onClick={onReset}><RefreshCw size={17} /> Reset</button>
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header"><div><h2>Last 14 days</h2></div><BarChart3 size={20} /></div>
        <div className="admin-chart" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 7" stroke="#d7ddd5" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#66736b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#66736b" }} />
              <Tooltip />
              <Bar dataKey="goodEggs" fill="#5f8660" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cartonsSold" fill="#b5926a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="admin-panel admin-span-12">
        <div className="admin-panel-header"><div><h2>Data table</h2></div><ClipboardList size={20} /></div>
        <AdminTable
          headers={["Date", "Eggs", "Good", "Feed", "Sizes", "Cartons sold", "Sales"]}
          rows={rows.slice().reverse().map((r) => [r.date, r.eggsCollected, r.goodEggs, r.feedKg ? `${r.feedKg}kg` : "-", r.sizeSummary, r.cartonsSold, formatCop(r.salesCop)])}
        />
      </section>
    </div>
  );
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  );
}

function AdminChartEmpty({ label }: { label: string }) {
  return <div className="admin-chart-empty">{label}</div>;
}

function EggSizeEntry({ category, value, onChange }: { category: EggSizeCategory; value: number; onChange: (value: number) => void }) {
  return (
    <label className="egg-size-card">
      <span className="egg-size-visual">
        <span className={`egg-size-egg size-${category.toLowerCase()}`} />
        <span className="egg-size-label">{category}</span>
      </span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={value || ""}
        onChange={(e) => onChange(parseNumber(e.target.value))} />
    </label>
  );
}
