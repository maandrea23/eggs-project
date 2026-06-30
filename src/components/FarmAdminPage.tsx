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
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingCart,
  Sprout,
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
  | "reports";

type DatabaseStatus = "checking" | "ready" | "local";

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
  { id: "flock", label: "Coops", icon: Bird },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "health", label: "Health", icon: HeartPulse },
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
