"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BarChart3,
  Bird,
  Boxes,
  ClipboardList,
  Cloud,
  CloudOff,
  Download,
  Egg,
  Ellipsis,
  HeartPulse,
  Home,
  LogOut,
  Moon,
  Plus,
  Package,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingCart,
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
  getWeeklyData,
  getAllWeeks,
  getDayName,
  getCostPerEggByWeek,
} from "@/lib/calculations";
import {
  EGG_SIZE_ORDER,
  formatEggSizeBreakdown,
  getEggSizeTotal,
  normalizeEggSizeBreakdown,
} from "@/lib/egg-classification";
import { createFreshFarmState } from "@/lib/farm-state-defaults";
import { loadFarmState, resetFarmState, saveFarmState } from "@/lib/local-store";
import type { ThemeMode } from "@/lib/theme-mode";
import { useThemeMode } from "@/lib/use-theme-mode";
import InvestmentSection from "@/components/InvestmentSection";
import type {
  Expense,
  FarmState,
  HealthRecord,
  OfflineQueueItem,
  EggSizeCategory,
  FlockArrival,
  MortalityRecord,
} from "@/lib/types";

type TabKey =
  | "dashboard"
  | "flock"
  | "eggs"
  | "sales"
  | "expenses"
  | "investment"
  | "more";

type MoreSectionKey = "inventory" | "health" | "reports";

type UserMode = "owner" | "operator";
type OrganicTone = "moss" | "harvest" | "clay" | "plum";
type DatabaseStatus = "checking" | "ready" | "local";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;

function formatNumericInputValue(value: number) {
  return Number.isNaN(value) || value === 0 ? "" : String(value);
}

function parseNumericInputValue(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly ? Number.parseInt(digitsOnly, 10) : 0;
}

async function saveFarmRecord(state: FarmState) {
  const response = await fetch("/api/farm-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Farm data save failed.");
  }
}

const tabs: { id: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] =
  [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "eggs", label: "Eggs", icon: Egg },
    { id: "flock", label: "Flock", icon: Bird },
    { id: "sales", label: "Sales", icon: ShoppingCart },
    { id: "expenses", label: "Expenses", icon: ReceiptText },
    { id: "investment", label: "Investment", icon: PiggyBank },
    { id: "more", label: "More", icon: Ellipsis },
  ];

const expenseCategories: Expense["category"][] = [
  "maintenance", "medicine", "vaccines", "bedding", "transport",
  "labour", "electricity", "water", "repairs", "packaging", "cleaning",
];

const chartMetricLabels: Record<string, string> = {
  averageCartonPrice: "Avg carton price",
  cartons: "Cartons",
  eggs: "Eggs in stock",
  orders: "Orders",
  purchasedKg: "Purchased kg",
  revenueCop: "Revenue",
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

function formatChartTooltipValue(value: unknown, name: unknown) {
  const metric = String(name);
  const numberValue = Number(value);

  return [
    metric === "revenueCop" ||
    metric === "spendCop" ||
    metric === "averageCartonPrice"
      ? formatCop(Number.isFinite(numberValue) ? numberValue : 0)
      : formatNumber(Number.isFinite(numberValue) ? numberValue : 0),
    chartMetricLabels[metric] ?? metric,
  ];
}

export default function FarmApp() {
  const [state, setState] = useState<FarmState>(() => createFreshFarmState());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [moreSection, setMoreSection] = useState<MoreSectionKey>("inventory");
  const [userMode, setUserMode] = useState<UserMode | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [themeMode, setThemeMode] = useThemeMode();
  const [databaseStatus, setDatabaseStatus] =
    useState<DatabaseStatus>("checking");

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const localState = loadFarmState();
      setState(localState);
      setLoaded(true);
      setOnline(navigator.onLine);

      fetch("/api/farm-state")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Farm data is not ready yet.");
          }

          return (await response.json()) as { state: FarmState | null };
        })
        .then(({ state: databaseState }) => {
          if (databaseState) {
            setState(databaseState);
            saveFarmState(databaseState);
          } else {
            void saveFarmRecord(localState);
          }

          setDatabaseStatus("ready");
        })
        .catch(() => {
          setDatabaseStatus("local");
        });
    }, 0);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      saveFarmState(state);
    }
  }, [loaded, state]);

  const operatorTabs: TabKey[] = ["dashboard", "eggs", "expenses"];
  const allowedTabs = userMode === "operator" ? operatorTabs : tabs.map((t) => t.id);

  const metrics = useMemo(() => calculateFarmMetrics(state), [state]);
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const eggChartData = useMemo(() => getEggChartData(state), [state]);
  const salesChartData = useMemo(() => getSalesChartData(state), [state]);
  const feedChartData = useMemo(() => getFeedChartData(state), [state]);
  const reportRows = useMemo(() => getReportRows(state), [state]);

  function updateState(next: FarmState) {
    setState(next);
    saveFarmState(next);

    if (!navigator.onLine) {
      setDatabaseStatus("local");
      return;
    }

    void saveFarmRecord(next)
      .then(() => {
        setDatabaseStatus("ready");
      })
      .catch((error) => {
        setDatabaseStatus("local");
        setAuthMessage(
          error instanceof Error
            ? `Farm data save paused: ${error.message}`
            : "Farm data save paused. Changes are still saved on this device.",
        );
      });
  }

  function queueOfflineItem(
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) {
    return {
      id: makeId("queue"),
      tableName,
      action: "insert" as const,
      payload,
      createdAt: nowIso(),
    };
  }

  function handleOwnerLogin() {
    setUserMode("owner");
    setAuthMessage("");
  }

  function handleOperatorLogin() {
    setUserMode("operator");
    setActiveTab("eggs");
    setAuthMessage("");
  }

  async function syncOfflineQueue() {
    if (!online) {
      return;
    }

    setSyncing(true);

    try {
      await saveFarmRecord(state);
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? `Farm data save failed: ${error.message}`
          : "Farm data save failed. Changes are still saved on this device.",
      );
      setDatabaseStatus("local");
      setSyncing(false);
      return;
    }

    updateState({
      ...state,
      offlineQueue: state.offlineQueue.map((item) =>
        item.syncedAt ? item : { ...item, syncedAt: nowIso() },
      ),
    });
    setAuthMessage("Waiting entries saved to the farm records.");
    setDatabaseStatus("ready");
    setSyncing(false);
  }

  function handleResetFarmWorkspace() {
    updateState(resetFarmState());
    setActiveTab("dashboard");
    setAuthMessage("Farm workspace reset.");
  }

  if (!loaded) {
    return (
      <main className="app-shell grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <div className="organic-illustration mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[2rem] shadow-lg">
            <Egg className="text-[var(--forest)]" size={38} />
          </div>
          <p className="text-sm font-black tracking-wide text-[var(--muted)]">
            Waking up the farm...
          </p>
        </div>
      </main>
    );
  }

  const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : "dashboard";

  if (userMode === "operator" && activeTab !== effectiveTab) {
    setActiveTab(effectiveTab);
  }

  if (!userMode) {
    return (
      <main className="app-shell px-4 py-6">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">
          <div className="mb-6 flex items-center gap-4">
            <div className="organic-illustration grid h-16 w-16 place-items-center rounded-[1.75rem] shadow-lg">
              <Egg className="text-[var(--forest)]" size={30} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--clay)]">
                Brianna Eggs
              </p>
              <h1 className="text-4xl font-black tracking-tight">
                Farm manager
              </h1>
            </div>
          </div>
          <div className="mb-4 flex justify-end">
            <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
          </div>

          <div className="floating-card p-5">
            <div className="grid gap-3">
              <button
                className="primary-button flex h-14 items-center justify-center gap-2 px-4 text-base"
                onClick={handleOwnerLogin}
              >
                <Home size={20} />
                Owner Mode — Full access
              </button>
              <button
                className="secondary-button flex h-14 items-center justify-center gap-2 px-4 text-base"
                onClick={handleOperatorLogin}
              >
                <ClipboardList size={20} />
                Operator Mode — Daily production only
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <FloatingSideNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="mx-auto max-w-6xl pb-28 md:ml-28 md:pb-10 lg:ml-auto">
        <header className="sticky top-0 z-20 px-4 py-4 backdrop-blur md:static md:px-6 md:pt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--clay)]">
                Brianna Eggs
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                How is the farm today?
              </h1>
              <p className="mt-2 hidden max-w-xl text-sm font-semibold leading-6 text-[var(--muted)] md:block">
                {userMode === "operator"
                  ? "Operator mode: record eggs, feed, and health daily."
                  : "Healthy animals, steady production, calm business."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
              <button
                className="secondary-button grid h-12 w-12 place-items-center"
                onClick={() => void syncOfflineQueue()}
                title="Save waiting entries"
              >
                <RefreshCw
                  className={syncing ? "animate-spin" : ""}
                  size={19}
                />
              </button>
              <button
                className="secondary-button grid h-12 w-12 place-items-center"
                onClick={() => setUserMode(null)}
                title="Log out"
              >
                <LogOut size={19} />
              </button>
            </div>
          </div>

          <div className="mt-5 hidden gap-2 overflow-x-auto pb-1 md:flex lg:hidden">
            {tabs.filter((t) => allowedTabs.includes(t.id)).map((tab) => {
              const Icon = tab.icon;
              const selected = effectiveTab === tab.id;

              return (
                <button
                  key={tab.id}
                  className={`flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black ${
                    selected
                      ? "bg-[var(--base-moss)] text-[var(--foreground)] shadow-lg"
                      : "bg-[var(--card)] text-[var(--olive)] shadow-sm"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="px-4 py-3 md:px-6 md:py-5">
          <SyncBanner
            online={online}
            queueCount={state.offlineQueue.filter((item) => !item.syncedAt).length}
            databaseStatus={databaseStatus}
            message={authMessage}
          />

          {effectiveTab === "dashboard" ? (
            <DashboardSection
              state={state}
              metrics={metrics}
              alerts={alerts}
              insights={insights}
              chartData={eggChartData}
              onQuickEgg={() => setActiveTab("eggs")}
            />
          ) : null}
          {effectiveTab === "eggs" ? (
            <EggLoggingSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
              online={online}
              metrics={metrics}
            />
          ) : null}
          {effectiveTab === "sales" ? (
            userMode === "owner" ? (
              <SalesSection
                state={state}
                updateState={updateState}
                queueOfflineItem={queueOfflineItem}
                cartonsAvailable={metrics.cartonsAvailable}
                chartData={salesChartData}
              />
            ) : null
          ) : null}
          {effectiveTab === "flock" ? (
            userMode === "owner" ? (
              <FlockSection state={state} updateState={updateState} />
            ) : null
          ) : null}
          {effectiveTab === "expenses" ? (
            <FeedExpenseSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
              metrics={metrics}
              chartData={feedChartData}
            />
          ) : null}
          {effectiveTab === "investment" ? (
            userMode === "owner" ? (
              <InvestmentSection state={state} updateState={updateState} />
            ) : null
          ) : null}
          {effectiveTab === "more" ? (
            userMode === "owner" ? (
              <MoreSection
                state={state}
                metrics={metrics}
                rows={reportRows}
                moreSection={moreSection}
                setMoreSection={setMoreSection}
                updateState={updateState}
                onReset={handleResetFarmWorkspace}
              />
            ) : null
          ) : null}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden">
        <div className="floating-card grid grid-cols-7 gap-1 p-2">
          {tabs.filter((t) => allowedTabs.includes(t.id)).map((tab) => {
            const Icon = tab.icon;
            const selected = effectiveTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`grid h-14 place-items-center rounded-[1.25rem] ${
                  selected
                    ? "bg-[var(--base-moss)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon size={22} />
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function SyncBanner({
  online,
  queueCount,
  databaseStatus,
  message,
}: {
  online: boolean;
  queueCount: number;
  databaseStatus: DatabaseStatus;
  message: string;
}) {
  return (
    <section className="premium-card mb-5 grid gap-2 p-3 text-sm font-bold text-[var(--muted)] md:grid-cols-3">
      <div className="flex items-center gap-2">
        {online ? <Cloud size={18} /> : <CloudOff size={18} />}
        {online ? "Online" : "Offline mode"}
      </div>
      <div className="flex items-center gap-2">
        <ClipboardList size={18} />
        {queueCount} entr{queueCount === 1 ? "y" : "ies"} waiting to save
      </div>
      <div className="flex items-center gap-2">
        <Settings size={18} />
        {databaseStatus === "ready"
          ? "Farm records ready"
          : databaseStatus === "checking"
            ? "Checking farm records"
            : "Changes saved on this device"}
      </div>
      {message ? (
        <p className="soft-panel p-3 text-[var(--clay)] md:col-span-3">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function DashboardSection({
  state,
  metrics,
  alerts,
  insights,
  chartData,
  onQuickEgg,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  alerts: ReturnType<typeof buildAlerts>;
  insights: ReturnType<typeof buildInsights>;
  chartData: ReturnType<typeof getEggChartData>;
  onQuickEgg: () => void;
}) {
  return (
    <div className="grid gap-5">
      <section className="floating-card tone-card tone-moss overflow-hidden p-5 text-[var(--foreground)] md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--clay)]">
              Bienvenida Brianna
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
              Today's eggs: {metrics.eggsToday}
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              {metrics.totalBirds} birds in the flock &mdash;{" "}
              {metrics.cartonsAvailable} cartons ready.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-[var(--mustard)] px-5 py-3 text-sm font-black text-[#263429]"
            onClick={onQuickEgg}
          >
            <Egg size={18} className="mr-2 inline" />
            Log today&apos;s eggs
          </button>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            {metrics.totalBirds} birds
          </div>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            {metrics.totalDeaths > 0
              ? `${Math.round((metrics.totalDeaths / metrics.totalArrivals) * 100)}% mortality`
              : "0% mortality"}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Egg} label="Eggs today" value={metrics.eggsToday} tone="harvest" />
        <MetricCard icon={Bird} label="Birds" value={metrics.totalBirds} tone="moss" />
        <MetricCard icon={ShoppingCart} label="Cartons ready" value={metrics.cartonsAvailable} tone="clay" />
        <MetricCard icon={Package} label="Feed stock" value={`${formatNumber(metrics.feedStockKg)} kg`} tone="plum" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MoneyCard label="Monthly sales" value={metrics.monthlySales} tone="harvest" />
        <MoneyCard label="Monthly expenses" value={metrics.monthlyExpenses} tone="clay" />
        <MoneyCard label="Monthly profit" value={metrics.monthlyProfit} positive={metrics.monthlyProfit > 0} tone="plum" />
      </section>

      <section className="floating-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-[var(--cream)] text-[var(--olive)]">
            <BarChart3 size={19} />
          </div>
          <h2 className="text-lg font-black tracking-tight">Egg production</h2>
        </div>
        <div className="h-64">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip formatter={formatChartTooltipValue} />
                <Area
                  type="monotone"
                  dataKey="Eggs"
                  stroke="var(--base-moss)"
                  fill="var(--base-moss)"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty label="Start logging eggs to see the chart." />
          )}
        </div>
      </section>

      {alerts.length ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--clay)]">
            Alerts ({alerts.length})
          </h3>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`premium-card flex items-start gap-3 p-4 ${
                alert.tone === "danger"
                  ? "border-l-4 border-l-red-500"
                  : alert.tone === "warning"
                    ? "border-l-4 border-l-yellow-500"
                    : "border-l-4 border-l-blue-300"
              }`}
            >
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[var(--clay)]" />
              <div>
                <p className="font-black">{alert.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{alert.detail}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {insights.length ? (
        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <div key={insight.id} className="soft-panel p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">
                {insight.title}
              </p>
              <p className="mt-1 text-2xl font-black">{insight.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{insight.detail}</p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function EggLoggingSection({
  state,
  updateState,
  queueOfflineItem,
  online,
  metrics,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  online: boolean;
  metrics: ReturnType<typeof calculateFarmMetrics>;
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
  const allWeeks = useMemo(() => getAllWeeks(state), [state]);
  const weeklyData = useMemo(
    () => (searchWeek ? getWeeklyData(state, searchWeek) : null),
    [state, searchWeek],
  );
  const costPerEggByWeek = useMemo(() => getCostPerEggByWeek(state), [state]);

  const totalEggs = form.totalEggs;
  const goodEggs = Math.max(totalEggs - form.crackedEggs, 0);
  const cartons = Math.floor(goodEggs / 30);
  const loose = goodEggs % 30;
  const categorizedEggs = getEggSizeTotal(form.sizeBreakdown);
  const stockByCategory = useMemo(
    () => getEggStockByCategoryData(state),
    [state],
  );

  function updateSizeBreakdown(category: EggSizeCategory, value: number) {
    setForm({
      ...form,
      sizeBreakdown: normalizeEggSizeBreakdown({
        ...form.sizeBreakdown,
        [category]: value,
      }),
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const entry = {
      id: makeId("egg"),
      ...form,
      synced: online,
      createdAt: nowIso(),
    };

    updateState({
      ...state,
      eggLogs: [
        ...state.eggLogs.filter((log) => log.date !== form.date),
        entry,
      ].sort((a, b) => a.date.localeCompare(b.date)),
      offlineQueue: [
        ...state.offlineQueue,
        queueOfflineItem("egg_logs", entry),
      ],
    });

    setForm({
      date: todayIso(),
      totalEggs: 0,
      crackedEggs: 0,
      sizeBreakdown: normalizeEggSizeBreakdown(),
      feedConsumedKg: 0,
      vitaminInWater: "",
      vitaminInFeed: "",
      notes: "",
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="Daily egg logging" icon={Egg}>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Date">
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </Field>
            <LargeNumberField
              label="Eggs collected"
              hint="Total for the day"
              value={form.totalEggs}
              onChange={(value) => setForm({ ...form, totalEggs: value })}
            />
            <NumberField
              label="Cracked or damaged"
              value={form.crackedEggs}
              onChange={(value) => setForm({ ...form, crackedEggs: value })}
            />
            <div className="egg-size-grid">
              {EGG_SIZE_ORDER.map((category) => (
                <EggSizeEntry
                  key={category}
                  category={category}
                  value={form.sizeBreakdown[category]}
                  onChange={(value) => updateSizeBreakdown(category, value)}
                />
              ))}
            </div>
            <NumberField
              label="Feed consumed (kg)"
              value={form.feedConsumedKg}
              onChange={(value) => setForm({ ...form, feedConsumedKg: value })}
            />
            <Field label="Vitamin in water">
              <input
                className="input"
                value={form.vitaminInWater}
                onChange={(event) =>
                  setForm({ ...form, vitaminInWater: event.target.value })
                }
                placeholder="e.g. Compleland B12"
              />
            </Field>
            <Field label="Vitamin in feed">
              <input
                className="input"
                value={form.vitaminInFeed}
                onChange={(event) =>
                  setForm({ ...form, vitaminInFeed: event.target.value })
                }
                placeholder="e.g. Vitaponedora"
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input min-h-24 py-3"
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="Optional note"
              />
            </Field>
            <div className="soft-panel grid grid-cols-2 gap-2 p-3 text-center sm:grid-cols-4">
              <MiniTotal label="Total" value={totalEggs} />
              <MiniTotal label="Cartons" value={cartons} />
              <MiniTotal label="Loose" value={loose} />
              <MiniTotal label="Sized" value={categorizedEggs} />
            </div>
            <button className="primary-button flex h-14 items-center justify-center gap-2 text-base">
              <Save size={20} />
              Save egg log
            </button>
          </form>
        </Card>

        <Card title="Eggs in stock" icon={BarChart3}>
          <div className="grid gap-3">
            <div className="soft-panel grid grid-cols-2 gap-2 p-3 text-center">
              <MiniTotal label="Available" value={stockByCategory.eggsAvailable} />
              <MiniTotal label="Cartons" value={Math.floor(stockByCategory.eggsAvailable / 30)} />
              <MiniTotal label="Categorized" value={stockByCategory.categorizedAvailable} />
              <MiniTotal label="Loose" value={stockByCategory.eggsAvailable % 30} />
            </div>

            {stockByCategory.uncategorizedAvailable ? (
              <p className="soft-panel p-3 text-sm font-bold text-[var(--muted)]">
                {formatNumber(stockByCategory.uncategorizedAvailable)} available eggs
                do not have a size category yet.
              </p>
            ) : null}

            <div className="h-64">
              {stockByCategory.hasCategoryData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockByCategory.rows}>
                    <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip formatter={formatChartTooltipValue} />
                    <Bar dataKey="eggs" radius={[12, 12, 0, 0]}>
                      {stockByCategory.rows.map((row) => (
                        <Cell key={row.category} fill={eggCategoryColors[row.category]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty label="Log egg size categories to build this chart." />
              )}
            </div>

            <div className="grid gap-2 text-sm font-bold text-[var(--muted)]">
              {stockByCategory.rows.map((row) => (
                <div key={row.category} className="soft-panel flex items-center justify-between gap-3 p-3">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: eggCategoryColors[row.category] }} />
                    {row.category}
                  </span>
                  <span>
                    {formatNumber(row.eggs)} eggs
                    {row.eggs ? ` - ${row.cartons} cartons, ${row.loose} loose` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Weekly search" icon={SearchIcon}>
        <div className="grid gap-4">
          <Field label="Select week">
            <select
              className="input"
              value={searchWeek}
              onChange={(e) => setSearchWeek(e.target.value)}
            >
              <option value="">-- Select a week --</option>
              {allWeeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </Field>

          {weeklyData ? (
            <div className="grid gap-4">
              <div className="soft-panel grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Week</p>
                  <p className="text-lg font-black">{weeklyData.weekId}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Total eggs</p>
                  <p className="text-lg font-black">{weeklyData.totalEggs}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Good eggs</p>
                  <p className="text-lg font-black">{weeklyData.goodEggs}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Laying %</p>
                  <p className="text-lg font-black">{weeklyData.layingPercentage}%</p>
                </div>
              </div>

              {weeklyData.vaccines.length > 0 && (
                <div className="soft-panel p-4">
                  <p className="text-sm font-black text-[var(--olive)] mb-2">Vaccines this week</p>
                  {weeklyData.vaccines.map((v) => (
                    <p key={v.id} className="text-sm font-semibold">{v.date}: {v.notes}</p>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                      <th className="py-2">Day</th>
                      <th>Date</th>
                      <th>Eggs</th>
                      <th>Cracked</th>
                      <th>Feed kg</th>
                      <th>Vitamins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.logs.map((log) => (
                      <tr key={log.id} className="border-b border-[var(--line)]">
                        <td className="py-2 font-bold capitalize">{getDayName(log.date)}</td>
                        <td>{log.date}</td>
                        <td>{log.totalEggs}</td>
                        <td>{log.crackedEggs}</td>
                        <td>{log.feedConsumedKg || "-"}</td>
                        <td className="text-xs">
                          {log.vitaminInWater && `W:${log.vitaminInWater} `}
                          {log.vitaminInFeed && `F:${log.vitaminInFeed}`}
                          {!log.vitaminInWater && !log.vitaminInFeed ? "-" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="soft-panel p-4">
                <p className="text-sm font-black text-[var(--olive)] mb-2">Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div>Avg eggs/day: <strong>{weeklyData.avgDailyEggs}</strong></div>
                  <div>Feed consumed: <strong>{weeklyData.feedConsumed} kg</strong></div>
                  <div>Revenue: <strong>{formatCop(weeklyData.totalRevenue)}</strong></div>
                  <div>Laying: <strong>{weeklyData.layingPercentage}%</strong></div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Recent egg logs" icon={ClipboardList}>
        <div className="grid gap-3">
          {state.eggLogs
            .slice(-7)
            .reverse()
            .map((log) => (
              <div key={log.id} className="soft-panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{log.date} - <span className="capitalize">{getDayName(log.date)}</span></p>
                  <p className="text-sm font-bold text-[var(--muted)]">
                    {log.synced ? "Saved" : "Offline"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Eggs: {log.totalEggs} • Cracked: {log.crackedEggs}
                  {log.feedConsumedKg > 0 && ` • Feed: ${log.feedConsumedKg}kg`}
                </p>
                {formatEggSizeBreakdown(log.sizeBreakdown) ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {formatEggSizeBreakdown(log.sizeBreakdown)}
                  </p>
                ) : null}
                {(log.vitaminInWater || log.vitaminInFeed) && (
                  <p className="mt-1 text-xs text-[var(--clay)]">
                    {log.vitaminInWater && `💧 ${log.vitaminInWater}`}
                    {log.vitaminInWater && log.vitaminInFeed && " • "}
                    {log.vitaminInFeed && `🍽️ ${log.vitaminInFeed}`}
                  </p>
                )}
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function SearchIcon({ size }: { size?: number }) {
  return (
    <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SalesSection({
  state,
  updateState,
  queueOfflineItem,
  cartonsAvailable,
  chartData,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  cartonsAvailable: number;
  chartData: ReturnType<typeof getSalesChartData>;
}) {
  const [form, setForm] = useState({
    date: todayIso(),
    cartons: 0,
    pricePerCartonCop: 19000,
    customerName: "",
  });
  const total = form.cartons * form.pricePerCartonCop;
  const costPerEggByWeek = useMemo(() => getCostPerEggByWeek(state), [state]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const sale = { id: makeId("sale"), ...form };
    updateState({
      ...state,
      sales: [...state.sales, sale],
      offlineQueue: [...state.offlineQueue, queueOfflineItem("sales", sale)],
    });
    setForm({
      date: todayIso(),
      cartons: 0,
      pricePerCartonCop: 19000,
      customerName: "",
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card title="Record sale" icon={ShoppingCart}>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--olive)]">Cartons ready</p>
                <p className="mt-1 text-4xl font-black">{cartonsAvailable}</p>
                <p className="text-sm font-semibold text-[var(--muted)]">cartons of 30</p>
              </div>
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--olive)]">Today revenue</p>
                <p className="mt-1 break-words text-2xl font-black">{formatCop(total)}</p>
                <p className="text-sm font-semibold text-[var(--muted)]">current sale</p>
              </div>
            </div>
            <Field label="Sale date">
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
            <NumberField
              label="Cartons sold"
              value={form.cartons}
              onChange={(value) => setForm({ ...form, cartons: value })}
            />
            <NumericKeypad
              onDigit={(digit) =>
                setForm({
                  ...form,
                  cartons: Number(`${form.cartons || ""}${digit}`),
                })
              }
              onBackspace={() =>
                setForm({ ...form, cartons: Math.floor(form.cartons / 10) })
              }
              onClear={() => setForm({ ...form, cartons: 0 })}
            />
            <NumberField
              label="Price per carton COP"
              value={form.pricePerCartonCop}
              onChange={(value) => setForm({ ...form, pricePerCartonCop: value })}
            />
            <Field label="Customer name">
              <input
                className="input"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                placeholder="e.g. Cliente A"
              />
            </Field>
            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-[var(--muted)]">Sale total</p>
              <p className="text-3xl font-black">{formatCop(total)}</p>
            </div>
            <button className="primary-button flex h-14 items-center justify-center gap-2 text-base">
              <ReceiptText size={20} />
              Save sale
            </button>
          </form>
        </Card>

        <Card title="Recent sales" icon={Wallet}>
          <div className="grid gap-3">
            {state.sales
              .slice()
              .reverse()
              .map((sale) => {
                const saleWeek = getWeekId(sale.date);
                const costPerEgg = costPerEggByWeek[saleWeek];
                return (
                  <div key={sale.id} className="soft-panel p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-black">
                        {sale.cartons} cartons • {sale.date}
                      </p>
                      <p className="font-black">{formatCop(sale.cartons * sale.pricePerCartonCop)}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {sale.customerName || "No customer"} • {formatCop(sale.pricePerCartonCop)}/carton
                      {costPerEgg !== undefined && (
                        <span className="ml-2">
                          • Cost: {formatCop(costPerEgg)}/egg • Sold: {formatCop(sale.pricePerCartonCop / 30)}/egg
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      <Card title="Sales by weight category" icon={BarChart3}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2">Date</th>
                <th>Customer</th>
                <th>Cartons</th>
                <th>Price/carton</th>
                <th>Price/egg</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {state.sales.slice().reverse().map((sale) => (
                <tr key={sale.id} className="border-b border-[var(--line)]">
                  <td className="py-2">{sale.date}</td>
                  <td>{sale.customerName || "-"}</td>
                  <td>{sale.cartons}</td>
                  <td>{formatCop(sale.pricePerCartonCop)}</td>
                  <td>{formatCop(sale.pricePerCartonCop / 30)}</td>
                  <td className="font-bold">{formatCop(sale.cartons * sale.pricePerCartonCop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Sales revenue trend" icon={BarChart3}>
          <div className="h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip formatter={formatChartTooltipValue} />
                  <Bar dataKey="revenueCop" fill="var(--base-moss)" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty label="No sales recorded yet." />
            )}
          </div>
        </Card>

        <Card title="Cartons sold trend" icon={ShoppingCart}>
          <div className="h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip formatter={formatChartTooltipValue} />
                  <Area type="monotone" dataKey="cartons" stroke="var(--base-clay)" fill="var(--base-harvest)" fillOpacity={0.26} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty label="No carton sales to chart yet." />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function FlockSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
}) {
  const [arrival, setArrival] = useState({
    date: todayIso(),
    quantity: 0,
    breed: "",
    notes: "",
  });
  const [mortality, setMortality] = useState({
    date: todayIso(),
    deaths: 0,
    cause: "",
    notes: "",
  });

  const totalArrivals = state.flockArrivals.reduce((sum, a) => sum + a.quantity, 0);
  const totalDeaths = state.mortalityRecords.reduce((sum, m) => sum + m.deaths, 0);
  const currentBirds = Math.max(totalArrivals - totalDeaths, 0);
  const mortalityPct = totalArrivals > 0 ? Math.round((totalDeaths / totalArrivals) * 100) : 0;

  function submitArrival(event: FormEvent) {
    event.preventDefault();
    if (arrival.quantity <= 0) return;
    updateState({
      ...state,
      flockArrivals: [
        ...state.flockArrivals,
        { id: makeId("arrival"), ...arrival },
      ],
    });
    setArrival({ date: todayIso(), quantity: 0, breed: "", notes: "" });
  }

  function submitMortality(event: FormEvent) {
    event.preventDefault();
    if (mortality.deaths <= 0) return;
    updateState({
      ...state,
      mortalityRecords: [
        ...state.mortalityRecords,
        { id: makeId("mortality"), ...mortality },
      ],
    });
    setMortality({ date: todayIso(), deaths: 0, cause: "", notes: "" });
  }

  return (
    <div className="grid gap-4">
      <section className="floating-card tone-card tone-moss p-5">
        <div className="flex items-center gap-4">
          <Bird className="text-[var(--forest)]" size={32} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--clay)]">
              Flock summary
            </p>
            <h2 className="text-3xl font-black tracking-tight">{currentBirds} birds</h2>
            <p className="text-sm text-[var(--muted)]">
              {totalArrivals} arrived • {totalDeaths} deaths • {mortalityPct}% mortality
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Record arrival" icon={Plus}>
          <form className="grid gap-4" onSubmit={submitArrival}>
            <Field label="Arrival date">
              <input className="input" type="date" value={arrival.date}
                onChange={(e) => setArrival({ ...arrival, date: e.target.value })} />
            </Field>
            <NumberField label="Quantity" value={arrival.quantity}
              onChange={(q) => setArrival({ ...arrival, quantity: q })} />
            <Field label="Breed">
              <input className="input" value={arrival.breed}
                onChange={(e) => setArrival({ ...arrival, breed: e.target.value })}
                placeholder="e.g. Ponedoras" />
            </Field>
            <Field label="Notes">
              <input className="input" value={arrival.notes}
                onChange={(e) => setArrival({ ...arrival, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Save arrival</button>
          </form>
        </Card>

        <Card title="Record mortality" icon={ClipboardList}>
          <form className="grid gap-4" onSubmit={submitMortality}>
            <Field label="Date">
              <input className="input" type="date" value={mortality.date}
                onChange={(e) => setMortality({ ...mortality, date: e.target.value })} />
            </Field>
            <NumberField label="Deaths" value={mortality.deaths}
              onChange={(d) => setMortality({ ...mortality, deaths: d })} />
            <Field label="Cause">
              <input className="input" value={mortality.cause}
                onChange={(e) => setMortality({ ...mortality, cause: e.target.value })}
                placeholder="e.g. Disease, accident" />
            </Field>
            <Field label="Notes">
              <input className="input" value={mortality.notes}
                onChange={(e) => setMortality({ ...mortality, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Record</button>
          </form>
        </Card>
      </div>

      <Card title="Mortality log" icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2">Date</th>
                <th>Deaths</th>
                <th>Cause</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {state.mortalityRecords.slice().reverse().map((m) => (
                <tr key={m.id} className="border-b border-[var(--line)]">
                  <td className="py-2">{m.date}</td>
                  <td className="font-bold text-red-600">{m.deaths}</td>
                  <td>{m.cause || "-"}</td>
                  <td>{m.notes || "-"}</td>
                </tr>
              ))}
              {state.mortalityRecords.length === 0 && (
                <tr><td className="py-4 text-center text-[var(--muted)]" colSpan={4}>No mortality recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Arrivals log" icon={Bird}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2">Date</th>
                <th>Quantity</th>
                <th>Breed</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {state.flockArrivals.slice().reverse().map((a) => (
                <tr key={a.id} className="border-b border-[var(--line)]">
                  <td className="py-2">{a.date}</td>
                  <td className="font-bold">{a.quantity}</td>
                  <td>{a.breed || "-"}</td>
                  <td>{a.notes || "-"}</td>
                </tr>
              ))}
              {state.flockArrivals.length === 0 && (
                <tr><td className="py-4 text-center text-[var(--muted)]" colSpan={4}>No arrivals recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FeedExpenseSection({
  state,
  updateState,
  queueOfflineItem,
  metrics,
  chartData,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  chartData: ReturnType<typeof getFeedChartData>;
}) {
  const [purchase, setPurchase] = useState({
    date: todayIso(),
    feedType: "Layer pellet",
    quantityKg: 0,
    priceCop: 0,
    supplier: "",
  });
  const [usage, setUsage] = useState({
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

  function submitPurchase(event: FormEvent) {
    event.preventDefault();
    const nextPurchase = { id: makeId("feed-purchase"), ...purchase };
    updateState({
      ...state,
      feedPurchases: [...state.feedPurchases, nextPurchase],
      inventoryItems: state.inventoryItems.map((item) =>
        item.id === "inv-feed"
          ? { ...item, quantity: item.quantity + purchase.quantityKg }
          : item,
      ),
    });
    setPurchase({ date: todayIso(), feedType: "Layer pellet", quantityKg: 0, priceCop: 0, supplier: "" });
  }

  function submitUsage(event: FormEvent) {
    event.preventDefault();
    const nextUsage = { id: makeId("feed-use"), ...usage };
    updateState({
      ...state,
      feedUsage: [...state.feedUsage, nextUsage],
      inventoryItems: state.inventoryItems.map((item) =>
        item.id === "inv-feed"
          ? { ...item, quantity: Math.max(item.quantity - usage.quantityKg, 0) }
          : item,
      ),
      offlineQueue: [...state.offlineQueue, queueOfflineItem("feed_usage", nextUsage)],
    });
    setUsage({ date: todayIso(), quantityKg: 0, notes: "" });
  }

  function submitExpense(event: FormEvent) {
    event.preventDefault();
    const nextExpense = { id: makeId("expense"), ...expense };
    updateState({
      ...state,
      expenses: [...state.expenses, nextExpense],
      offlineQueue: [...state.offlineQueue, queueOfflineItem("expenses", nextExpense)],
    });
    setExpense({ date: todayIso(), category: "maintenance", amountCop: 0, description: "" });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Feed purchase" icon={Sprout}>
          <form className="grid gap-4" onSubmit={submitPurchase}>
            <Field label="Date">
              <input className="input" type="date" value={purchase.date}
                onChange={(e) => setPurchase({ ...purchase, date: e.target.value })} />
            </Field>
            <Field label="Feed type">
              <input className="input" value={purchase.feedType}
                onChange={(e) => setPurchase({ ...purchase, feedType: e.target.value })} />
            </Field>
            <NumberField label="Quantity kg" value={purchase.quantityKg}
              onChange={(q) => setPurchase({ ...purchase, quantityKg: q })} />
            <NumberField label="Total price COP" value={purchase.priceCop}
              onChange={(p) => setPurchase({ ...purchase, priceCop: p })} />
            <Field label="Supplier">
              <input className="input" value={purchase.supplier}
                onChange={(e) => setPurchase({ ...purchase, supplier: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Save purchase</button>
          </form>
        </Card>

        <Card title="Feed usage" icon={Package}>
          <form className="grid gap-4" onSubmit={submitUsage}>
            <div className="rounded-3xl bg-[#eef5ef] p-4">
              <p className="text-sm font-bold text-[#496150]">Feed stock</p>
              <p className="text-4xl font-black">{formatNumber(metrics.feedStockKg)} kg</p>
              <p className="text-sm font-semibold text-[#496150]">
                About {metrics.feedDaysRemaining} days remaining
              </p>
            </div>
            <Field label="Date">
              <input className="input" type="date" value={usage.date}
                onChange={(e) => setUsage({ ...usage, date: e.target.value })} />
            </Field>
            <NumberField label="Quantity used kg" value={usage.quantityKg}
              onChange={(q) => setUsage({ ...usage, quantityKg: q })} />
            <Field label="Notes">
              <input className="input" value={usage.notes}
                onChange={(e) => setUsage({ ...usage, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Save usage</button>
          </form>
        </Card>

        <Card title="Other expense" icon={ReceiptText}>
          <form className="grid gap-4" onSubmit={submitExpense}>
            <Field label="Date">
              <input className="input" type="date" value={expense.date}
                onChange={(e) => setExpense({ ...expense, date: e.target.value })} />
            </Field>
            <Field label="Category">
              <select className="input" value={expense.category}
                onChange={(e) => setExpense({ ...expense, category: e.target.value as Expense["category"] })}>
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </Field>
            <NumberField label="Amount COP" value={expense.amountCop}
              onChange={(a) => setExpense({ ...expense, amountCop: a })} />
            <Field label="Description">
              <input className="input" value={expense.description}
                onChange={(e) => setExpense({ ...expense, description: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Save expense</button>
          </form>
        </Card>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Feed kg movement" icon={BarChart3}>
          <div className="h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip formatter={formatChartTooltipValue} />
                  <Bar dataKey="purchasedKg" fill="var(--base-moss)" radius={[12, 12, 0, 0]} />
                  <Bar dataKey="usedKg" fill="var(--base-clay)" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty label="No feed movement recorded yet." />
            )}
          </div>
        </Card>

        <Card title="Feed spend trend" icon={Wallet}>
          <div className="h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip formatter={formatChartTooltipValue} />
                  <Area type="monotone" dataKey="spendCop" stroke="var(--base-harvest)" fill="var(--base-harvest)" fillOpacity={0.28} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty label="No feed spending to chart yet." />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function InventorySection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
}) {
  return (
    <Card title="Inventory" icon={Boxes}>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {state.inventoryItems.map((item) => {
          const low = item.quantity <= item.reorderLevel;

          return (
            <div key={item.id} className={`rounded-3xl border p-4 ${
              low ? "border-[#e0a44d] bg-[#fff7e8]" : "border-[#eadfcb] bg-[#f8f5ed]"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="text-sm font-semibold capitalize text-[#66736b]">{item.category}</p>
                </div>
                {low ? <AlertTriangle className="text-[#bf6b16]" /> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <NumberField label={`Qty ${item.unit}`} value={item.quantity}
                  onChange={(quantity) => updateState({
                    ...state,
                    inventoryItems: state.inventoryItems.map((current) =>
                      current.id === item.id ? { ...current, quantity } : current,
                    ),
                  })} />
                <NumberField label="Low alert" value={item.reorderLevel}
                  onChange={(reorderLevel) => updateState({
                    ...state,
                    inventoryItems: state.inventoryItems.map((current) =>
                      current.id === item.id ? { ...current, reorderLevel } : current,
                    ),
                  })} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HealthSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
}) {
  const [health, setHealth] = useState({
    date: todayIso(),
    type: "sick" as HealthRecord["type"],
    sickBirds: 0,
    deaths: 0,
    notes: "",
  });
  const [task, setTask] = useState({
    title: "",
    dueDate: todayIso(),
    notes: "",
  });

  function submitHealth(event: FormEvent) {
    event.preventDefault();
    const nextHealth = { id: makeId("health"), ...health };
    updateState({
      ...state,
      healthRecords: [...state.healthRecords, nextHealth],
    });
    setHealth({ date: todayIso(), type: "sick", sickBirds: 0, deaths: 0, notes: "" });
  }

  function submitTask(event: FormEvent) {
    event.preventDefault();
    updateState({
      ...state,
      maintenanceTasks: [
        ...state.maintenanceTasks,
        { id: makeId("task"), title: task.title, dueDate: task.dueDate, notes: task.notes, status: "open" },
      ],
    });
    setTask({ title: "", dueDate: todayIso(), notes: "" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Health record" icon={HeartPulse}>
        <form className="grid gap-4" onSubmit={submitHealth}>
          <Field label="Date">
            <input className="input" type="date" value={health.date}
              onChange={(e) => setHealth({ ...health, date: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input" value={health.type}
              onChange={(e) => setHealth({ ...health, type: e.target.value as HealthRecord["type"] })}>
              <option value="sick">Sick birds</option>
              <option value="death">Deaths</option>
              <option value="vaccination">Vaccination</option>
              <option value="medicine">Medicine use</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Sick birds" value={health.sickBirds}
              onChange={(s) => setHealth({ ...health, sickBirds: s })} />
            <NumberField label="Deaths" value={health.deaths}
              onChange={(d) => setHealth({ ...health, deaths: d })} />
          </div>
          <Field label="Notes">
            <textarea className="input min-h-24 py-3" value={health.notes}
              onChange={(e) => setHealth({ ...health, notes: e.target.value })} />
          </Field>
          <button className="primary-button h-13">Save health note</button>
        </form>
      </Card>

      <div className="grid gap-4">
        <Card title="Reminder" icon={Settings}>
          <form className="grid gap-4" onSubmit={submitTask}>
            <Field label="Reminder title">
              <input className="input" value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                placeholder="Cleaning, maintenance, feed buying..." />
            </Field>
            <Field label="Due date">
              <input className="input" type="date" value={task.dueDate}
                onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
            </Field>
            <Field label="Notes">
              <input className="input" value={task.notes}
                onChange={(e) => setTask({ ...task, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Add reminder</button>
          </form>
        </Card>

        <Card title="Open maintenance" icon={ClipboardList}>
          <div className="grid gap-3">
            {state.maintenanceTasks.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[#f8f5ed] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="text-sm text-[#66736b]">Due {item.dueDate}</p>
                  </div>
                  <button className="rounded-xl bg-white px-3 py-2 text-xs font-black"
                    onClick={() => updateState({
                      ...state,
                      maintenanceTasks: state.maintenanceTasks.map((task) =>
                        task.id === item.id ? { ...task, status: task.status === "done" ? "open" : "done" } : task,
                      ),
                    })}>
                    {item.status}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReportsSection({
  state,
  rows,
  metrics,
  onReset,
}: {
  state: FarmState;
  rows: ReturnType<typeof getReportRows>;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  onReset: () => void;
}) {
  function exportCsv() {
    const header = ["date", "eggsCollected", "crackedEggs", "goodEggs", "feedKg",
      "sizeC", "sizeB", "sizeA", "sizeAA", "sizeAAA", "sizeJumbo",
      "sizeTotal", "sizeSummary", "cartonsSold", "salesCop", "expensesCop"];
    const csv = [
      header.join(","),
      ...rows.map((row) => header.map((key) => row[key as keyof typeof row]).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `brianna-egg-report-${todayIso()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Brianna Eggs Farm Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Date: ${todayIso()}`, 14, 28);
    doc.text(`Cartons available: ${metrics.cartonsAvailable}`, 14, 38);
    doc.text(`Monthly sales: ${formatCop(metrics.monthlySales)}`, 14, 48);
    doc.text(`Monthly expenses: ${formatCop(metrics.monthlyExpenses)}`, 14, 58);
    doc.text(`Estimated profit: ${formatCop(metrics.monthlyProfit)}`, 14, 68);
    let y = 84;
    rows.slice(-10).forEach((row) => {
      doc.text(`${row.date}: ${row.goodEggs} good eggs, ${row.cartonsSold} cartons sold, ${formatCop(row.salesCop)} sales`, 14, y);
      y += 8;
    });
    doc.save(`brianna-egg-report-${todayIso()}.pdf`);
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={Egg} label="Eggs available" value={metrics.eggsAvailable} tone="harvest" />
        <MetricCard icon={ShoppingCart} label="Cartons available" value={metrics.cartonsAvailable} tone="clay" />
        <MetricCard icon={Wallet} label="Monthly profit" value={formatCop(metrics.monthlyProfit)} tone="plum" />
      </section>

      <Card title="Reports and exports" icon={Download}>
        <div className="grid gap-3 md:grid-cols-3">
          <button className="primary-button flex h-13 items-center justify-center gap-2" onClick={exportCsv}>
            <Download size={19} /> Export CSV
          </button>
          <button className="terracotta-button flex h-13 items-center justify-center gap-2" onClick={() => void exportPdf()}>
            <Download size={19} /> Export PDF
          </button>
          <button className="secondary-button flex h-13 items-center justify-center gap-2" onClick={onReset}>
            <RefreshCw size={19} /> Start fresh
          </button>
        </div>
      </Card>

      <Card title="Last 14 days" icon={BarChart3}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip />
              <Bar dataKey="goodEggs" fill="var(--base-moss)" radius={[12, 12, 0, 0]} />
              <Bar dataKey="cartonsSold" fill="var(--base-clay)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recent rows" icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-3">Date</th>
                <th>Eggs collected</th>
                <th>Good eggs</th>
                <th>Feed kg</th>
                <th>Sizes</th>
                <th>Sold</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice().reverse().map((row) => (
                <tr key={row.date} className="border-b border-[var(--line)]">
                  <td className="py-3 font-bold">{row.date}</td>
                  <td>{row.eggsCollected}</td>
                  <td>{row.goodEggs}</td>
                  <td>{row.feedKg || "-"}</td>
                  <td>{row.sizeSummary}</td>
                  <td>{row.cartonsSold}</td>
                  <td>{formatCop(row.salesCop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FloatingSideNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}) {
  return (
    <aside className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:left-6">
      <nav className="floating-card grid gap-2 p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;

          return (
            <button key={tab.id}
              className={`grid h-14 w-14 place-items-center rounded-[1.25rem] ${
                selected
                  ? "bg-[var(--base-moss)] text-[var(--foreground)] shadow-lg"
                  : "text-[var(--muted)] hover:bg-[var(--cream)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}>
              <Icon size={21} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function ThemeToggle({
  themeMode,
  setThemeMode,
}: {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}) {
  const nextThemeMode = themeMode === "daylight" ? "nighttime" : "daylight";
  const ToggleIcon = nextThemeMode === "nighttime" ? Moon : Sun;
  const label = `Switch to ${nextThemeMode === "nighttime" ? "night" : "day"} mode`;

  return (
    <button
      className="secondary-button grid h-12 w-12 place-items-center"
      onClick={() => setThemeMode(nextThemeMode)}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={themeMode === "nighttime"}
    >
      <ToggleIcon size={19} />
    </button>
  );
}

function MoreSection({
  state,
  metrics,
  rows,
  moreSection,
  setMoreSection,
  updateState,
  onReset,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  rows: ReturnType<typeof getReportRows>;
  moreSection: MoreSectionKey;
  setMoreSection: (section: MoreSectionKey) => void;
  updateState: (state: FarmState) => void;
  onReset: () => void;
}) {
  const options: { id: MoreSectionKey; label: string; detail: string; icon: React.ComponentType<{ size?: number }>; tone: OrganicTone }[] = [
    { id: "inventory", label: "Inventory", detail: "Feed, medicine, packaging", icon: Boxes, tone: "moss" },
    { id: "health", label: "Health", detail: "Care notes and reminders", icon: HeartPulse, tone: "plum" },
    { id: "reports", label: "Reports", detail: "CSV, PDF, performance", icon: BarChart3, tone: "harvest" },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = moreSection === option.id;
          return (
            <button key={option.id}
              className={`tap-rise premium-card tone-card tone-${option.tone} p-4 text-left ${
                selected ? "ring-2 ring-[var(--sage)]" : ""
              }`}
              onClick={() => setMoreSection(option.id)}>
              <div className="tone-icon mb-4 grid h-11 w-11 place-items-center rounded-[1.1rem]">
                <Icon size={21} />
              </div>
              <p className="text-lg font-black">{option.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--muted)]">{option.detail}</p>
            </button>
          );
        })}
      </section>

      {moreSection === "inventory" ? <InventorySection state={state} updateState={updateState} /> : null}
      {moreSection === "health" ? <HealthSection state={state} updateState={updateState} /> : null}
      {moreSection === "reports" ? <ReportsSection state={state} rows={rows} metrics={metrics} onReset={onReset} /> : null}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return (
    <section className="premium-card p-4 md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-[var(--cream)] text-[var(--olive)]">
          <Icon size={19} />
        </div>
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center rounded-[1.5rem] bg-[var(--card-soft)] p-5 text-center text-sm font-bold text-[var(--muted)]">
      {label}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone = "moss" }: { label: string; value: number | string; icon: React.ComponentType<{ size?: number }>; tone?: OrganicTone }) {
  return (
    <div className={`tap-rise premium-card tone-card tone-${tone} p-4`}>
      <div className="tone-icon mb-3 grid h-10 w-10 place-items-center rounded-[1.1rem]"><Icon size={20} /></div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function MoneyCard({ label, value, positive, tone = "moss" }: { label: string; value: number; positive?: boolean; tone?: OrganicTone }) {
  return (
    <div className={`premium-card tone-card tone-${tone} p-4 ${positive ? "bg-[color-mix(in_srgb,var(--sage),var(--card)_74%)]" : ""}`}>
      <p className="text-sm font-black text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black">{formatCop(value)}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[var(--olive)]">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function LargeNumberField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="tap-rise soft-panel block p-4">
      <span className="block text-sm font-black text-[var(--olive)]">{label}</span>
      <span className="mt-1 block text-xs font-bold text-[var(--muted)]">{hint}</span>
      <input className="mt-4 w-full bg-transparent text-center text-5xl font-black tracking-tight outline-none"
        type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        value={formatNumericInputValue(value)}
        onChange={(e) => onChange(parseNumericInputValue(e.target.value))}
        onFocus={(e) => e.currentTarget.select()} />
    </label>
  );
}

function NumericKeypad({ onDigit, onBackspace, onClear }: { onDigit: (digit: number) => void; onBackspace: () => void; onClear: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
        <button key={digit} type="button" className="secondary-button h-12 text-lg" onClick={() => onDigit(digit)}>{digit}</button>
      ))}
      <button type="button" className="secondary-button h-12 text-sm" onClick={onClear}>Clear</button>
      <button type="button" className="secondary-button h-12 text-lg" onClick={() => onDigit(0)}>0</button>
      <button type="button" className="secondary-button h-12 text-sm" onClick={onBackspace}>Back</button>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        value={formatNumericInputValue(value)}
        onChange={(e) => onChange(parseNumericInputValue(e.target.value))}
        onFocus={(e) => e.currentTarget.select()} />
    </Field>
  );
}

function EggSizeEntry({ category, value, onChange }: { category: EggSizeCategory; value: number; onChange: (value: number) => void }) {
  return (
    <label className="egg-size-card">
      <span className="egg-size-visual">
        <span className={`egg-size-egg size-${category.toLowerCase()}`} aria-hidden="true" />
        <span className="egg-size-label">{category}</span>
      </span>
      <span className="egg-size-field-label">eggs</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        value={formatNumericInputValue(value)}
        onChange={(e) => onChange(parseNumericInputValue(e.target.value))}
        onFocus={(e) => e.currentTarget.select()} />
    </label>
  );
}

function MiniTotal({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7b837e]">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
