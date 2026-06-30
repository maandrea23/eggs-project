"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeftRight,
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
  Leaf,
  LogOut,
  Moon,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingCart,
  Sprout,
  Sun,
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
import { createFreshFarmState } from "@/lib/demo-data";
import { loadFarmState, resetFarmState, saveFarmState } from "@/lib/local-store";
import type {
  Coop,
  Expense,
  FarmState,
  HealthRecord,
  OfflineQueueItem,
} from "@/lib/types";

type TabKey =
  | "dashboard"
  | "coops"
  | "eggs"
  | "sales"
  | "expenses"
  | "more";

type MoreSectionKey = "inventory" | "health" | "reports";

type UserMode = "guest";
type OrganicTone = "moss" | "harvest" | "clay" | "plum";
type ThemeMode = "daylight" | "nighttime";
type DatabaseStatus = "checking" | "ready" | "local";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const nowIso = () => new Date().toISOString();
const THEME_KEY = "brianna-egg-theme-mode";
const makeId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;

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

const tabs: { id: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] =
  [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "eggs", label: "Eggs", icon: Egg },
    { id: "coops", label: "Coops", icon: Bird },
    { id: "sales", label: "Sales", icon: ShoppingCart },
    { id: "expenses", label: "Expenses", icon: ReceiptText },
    { id: "more", label: "More", icon: Ellipsis },
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

export default function FarmApp() {
  const [state, setState] = useState<FarmState>(() => createFreshFarmState());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [moreSection, setMoreSection] = useState<MoreSectionKey>("inventory");
  const [userMode, setUserMode] = useState<UserMode | null>(null);
  const [authEmail, setAuthEmail] = useState("owner@brianna-eggs.test");
  const [authPassword, setAuthPassword] = useState("demo-password");
  const [authMessage, setAuthMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("daylight");
  const [databaseStatus, setDatabaseStatus] =
    useState<DatabaseStatus>("checking");

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(THEME_KEY);

      if (savedTheme === "daylight" || savedTheme === "nighttime") {
        setThemeMode(savedTheme);
        document.documentElement.dataset.theme = savedTheme;
      } else {
        document.documentElement.dataset.theme = "daylight";
      }

      const localState = loadFarmState();
      setState(localState);
      setLoaded(true);
      setOnline(navigator.onLine);

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
          } else {
            void saveFarmStateToDailey(localState);
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

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  const metrics = useMemo(() => calculateFarmMetrics(state), [state]);
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const eggChartData = useMemo(() => getEggChartData(state), [state]);
  const reportRows = useMemo(() => getReportRows(state), [state]);

  function updateState(next: FarmState) {
    setState(next);
    saveFarmState(next);

    if (!navigator.onLine) {
      setDatabaseStatus("local");
      return;
    }

    void saveFarmStateToDailey(next)
      .then(() => {
        setDatabaseStatus("ready");
      })
      .catch((error) => {
        setDatabaseStatus("local");
        setAuthMessage(
          error instanceof Error
            ? `Dailey sync paused: ${error.message}`
            : "Dailey sync paused. Local offline storage is still active.",
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

  function handleDemoLogin() {
    setUserMode("guest");
    setAuthMessage(
      databaseStatus === "ready"
        ? "Owner mode active. Data saves on this device and syncs to Dailey."
        : "Owner mode active. Data saves on this device until Dailey is connected.",
    );
  }

  async function syncOfflineQueue() {
    if (!online) {
      return;
    }

    setSyncing(true);

    try {
      await saveFarmStateToDailey(state);
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? `Dailey sync failed: ${error.message}`
          : "Dailey sync failed. Local offline storage is still active.",
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
    setAuthMessage("Offline entries synced to the Dailey database.");
    setDatabaseStatus("ready");
    setSyncing(false);
  }

  function handleResetDemoData() {
    updateState(resetFarmState());
    setActiveTab("dashboard");
    setAuthMessage("Fresh real-data workspace ready. Old demo entries are cleared.");
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
            <div className="tone-card tone-moss mb-5 rounded-[1.6rem] p-5 text-[var(--foreground)]">
              <Leaf className="mb-4 text-[var(--forest)]" size={28} />
              <h2 className="text-2xl font-black">Healthy animals. Healthy food.</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                A calm daily workspace for eggs, feed, sales, and the rhythm of
                the farm.
              </p>
            </div>
            <h2 className="text-xl font-black">Welcome back</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Use owner mode for now. Dailey database sync runs in the
              deployed app, while this device keeps an offline copy.
            </p>

            <label className="mt-5 block text-sm font-black">Email</label>
            <input
              className="input mt-2"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              type="email"
            />

            <label className="mt-4 block text-sm font-black">Password</label>
            <input
              className="input mt-2"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              type="password"
            />

            {authMessage ? (
              <p className="soft-panel mt-4 p-3 text-sm font-bold text-[var(--clay)]">
                {authMessage}
              </p>
            ) : null}

            <div className="mt-5 grid gap-3">
              <button
                className="primary-button flex h-14 items-center justify-center gap-2 px-4 text-base"
                onClick={handleDemoLogin}
              >
                <Home size={20} />
                Owner Mode
              </button>
            </div>

            <div className="soft-panel mt-5 flex items-center gap-2 p-3 text-sm font-bold text-[var(--olive)]">
              {databaseStatus === "ready" ? (
                <Cloud size={18} />
              ) : (
                <CloudOff size={18} />
              )}
              {databaseStatus === "checking"
                ? "Checking Dailey database..."
                : databaseStatus === "ready"
                  ? "Dailey database connected."
                  : "Local offline storage active."}
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
                Healthy animals, steady production, calm business.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
              <button
                className="secondary-button grid h-12 w-12 place-items-center"
                onClick={() => void syncOfflineQueue()}
                title="Sync offline queue"
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
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

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

          {activeTab === "dashboard" ? (
            <DashboardSection
              state={state}
              metrics={metrics}
              alerts={alerts}
              insights={insights}
              chartData={eggChartData}
              onQuickEgg={() => setActiveTab("eggs")}
            />
          ) : null}
          {activeTab === "eggs" ? (
            <EggLoggingSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
              online={online}
            />
          ) : null}
          {activeTab === "sales" ? (
            <SalesSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
              cartonsAvailable={metrics.cartonsAvailable}
            />
          ) : null}
          {activeTab === "coops" ? (
            <CoopSection state={state} updateState={updateState} />
          ) : null}
          {activeTab === "expenses" ? (
            <FeedExpenseSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
              metrics={metrics}
            />
          ) : null}
          {activeTab === "more" ? (
            <MoreSection
              state={state}
              metrics={metrics}
              rows={reportRows}
              moreSection={moreSection}
              setMoreSection={setMoreSection}
              updateState={updateState}
              onReset={handleResetDemoData}
            />
          ) : null}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden">
        <div className="floating-card grid grid-cols-6 gap-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[10px] font-black ${
                  selected
                    ? "bg-[var(--base-moss)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={19} />
                {tab.label}
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
        {queueCount} unsynced item{queueCount === 1 ? "" : "s"}
      </div>
      <div className="flex items-center gap-2">
        <Settings size={18} />
        {databaseStatus === "ready"
          ? "Dailey database ready"
          : databaseStatus === "checking"
            ? "Checking Dailey database"
            : "Local offline storage"}
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
              Today feels steady
            </p>
            <h2 className="mt-3 max-w-lg text-4xl font-black tracking-tight md:text-6xl">
              {metrics.eggsToday || "Ready"} eggs collected today.
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              {metrics.cartonsAvailable} cartons ready, {metrics.looseEggs}{" "}
              loose eggs, and {formatNumber(metrics.feedStockKg)} kg of feed in
              stock.
            </p>
          </div>
          <div className="organic-illustration hidden h-28 w-28 shrink-0 place-items-center rounded-[2rem] md:grid">
            <Egg className="text-[var(--forest)]" size={50} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="flex h-13 shrink-0 items-center gap-2 rounded-full bg-[var(--mustard)] px-5 text-sm font-black text-[#263429]"
            onClick={onQuickEgg}
          >
            <Plus size={19} />
            Log eggs
          </button>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            {formatCop(metrics.monthlyProfit)} profit this month
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          icon={Egg}
          label="Today's Eggs"
          value={metrics.eggsToday}
          tone="harvest"
        />
        <MetricCard
          icon={ShoppingCart}
          label="Cartons Ready"
          value={metrics.cartonsAvailable}
          tone="clay"
        />
        <MetricCard
          icon={Sprout}
          label="Feed Remaining"
          value={`${formatNumber(metrics.feedStockKg)} kg`}
          tone="moss"
        />
        <MetricCard
          icon={Wallet}
          label="Monthly Profit"
          value={formatCop(metrics.monthlyProfit)}
          tone="plum"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MoneyCard
          label="Monthly sales"
          value={metrics.monthlySales}
          tone="moss"
          positive
        />
        <MoneyCard
          label="Monthly expenses"
          value={metrics.monthlyExpenses}
          tone="clay"
        />
        <MoneyCard
          label="Feed cost / carton"
          value={metrics.feedCostPerCarton}
          tone="harvest"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Egg production by coop" icon={BarChart3}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 8" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="Coop 1"
                  stroke="var(--base-moss)"
                  fill="var(--base-moss)"
                  fillOpacity={0.28}
                />
                <Area
                  type="monotone"
                  dataKey="Coop 2"
                  stroke="var(--base-clay)"
                  fill="var(--base-harvest)"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Birds per coop" icon={Bird}>
          <div className="grid gap-3">
            {state.coops.map((coop) => (
              <div key={coop.id} className="soft-panel flex items-center gap-4 p-4">
                <ProgressRing
                  value={Math.min(
                    ((coop.hens + coop.chicks) / coop.capacity) * 100,
                    100,
                  )}
                  label={`${coop.hens + coop.chicks}`}
                  tone={coop.id === "coop-1" ? "moss" : "clay"}
                />
                <div>
                  <p className="font-black">{coop.name}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                    {coop.hens} hens • {coop.capacity} capacity
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Alerts" icon={AlertTriangle}>
          <div className="grid gap-3">
            {alerts.length ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="soft-panel p-4"
                >
                  <p className="font-black">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {alert.detail}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#66736b]">
                No urgent alerts today.
              </p>
            )}
          </div>
        </Card>

        <Card title="Smart insights" icon={ClipboardList}>
          <div className="grid gap-3">
            {insights.slice(0, 4).map((insight) => (
              <div key={insight.id} className="soft-panel p-4">
                <p className="text-sm font-black">{insight.title}</p>
                <p className="mt-1 text-xl font-black">{insight.value}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{insight.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function EggLoggingSection({
  state,
  updateState,
  queueOfflineItem,
  online,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  online: boolean;
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
  const loose = goodEggs % 30;

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
      coop1Eggs: 0,
      coop2Eggs: 0,
      crackedEggs: 0,
      notes: "",
    });
  }

  return (
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
          <div className="grid grid-cols-2 gap-3">
            <LargeNumberField
              label="Coop One"
              hint="Collected eggs"
              value={form.coop1Eggs}
              onChange={(value) => setForm({ ...form, coop1Eggs: value })}
            />
            <LargeNumberField
              label="Coop Two"
              hint="Collected eggs"
              value={form.coop2Eggs}
              onChange={(value) => setForm({ ...form, coop2Eggs: value })}
            />
          </div>
          <NumberField
            label="Cracked or damaged"
            value={form.crackedEggs}
            onChange={(value) => setForm({ ...form, crackedEggs: value })}
          />
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
          <div className="soft-panel grid grid-cols-3 gap-2 p-3 text-center">
            <MiniTotal label="Total" value={totalEggs} />
            <MiniTotal label="Cartons" value={cartons} />
            <MiniTotal label="Loose" value={loose} />
          </div>
          <button className="primary-button flex h-14 items-center justify-center gap-2 text-base">
            <Save size={20} />
            Save egg log
          </button>
        </form>
      </Card>

      <Card title="Recent egg logs" icon={ClipboardList}>
        <div className="grid gap-3">
          {state.eggLogs
            .slice(-7)
            .reverse()
            .map((log) => (
              <div key={log.id} className="soft-panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{log.date}</p>
                  <p className="text-sm font-bold text-[var(--muted)]">
                    {log.synced ? "Saved" : "Offline"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Coop 1: {log.coop1Eggs} • Coop 2: {log.coop2Eggs} • Cracked:{" "}
                  {log.crackedEggs}
                </p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function SalesSection({
  state,
  updateState,
  queueOfflineItem,
  cartonsAvailable,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  cartonsAvailable: number;
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
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card title="Record sale" icon={ShoppingCart}>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-[var(--olive)]">Cartons ready</p>
              <p className="mt-1 text-4xl font-black">{cartonsAvailable}</p>
              <p className="text-sm font-semibold text-[var(--muted)]">
                cartons of 30
              </p>
            </div>
            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-[var(--olive)]">Today revenue</p>
              <p className="mt-1 break-words text-2xl font-black">
                {formatCop(total)}
              </p>
              <p className="text-sm font-semibold text-[var(--muted)]">
                current sale
              </p>
            </div>
          </div>
          <Field label="Sale date">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
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
              setForm({
                ...form,
                cartons: Math.floor(form.cartons / 10),
              })
            }
            onClear={() => setForm({ ...form, cartons: 0 })}
          />
          <NumberField
            label="Price per carton COP"
            value={form.pricePerCartonCop}
            onChange={(value) =>
              setForm({ ...form, pricePerCartonCop: value })
            }
          />
          <Field label="Customer name">
            <input
              className="input"
              value={form.customerName}
              onChange={(event) =>
                setForm({ ...form, customerName: event.target.value })
              }
              placeholder="Optional"
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
            .map((sale) => (
              <div key={sale.id} className="soft-panel p-4">
                <div className="flex items-center justify-between">
                  <p className="font-black">
                    {sale.cartons} cartons • {sale.date}
                  </p>
                  <p className="font-black">
                    {formatCop(sale.cartons * sale.pricePerCartonCop)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {sale.customerName || "No customer name"} •{" "}
                  {formatCop(sale.pricePerCartonCop)} each
                </p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function CoopSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
}) {
  const [move, setMove] = useState({
    from: "coop-1",
    to: "coop-2",
    quantity: 0,
  });
  const [birdAction, setBirdAction] = useState({
    coopId: "coop-1",
    type: "new_birds" as "new_birds" | "death" | "removal",
    quantity: 0,
    notes: "",
  });

  function updateCoop(coopId: string, patch: Partial<Coop>) {
    updateState({
      ...state,
      coops: state.coops.map((coop) =>
        coop.id === coopId ? { ...coop, ...patch } : coop,
      ),
    });
  }

  function moveBirds(event: FormEvent) {
    event.preventDefault();
    if (move.from === move.to || move.quantity <= 0) return;

    updateState({
      ...state,
      coops: state.coops.map((coop) => {
        if (coop.id === move.from) {
          return { ...coop, hens: Math.max(coop.hens - move.quantity, 0) };
        }
        if (coop.id === move.to) {
          return { ...coop, hens: coop.hens + move.quantity };
        }
        return coop;
      }),
      birdMovements: [
        ...state.birdMovements,
        {
          id: makeId("move"),
          date: todayIso(),
          coopId: move.from,
          type: "transfer_out",
          quantity: move.quantity,
          notes: `Moved to ${state.coops.find((coop) => coop.id === move.to)?.name}`,
        },
        {
          id: makeId("move"),
          date: todayIso(),
          coopId: move.to,
          type: "transfer_in",
          quantity: move.quantity,
          notes: `Moved from ${state.coops.find((coop) => coop.id === move.from)?.name}`,
        },
      ],
    });
    setMove({ ...move, quantity: 0 });
  }

  function recordBirdAction(event: FormEvent) {
    event.preventDefault();
    if (birdAction.quantity <= 0) return;

    const sign = birdAction.type === "new_birds" ? 1 : -1;
    updateState({
      ...state,
      coops: state.coops.map((coop) =>
        coop.id === birdAction.coopId
          ? {
              ...coop,
              hens: Math.max(coop.hens + sign * birdAction.quantity, 0),
            }
          : coop,
      ),
      birdMovements: [
        ...state.birdMovements,
        {
          id: makeId("bird"),
          date: todayIso(),
          coopId: birdAction.coopId,
          type: birdAction.type,
          quantity: birdAction.quantity,
          notes: birdAction.notes,
        },
      ],
    });
    setBirdAction({ ...birdAction, quantity: 0, notes: "" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Coop management" icon={Bird}>
        <div className="grid gap-4">
          {state.coops.map((coop) => (
            <div key={coop.id} className="rounded-3xl bg-[#f8f5ed] p-4">
              <div className="grid gap-3">
                <Field label="Coop name">
                  <input
                    className="input"
                    value={coop.name}
                    onChange={(event) =>
                      updateCoop(coop.id, { name: event.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    label="Capacity"
                    value={coop.capacity}
                    onChange={(value) => updateCoop(coop.id, { capacity: value })}
                  />
                  <NumberField
                    label="Hens"
                    value={coop.hens}
                    onChange={(value) => updateCoop(coop.id, { hens: value })}
                  />
                  <NumberField
                    label="Chicks"
                    value={coop.chicks}
                    onChange={(value) => updateCoop(coop.id, { chicks: value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4">
        <Card title="Move birds" icon={ArrowLeftRight}>
          <form className="grid gap-4" onSubmit={moveBirds}>
            <div className="grid grid-cols-2 gap-3">
              <CoopSelect
                label="From"
                coops={state.coops}
                value={move.from}
                onChange={(from) => setMove({ ...move, from })}
              />
              <CoopSelect
                label="To"
                coops={state.coops}
                value={move.to}
                onChange={(to) => setMove({ ...move, to })}
              />
            </div>
            <NumberField
              label="Number of birds"
              value={move.quantity}
              onChange={(quantity) => setMove({ ...move, quantity })}
            />
            <button className="primary-button h-13">
              Move birds
            </button>
          </form>
        </Card>

        <Card title="Deaths, removals, new birds" icon={ClipboardList}>
          <form className="grid gap-4" onSubmit={recordBirdAction}>
            <CoopSelect
              label="Coop"
              coops={state.coops}
              value={birdAction.coopId}
              onChange={(coopId) => setBirdAction({ ...birdAction, coopId })}
            />
            <Field label="Action">
              <select
                className="input"
                value={birdAction.type}
                onChange={(event) =>
                  setBirdAction({
                    ...birdAction,
                    type: event.target.value as typeof birdAction.type,
                  })
                }
              >
                <option value="new_birds">New birds</option>
                <option value="death">Deaths</option>
                <option value="removal">Removals</option>
              </select>
            </Field>
            <NumberField
              label="Quantity"
              value={birdAction.quantity}
              onChange={(quantity) => setBirdAction({ ...birdAction, quantity })}
            />
            <Field label="Notes">
              <input
                className="input"
                value={birdAction.notes}
                onChange={(event) =>
                  setBirdAction({ ...birdAction, notes: event.target.value })
                }
              />
            </Field>
            <button className="primary-button h-13">
              Record change
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function FeedExpenseSection({
  state,
  updateState,
  queueOfflineItem,
  metrics,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  metrics: ReturnType<typeof calculateFarmMetrics>;
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
    setPurchase({
      date: todayIso(),
      feedType: "Layer pellet",
      quantityKg: 0,
      priceCop: 0,
      supplier: "",
    });
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
      offlineQueue: [
        ...state.offlineQueue,
        queueOfflineItem("feed_usage", nextUsage),
      ],
    });
    setUsage({ date: todayIso(), quantityKg: 0, notes: "" });
  }

  function submitExpense(event: FormEvent) {
    event.preventDefault();
    const nextExpense = { id: makeId("expense"), ...expense };
    updateState({
      ...state,
      expenses: [...state.expenses, nextExpense],
      offlineQueue: [
        ...state.offlineQueue,
        queueOfflineItem("expenses", nextExpense),
      ],
    });
    setExpense({
      date: todayIso(),
      category: "maintenance",
      amountCop: 0,
      description: "",
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Feed purchase" icon={Sprout}>
        <form className="grid gap-4" onSubmit={submitPurchase}>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={purchase.date}
              onChange={(event) =>
                setPurchase({ ...purchase, date: event.target.value })
              }
            />
          </Field>
          <Field label="Feed type">
            <input
              className="input"
              value={purchase.feedType}
              onChange={(event) =>
                setPurchase({ ...purchase, feedType: event.target.value })
              }
            />
          </Field>
          <NumberField
            label="Quantity kg"
            value={purchase.quantityKg}
            onChange={(quantityKg) => setPurchase({ ...purchase, quantityKg })}
          />
          <NumberField
            label="Total price COP"
            value={purchase.priceCop}
            onChange={(priceCop) => setPurchase({ ...purchase, priceCop })}
          />
          <Field label="Supplier">
            <input
              className="input"
              value={purchase.supplier}
              onChange={(event) =>
                setPurchase({ ...purchase, supplier: event.target.value })
              }
            />
          </Field>
          <button className="primary-button h-13">
            Save purchase
          </button>
        </form>
      </Card>

      <Card title="Feed usage" icon={Package}>
        <form className="grid gap-4" onSubmit={submitUsage}>
          <div className="rounded-3xl bg-[#eef5ef] p-4">
            <p className="text-sm font-bold text-[#496150]">Feed stock</p>
            <p className="text-4xl font-black">
              {formatNumber(metrics.feedStockKg)} kg
            </p>
            <p className="text-sm font-semibold text-[#496150]">
              About {metrics.feedDaysRemaining} days remaining
            </p>
          </div>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={usage.date}
              onChange={(event) =>
                setUsage({ ...usage, date: event.target.value })
              }
            />
          </Field>
          <NumberField
            label="Quantity used kg"
            value={usage.quantityKg}
            onChange={(quantityKg) => setUsage({ ...usage, quantityKg })}
          />
          <Field label="Notes">
            <input
              className="input"
              value={usage.notes}
              onChange={(event) =>
                setUsage({ ...usage, notes: event.target.value })
              }
            />
          </Field>
          <button className="primary-button h-13">
            Save usage
          </button>
        </form>
      </Card>

      <Card title="Other expense" icon={ReceiptText}>
        <form className="grid gap-4" onSubmit={submitExpense}>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={expense.date}
              onChange={(event) =>
                setExpense({ ...expense, date: event.target.value })
              }
            />
          </Field>
          <Field label="Category">
            <select
              className="input"
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
          </Field>
          <NumberField
            label="Amount COP"
            value={expense.amountCop}
            onChange={(amountCop) => setExpense({ ...expense, amountCop })}
          />
          <Field label="Description">
            <input
              className="input"
              value={expense.description}
              onChange={(event) =>
                setExpense({ ...expense, description: event.target.value })
              }
            />
          </Field>
          <button className="primary-button h-13">
            Save expense
          </button>
        </form>
      </Card>
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
            <div
              key={item.id}
              className={`rounded-3xl border p-4 ${
                low
                  ? "border-[#e0a44d] bg-[#fff7e8]"
                  : "border-[#eadfcb] bg-[#f8f5ed]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="text-sm font-semibold capitalize text-[#66736b]">
                    {item.category}
                  </p>
                </div>
                {low ? <AlertTriangle className="text-[#bf6b16]" /> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <NumberField
                  label={`Qty ${item.unit}`}
                  value={item.quantity}
                  onChange={(quantity) =>
                    updateState({
                      ...state,
                      inventoryItems: state.inventoryItems.map((current) =>
                        current.id === item.id
                          ? { ...current, quantity }
                          : current,
                      ),
                    })
                  }
                />
                <NumberField
                  label="Low alert"
                  value={item.reorderLevel}
                  onChange={(reorderLevel) =>
                    updateState({
                      ...state,
                      inventoryItems: state.inventoryItems.map((current) =>
                        current.id === item.id
                          ? { ...current, reorderLevel }
                          : current,
                      ),
                    })
                  }
                />
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
    coopId: "coop-1",
    type: "sick" as HealthRecord["type"],
    sickBirds: 0,
    deaths: 0,
    notes: "",
  });
  const [task, setTask] = useState({
    title: "",
    dueDate: todayIso(),
    coopId: "",
    notes: "",
  });

  function submitHealth(event: FormEvent) {
    event.preventDefault();
    const nextHealth = { id: makeId("health"), ...health };
    updateState({
      ...state,
      healthRecords: [...state.healthRecords, nextHealth],
    });
    setHealth({
      date: todayIso(),
      coopId: "coop-1",
      type: "sick",
      sickBirds: 0,
      deaths: 0,
      notes: "",
    });
  }

  function submitTask(event: FormEvent) {
    event.preventDefault();
    updateState({
      ...state,
      maintenanceTasks: [
        ...state.maintenanceTasks,
        {
          id: makeId("task"),
          title: task.title,
          dueDate: task.dueDate,
          coopId: task.coopId || undefined,
          notes: task.notes,
          status: "open",
        },
      ],
    });
    setTask({ title: "", dueDate: todayIso(), coopId: "", notes: "" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Health record" icon={HeartPulse}>
        <form className="grid gap-4" onSubmit={submitHealth}>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={health.date}
              onChange={(event) =>
                setHealth({ ...health, date: event.target.value })
              }
            />
          </Field>
          <CoopSelect
            label="Coop"
            coops={state.coops}
            value={health.coopId}
            onChange={(coopId) => setHealth({ ...health, coopId })}
          />
          <Field label="Type">
            <select
              className="input"
              value={health.type}
              onChange={(event) =>
                setHealth({
                  ...health,
                  type: event.target.value as HealthRecord["type"],
                })
              }
            >
              <option value="sick">Sick birds</option>
              <option value="death">Deaths</option>
              <option value="vaccination">Vaccination</option>
              <option value="medicine">Medicine use</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Sick birds"
              value={health.sickBirds}
              onChange={(sickBirds) => setHealth({ ...health, sickBirds })}
            />
            <NumberField
              label="Deaths"
              value={health.deaths}
              onChange={(deaths) => setHealth({ ...health, deaths })}
            />
          </div>
          <Field label="Notes">
            <textarea
              className="input min-h-24 py-3"
              value={health.notes}
              onChange={(event) =>
                setHealth({ ...health, notes: event.target.value })
              }
            />
          </Field>
          <button className="primary-button h-13">
            Save health note
          </button>
        </form>
      </Card>

      <div className="grid gap-4">
        <Card title="Reminder" icon={Settings}>
          <form className="grid gap-4" onSubmit={submitTask}>
            <Field label="Reminder title">
              <input
                className="input"
                value={task.title}
                onChange={(event) =>
                  setTask({ ...task, title: event.target.value })
                }
                placeholder="Cleaning, maintenance, feed buying..."
              />
            </Field>
            <Field label="Due date">
              <input
                className="input"
                type="date"
                value={task.dueDate}
                onChange={(event) =>
                  setTask({ ...task, dueDate: event.target.value })
                }
              />
            </Field>
            <CoopSelect
              label="Coop"
              coops={[{ id: "", name: "Whole farm", capacity: 0, hens: 0, chicks: 0 }, ...state.coops]}
              value={task.coopId}
              onChange={(coopId) => setTask({ ...task, coopId })}
            />
            <Field label="Notes">
              <input
                className="input"
                value={task.notes}
                onChange={(event) =>
                  setTask({ ...task, notes: event.target.value })
                }
              />
            </Field>
            <button className="primary-button h-13">
              Add reminder
            </button>
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
                  <button
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black"
                    onClick={() =>
                      updateState({
                        ...state,
                        maintenanceTasks: state.maintenanceTasks.map((task) =>
                          task.id === item.id
                            ? {
                                ...task,
                                status: task.status === "done" ? "open" : "done",
                              }
                            : task,
                        ),
                      })
                    }
                  >
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
    const header = [
      "date",
      "coop1Eggs",
      "coop2Eggs",
      "crackedEggs",
      "goodEggs",
      "cartonsSold",
      "salesCop",
      "expensesCop",
    ];
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
      doc.text(
        `${row.date}: ${row.goodEggs} good eggs, ${row.cartonsSold} cartons sold, ${formatCop(row.salesCop)} sales`,
        14,
        y,
      );
      y += 8;
    });

    doc.save(`brianna-egg-report-${todayIso()}.pdf`);
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={Egg}
          label="Eggs available"
          value={metrics.eggsAvailable}
          tone="harvest"
        />
        <MetricCard
          icon={ShoppingCart}
          label="Cartons available"
          value={metrics.cartonsAvailable}
          tone="clay"
        />
        <MetricCard
          icon={Wallet}
          label="Monthly profit"
          value={formatCop(metrics.monthlyProfit)}
          tone="plum"
        />
      </section>

      <Card title="Reports and exports" icon={Download}>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            className="primary-button flex h-13 items-center justify-center gap-2"
            onClick={exportCsv}
          >
            <Download size={19} />
            Export CSV
          </button>
          <button
            className="terracotta-button flex h-13 items-center justify-center gap-2"
            onClick={() => void exportPdf()}
          >
            <Download size={19} />
            Export PDF
          </button>
          <button
            className="secondary-button flex h-13 items-center justify-center gap-2"
            onClick={onReset}
          >
            <RefreshCw size={19} />
            Start fresh
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
                <th>Coop 1</th>
                <th>Coop 2</th>
                <th>Good eggs</th>
                <th>Sold</th>
                <th>Sales</th>
                <th>Expenses</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((row) => (
                  <tr key={row.date} className="border-b border-[var(--line)]">
                    <td className="py-3 font-bold">{row.date}</td>
                    <td>{row.coop1Eggs}</td>
                    <td>{row.coop2Eggs}</td>
                    <td>{row.goodEggs}</td>
                    <td>{row.cartonsSold}</td>
                    <td>{formatCop(row.salesCop)}</td>
                    <td>{formatCop(row.expensesCop)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Available report types" icon={ClipboardList}>
        <div className="grid gap-2 text-sm font-semibold text-[var(--muted)] md:grid-cols-2">
          {[
            "Daily egg report",
            "Weekly egg report",
            "Monthly egg report",
            "Monthly sales report",
            "Monthly expense report",
            "Monthly profit/loss report",
            "Feed usage report",
            "Coop performance comparison",
          ].map((label) => (
            <p key={label} className="soft-panel p-3">
              {label}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Current dataset: {state.eggLogs.length} egg logs, {state.sales.length}{" "}
          sales, {state.expenses.length} expenses.
        </p>
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
            <button
              key={tab.id}
              className={`grid h-14 w-14 place-items-center rounded-[1.25rem] ${
                selected
                  ? "bg-[var(--base-moss)] text-[var(--foreground)] shadow-lg"
                  : "text-[var(--muted)] hover:bg-[var(--cream)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
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
  const options: {
    id: ThemeMode;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
  }[] = [
    { id: "daylight", label: "Day", icon: Sun },
    { id: "nighttime", label: "Night", icon: Moon },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-full bg-[color-mix(in_srgb,var(--card),transparent_18%)] p-1 shadow-sm"
      aria-label="Theme mode"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = themeMode === option.id;

        return (
          <button
            key={option.id}
            className={`flex h-10 items-center justify-center gap-1 rounded-full px-3 text-xs font-black ${
              selected
                ? "bg-[var(--base-harvest)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
            onClick={() => setThemeMode(option.id)}
            type="button"
            aria-pressed={selected}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
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
  const options: {
    id: MoreSectionKey;
    label: string;
    detail: string;
    icon: React.ComponentType<{ size?: number }>;
    tone: OrganicTone;
  }[] = [
    {
      id: "inventory",
      label: "Inventory",
      detail: "Feed, medicine, packaging",
      icon: Boxes,
      tone: "moss",
    },
    {
      id: "health",
      label: "Health",
      detail: "Care notes and reminders",
      icon: HeartPulse,
      tone: "plum",
    },
    {
      id: "reports",
      label: "Reports",
      detail: "CSV, PDF, performance",
      icon: BarChart3,
      tone: "harvest",
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = moreSection === option.id;

          return (
            <button
              key={option.id}
              className={`tap-rise premium-card tone-card tone-${option.tone} p-4 text-left ${
                selected ? "ring-2 ring-[var(--sage)]" : ""
              }`}
              onClick={() => setMoreSection(option.id)}
            >
              <div className="tone-icon mb-4 grid h-11 w-11 place-items-center rounded-[1.1rem]">
                <Icon size={21} />
              </div>
              <p className="text-lg font-black">{option.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--muted)]">
                {option.detail}
              </p>
            </button>
          );
        })}
      </section>

      {moreSection === "inventory" ? (
        <InventorySection state={state} updateState={updateState} />
      ) : null}
      {moreSection === "health" ? (
        <HealthSection state={state} updateState={updateState} />
      ) : null}
      {moreSection === "reports" ? (
        <ReportsSection
          state={state}
          rows={rows}
          metrics={metrics}
          onReset={onReset}
        />
      ) : null}
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "moss",
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number }>;
  tone?: OrganicTone;
}) {
  return (
    <div className={`tap-rise premium-card tone-card tone-${tone} p-4`}>
      <div className="tone-icon mb-3 grid h-10 w-10 place-items-center rounded-[1.1rem]">
        <Icon size={20} />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-2xl font-black tracking-tight">
        {value}
      </p>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  positive,
  tone = "moss",
}: {
  label: string;
  value: number;
  positive?: boolean;
  tone?: OrganicTone;
}) {
  return (
    <div
      className={`premium-card tone-card tone-${tone} p-4 ${
        positive ? "bg-[color-mix(in_srgb,var(--sage),var(--card)_74%)]" : ""
      }`}
    >
      <p className="text-sm font-black text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black">{formatCop(value)}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[var(--olive)]">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function LargeNumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="tap-rise soft-panel block p-4">
      <span className="block text-sm font-black text-[var(--olive)]">
        {label}
      </span>
      <span className="mt-1 block text-xs font-bold text-[var(--muted)]">
        {hint}
      </span>
      <input
        className="mt-4 w-full bg-transparent text-center text-5xl font-black tracking-tight outline-none"
        type="number"
        min="0"
        inputMode="numeric"
        value={Number.isNaN(value) ? 0 : value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
}: {
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
        <button
          key={digit}
          type="button"
          className="secondary-button h-12 text-lg"
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button type="button" className="secondary-button h-12 text-sm" onClick={onClear}>
        Clear
      </button>
      <button
        type="button"
        className="secondary-button h-12 text-lg"
        onClick={() => onDigit(0)}
      >
        0
      </button>
      <button
        type="button"
        className="secondary-button h-12 text-sm"
        onClick={onBackspace}
      >
        Back
      </button>
    </div>
  );
}

function ProgressRing({
  value,
  label,
  tone = "moss",
}: {
  value: number;
  label: string;
  tone?: OrganicTone;
}) {
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(value, 100)) / 100) * circumference;

  return (
    <div
      className={`tone-${tone} relative grid h-20 w-20 shrink-0 place-items-center`}
    >
      <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth="9"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--tone)"
          strokeLinecap="round"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-black">{label}</span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        className="input"
        type="number"
        min="0"
        inputMode="numeric"
        value={Number.isNaN(value) ? 0 : value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

function MiniTotal({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7b837e]">
        {label}
      </p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function CoopSelect({
  label,
  coops,
  value,
  onChange,
}: {
  label: string;
  coops: Coop[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {coops.map((coop) => (
          <option key={coop.id} value={coop.id}>
            {coop.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
