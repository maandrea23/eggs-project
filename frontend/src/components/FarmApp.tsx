"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bird,
  Boxes,
  ClipboardList,
  Cloud,
  CloudOff,
  Download,
  Egg,
  Ellipsis,
  Eye,
  EyeOff,
  FileUp,
  HeartPulse,
  Home,
  LockKeyhole,
  LogOut,
  Moon,
  Pencil,
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
  X,
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
  formatWeekRange,
  getEggChartData,
  getEggStockByCategoryData,
  getReportRows,
  getSalesChartData,
  getWeekId,
  getWeekRangeFromId,
  getWeeklyData,
  getAllWeeks,
  getDayName,
  getCostPerEggByWeek,
  getWeeklyEggCostBreakdown,
  normalizeAccountingWeekSettings,
} from "@/lib/calculations";
import {
  EGG_SIZE_ORDER,
  formatEggSizeBreakdown,
  getEggSizeTotal,
  normalizeEggSizeBreakdown,
} from "@/lib/egg-classification";
import { createFreshFarmState } from "@/lib/farm-state-defaults";
import { apiUrl } from "@/lib/api";
import { migrateFarmState } from "@/lib/farm-state-migration";
import { loadFarmState, resetFarmState, saveFarmState } from "@/lib/local-store";
import { csvTemplate, isIsoDate, parseCsv, parseCsvNumber } from "@/lib/csv-import";
import type { ThemeMode } from "@/lib/theme-mode";
import { useThemeMode } from "@/lib/use-theme-mode";
import InvestmentSection from "@/components/InvestmentSection";
import type {
  Expense,
  FarmState,
  HealthRecord,
  InvestmentCategory,
  OfflineQueueItem,
  EggSizeCategory,
  FarmNotification,
  FlockArrival,
  InventoryItem,
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

type MoreSectionKey = "inventory" | "health" | "reports" | "import";

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
  const response = await fetch(apiUrl("/api/farm-state"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "No se pudieron guardar los datos de la granja.");
  }
}

const tabs: { id: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] =
  [
    { id: "dashboard", label: "Inicio", icon: Home },
    { id: "eggs", label: "Huevos", icon: Egg },
    { id: "flock", label: "Aves", icon: Bird },
    { id: "sales", label: "Ventas", icon: ShoppingCart },
    { id: "expenses", label: "Gastos", icon: ReceiptText },
    { id: "investment", label: "Inversión", icon: PiggyBank },
    { id: "more", label: "Más", icon: Ellipsis },
  ];

const expenseCategories = [
  "caretaker", "medicine", "sundays", "maintenance", "administration", "shelves", "transport",
] as const satisfies readonly Expense["category"][];

type ManagedExpenseCategory = (typeof expenseCategories)[number];
type WeeklyExpenseDraft = Record<
  ManagedExpenseCategory,
  { amountCop: number; description: string }
>;

const expenseCategoryLabels: Record<Expense["category"], string> = {
  maintenance: "Mantenimiento",
  medicine: "Medicina",
  vaccines: "Vacunas",
  bedding: "Cama",
  transport: "Transporte",
  labour: "Mano de obra",
  electricity: "Electricidad",
  water: "Agua",
  repairs: "Reparaciones",
  packaging: "Empaques",
  cleaning: "Limpieza",
  caretaker: "Cuidandero",
  sundays: "Dominicales",
  administration: "Administración",
  shelves: "Anaqueles",
};

const inventoryCategoryLabels: Record<InventoryItem["category"], string> = {
  feed: "Alimento",
  medicine: "Medicina",
  vaccines: "Vacunas",
  cleaning: "Limpieza",
  packaging: "Empaques",
};

const chartMetricLabels: Record<string, string> = {
  Eggs: "Huevos",
  Cracked: "Quebrados",
  averageCartonPrice: "Precio promedio por cubeta",
  cartons: "Cubetas",
  eggs: "Huevos en stock",
  orders: "Pedidos",
  purchasedKg: "Kg comprados",
  revenueCop: "Ingresos",
  spendCop: "Gasto en alimento",
  usedKg: "Kg utilizados",
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
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isOwnerPasswordVisible, setIsOwnerPasswordVisible] = useState(false);
  const [ownerLoginPending, setOwnerLoginPending] = useState(false);
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

      fetch(apiUrl("/api/farm-state"))
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Los datos de la granja aún no están listos.");
          }

          return (await response.json()) as { state: FarmState | null };
        })
        .then(({ state: databaseState }) => {
          if (databaseState) {
            const migratedDatabaseState = migrateFarmState(databaseState);
            setState(migratedDatabaseState);
            saveFarmState(migratedDatabaseState);
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

  const operatorTabs: TabKey[] = ["eggs"];
  const allowedTabs = userMode === "operator" ? operatorTabs : tabs.map((t) => t.id);

  const metrics = useMemo(() => calculateFarmMetrics(state), [state]);
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const eggChartData = useMemo(() => getEggChartData(state), [state]);
  const salesChartData = useMemo(() => getSalesChartData(state), [state]);
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
            ? `Se pausó el guardado: ${error.message}`
            : "Se pausó el guardado. Los cambios siguen en este dispositivo.",
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

  async function handleOwnerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");
    setOwnerLoginPending(true);

    try {
      const response = await fetch(apiUrl("/api/auth/owner"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ownerUsername,
          password: ownerPassword,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setAuthMessage(result?.error ?? "No fue posible iniciar sesión como propietario.");
        return;
      }

      setUserMode("owner");
      setActiveTab("dashboard");
      setOwnerPassword("");
    } catch {
      setAuthMessage("No fue posible conectar con el inicio de sesión. Inténtalo de nuevo.");
    } finally {
      setOwnerLoginPending(false);
    }
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
          ? `No se pudo guardar: ${error.message}`
          : "No se pudo guardar. Los cambios siguen en este dispositivo.",
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
    setAuthMessage("Las entradas pendientes se guardaron en los registros.");
    setDatabaseStatus("ready");
    setSyncing(false);
  }

  function handleResetFarmWorkspace() {
    updateState(resetFarmState());
    setActiveTab("dashboard");
    setAuthMessage("El espacio de trabajo de la granja fue reiniciado.");
  }

  if (!loaded) {
    return (
      <main className="app-shell grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <div className="organic-illustration mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[2rem] shadow-lg">
            <Egg className="text-[var(--forest)]" size={38} />
          </div>
          <p className="text-sm font-black tracking-wide text-[var(--muted)]">
            Preparando la granja...
          </p>
        </div>
      </main>
    );
  }

  const defaultTab: TabKey = userMode === "operator" ? "eggs" : "dashboard";
  const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : defaultTab;

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
                Gestor de granja
              </h1>
            </div>
          </div>
          <div className="mb-4 flex justify-end">
            <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
          </div>

          <div className="floating-card p-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--cream)] text-[var(--forest)]">
                <LockKeyhole size={20} />
              </span>
              <div>
                <h2 className="text-lg font-black">Acceso de propietario</h2>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  El acceso completo requiere tus credenciales.
                </p>
              </div>
            </div>
            <form className="grid gap-4" onSubmit={handleOwnerLogin}>
              <Field label="Usuario">
                <input
                  className="input border-2 border-[var(--olive)]"
                  value={ownerUsername}
                  onChange={(event) => setOwnerUsername(event.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Contraseña">
                <div className="relative">
                  <input
                    className="input border-2 border-[var(--olive)] pr-12"
                    type={isOwnerPasswordVisible ? "text" : "password"}
                    value={ownerPassword}
                    onChange={(event) => setOwnerPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    aria-label={isOwnerPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={isOwnerPasswordVisible}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--muted)] transition hover:text-[var(--forest)]"
                    onClick={() => setIsOwnerPasswordVisible((isVisible) => !isVisible)}
                    type="button"
                  >
                    {isOwnerPasswordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </Field>
              <button
                className="primary-button flex h-14 items-center justify-center gap-2 px-4 text-base"
                disabled={ownerLoginPending}
                type="submit"
              >
                <Home size={20} />
                {ownerLoginPending ? "Ingresando..." : "Ingresar como propietario"}
              </button>
            </form>
            <div className="my-5 h-px bg-[var(--line)]" />
            <div className="grid gap-3">
              <p className="text-sm font-bold text-[var(--muted)]">
                ¿Solo vas a recoger huevos?
              </p>
              <button
                className="secondary-button flex h-14 items-center justify-center gap-2 px-4 text-base"
                onClick={handleOperatorLogin}
              >
                <ClipboardList size={20} />
                Modo operador — Solo recoger huevos
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <FloatingSideNav
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        allowedTabs={allowedTabs}
      />
      <div className="mx-auto max-w-6xl pb-28 md:ml-28 md:pb-10 lg:ml-auto">
        <header className="sticky top-0 z-30 px-4 py-4 backdrop-blur md:relative md:z-[70] md:px-6 md:pt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--clay)]">
                Brianna Eggs
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                ¿Cómo está la granja hoy?
              </h1>
              <p className="mt-2 hidden max-w-xl text-sm font-semibold leading-6 text-[var(--muted)] md:block">
                {userMode === "operator"
                  ? "Modo operador: solo recoge y clasifica huevos."
                  : "Animales sanos, producción estable y un negocio tranquilo."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
              {userMode === "owner" ? (
                <NotificationsInbox
                  notifications={state.notifications ?? []}
                  onMarkRead={(notificationId) =>
                    updateState({
                      ...state,
                      notifications: (state.notifications ?? []).map((notification) =>
                        notification.id === notificationId
                          ? { ...notification, readAt: nowIso() }
                          : notification,
                      ),
                    })
                  }
                  onMarkAllRead={() =>
                    updateState({
                      ...state,
                      notifications: (state.notifications ?? []).map((notification) =>
                        notification.readAt
                          ? notification
                          : { ...notification, readAt: nowIso() },
                      ),
                    })
                  }
                />
              ) : null}
              <button
                className="secondary-button grid h-12 w-12 place-items-center"
                onClick={() => void syncOfflineQueue()}
                title="Guardar entradas pendientes"
              >
                <RefreshCw
                  className={syncing ? "animate-spin" : ""}
                  size={19}
                />
              </button>
              <button
                className="secondary-button grid h-12 w-12 place-items-center"
                onClick={() => setUserMode(null)}
                title="Cerrar sesión"
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
              key={`${state.accountingWeekSettings.startDate}-${state.accountingWeekSettings.startWeek}`}
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
            <ExpenseSection
              state={state}
              updateState={updateState}
              queueOfflineItem={queueOfflineItem}
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
                queueOfflineItem={queueOfflineItem}
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
        {online ? "En línea" : "Modo sin conexión"}
      </div>
      <div className="flex items-center gap-2">
        <ClipboardList size={18} />
        {queueCount} {queueCount === 1 ? "entrada pendiente" : "entradas pendientes"} por guardar
      </div>
      <div className="flex items-center gap-2">
        <Settings size={18} />
        {databaseStatus === "ready"
          ? "Registros de la granja listos"
          : databaseStatus === "checking"
            ? "Revisando registros de la granja"
            : "Cambios guardados en este dispositivo"}
      </div>
      {message ? (
        <p className="soft-panel p-3 text-[var(--clay)] md:col-span-3">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function NotificationsInbox({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: FarmNotification[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
}) {
  const orderedNotifications = [...(notifications ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unreadCount = orderedNotifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <details className="relative">
      <summary
        className="secondary-button relative grid h-12 w-12 cursor-pointer list-none place-items-center [&::-webkit-details-marker]:hidden"
        title="Bandeja de notificaciones"
        aria-label="Bandeja de notificaciones"
      >
        <Bell size={19} />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--clay)] px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </summary>
      <section className="floating-card absolute right-0 top-14 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4">
          <div>
            <h2 className="font-black">Bandeja de entrada</h2>
            <p className="text-xs font-bold text-[var(--muted)]">
              {unreadCount ? `${unreadCount} pendiente${unreadCount === 1 ? "" : "s"}` : "Todo al día"}
            </p>
          </div>
          {unreadCount ? (
            <button className="secondary-button h-9 px-3 text-xs" onClick={onMarkAllRead} type="button">
              Leer todas
            </button>
          ) : null}
        </header>
        <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-3">
          {orderedNotifications.length ? (
            <div className="grid gap-2">
              {orderedNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-2xl p-3 ${notification.readAt ? "bg-[var(--card-soft)]" : "bg-[var(--cream)]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{notification.title}</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-[var(--muted)]">{notification.detail}</p>
                      <p className="mt-2 text-xs font-bold text-[var(--muted)]">
                        {format(new Date(notification.createdAt), "d MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                    {!notification.readAt ? (
                      <button
                        className="shrink-0 rounded-xl px-2 py-1 text-xs font-black text-[var(--olive)] hover:bg-[var(--card)]"
                        onClick={() => onMarkRead(notification.id)}
                        type="button"
                      >
                        Leída
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-5 text-center text-sm font-bold text-[var(--muted)]">
              Aún no hay notificaciones.
            </p>
          )}
        </div>
      </section>
    </details>
  );
}

function DataBoxList({
  emptyLabel,
  rows,
}: {
  emptyLabel?: string;
  rows: Array<{
    fields: Array<{ label: string; value: React.ReactNode }>;
    id: string;
  }>;
}) {
  if (!rows.length) {
    return emptyLabel ? (
      <div className="soft-panel p-4 text-center text-sm font-bold text-[var(--muted)]">
        {emptyLabel}
      </div>
    ) : null;
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div
          className="grid gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--card-soft)_72%,var(--card))] p-4 sm:grid-cols-2"
          key={row.id}
        >
          {row.fields.map((field) => (
            <div className="min-w-0" key={field.label}>
              <p className="text-[10px] font-black uppercase text-[var(--muted)]">
                {field.label}
              </p>
              <div className="mt-1 text-sm font-extrabold leading-snug text-[var(--foreground)] break-words">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
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
              Huevos de hoy: {metrics.eggsToday}
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              {metrics.totalBirds} aves en el lote &mdash;{" "}
              {metrics.cartonsAvailable} cubetas disponibles.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-[var(--mustard)] px-5 py-3 text-sm font-black text-[#263429]"
            onClick={onQuickEgg}
          >
            <Egg size={18} className="mr-2 inline" />
            Registrar los huevos de hoy
          </button>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            {metrics.totalBirds} aves
          </div>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            {metrics.totalDeaths > 0
              ? `${Math.round((metrics.totalDeaths / metrics.totalArrivals) * 100)}% de mortalidad`
              : "0% de mortalidad"}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Egg} label="Huevos de hoy" value={metrics.eggsToday} tone="harvest" />
        <MetricCard icon={Bird} label="Aves" value={metrics.totalBirds} tone="moss" />
        <MetricCard icon={ShoppingCart} label="Cubetas disponibles" value={metrics.cartonsAvailable} tone="clay" />
        <MetricCard icon={Package} label="Stock de alimento" value={`${formatNumber(metrics.feedStockKg)} kg`} tone="plum" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MoneyCard label="Ventas del mes" value={metrics.monthlySales} tone="harvest" />
        <MoneyCard label="Gastos del mes" value={metrics.monthlyExpenses} tone="clay" />
        <MoneyCard label="Ganancia del mes" value={metrics.monthlyProfit} positive={metrics.monthlyProfit > 0} tone="plum" />
      </section>

      <section className="floating-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-[var(--cream)] text-[var(--olive)]">
            <BarChart3 size={19} />
          </div>
          <h2 className="text-lg font-black tracking-tight">Producción de huevos</h2>
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
            <ChartEmpty label="Registra huevos para ver la gráfica." />
          )}
        </div>
      </section>

      {alerts.length ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--clay)]">
            Alertas ({alerts.length})
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
  const createEmptyEggLogForm = () => ({
    date: todayIso(),
    totalEggs: 0,
    crackedEggs: 0,
    sizeBreakdown: normalizeEggSizeBreakdown(),
    feedConsumedKg: 0,
    vitaminInWater: "",
    vitaminInFeed: "",
    notes: "",
  });

  const [form, setForm] = useState(createEmptyEggLogForm);
  const [formMessage, setFormMessage] = useState("");
  const [classificationLogId, setClassificationLogId] = useState<string | null>(null);
  const [classificationDraft, setClassificationDraft] = useState(
    normalizeEggSizeBreakdown(),
  );
  const [classificationCrackedEggs, setClassificationCrackedEggs] = useState(0);
  const [classificationNotes, setClassificationNotes] = useState("");
  const [classificationMessage, setClassificationMessage] = useState("");
  const [searchWeek, setSearchWeek] = useState("");
  const weekSettings = normalizeAccountingWeekSettings(state.accountingWeekSettings);
  const [weekSettingsForm, setWeekSettingsForm] = useState(weekSettings);
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
  const stockByCategory = useMemo(
    () => getEggStockByCategoryData(state),
    [state],
  );
  const classificationLog = classificationLogId
    ? state.eggLogs.find((log) => log.id === classificationLogId) ?? null
    : null;
  const eggsAvailableForClassification = classificationLog
    ? Math.max(classificationLog.totalEggs - classificationCrackedEggs, 0)
    : 0;
  const classifiedEggs = getEggSizeTotal(classificationDraft);
  const eggsLeftToClassify = classificationLog
    ? Math.max(eggsAvailableForClassification - classifiedEggs, 0)
    : 0;

  function updateClassificationDraft(category: EggSizeCategory, value: number) {
    if (!classificationLog) {
      return;
    }

    const otherCategories = classifiedEggs - classificationDraft[category];
    const maximumForCategory = Math.max(
      eggsAvailableForClassification - otherCategories,
      0,
    );

    setClassificationDraft(
      normalizeEggSizeBreakdown({
        ...classificationDraft,
        [category]: Math.min(value, maximumForCategory),
      }),
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    if (form.feedConsumedKg <= 0) {
      setFormMessage("Ingresa los kilogramos de alimento consumidos para guardar la recolección.");
      return;
    }

    const existingLog = state.eggLogs.find((log) => log.date === form.date);

    if (existingLog) {
      setFormMessage(
        "Este día ya está registrado. Selecciónalo en la búsqueda semanal para clasificar los huevos.",
      );
      return;
    }

    const entry = {
      id: makeId("egg"),
      ...form,
      sizeBreakdown: normalizeEggSizeBreakdown(form.sizeBreakdown),
      synced: online,
      createdAt: nowIso(),
    };
    const notification: FarmNotification = {
      id: makeId("notification"),
      type: "egg_collection",
      title: "Nueva recolección de huevos",
      detail: `${entry.date}: se registraron ${formatNumber(entry.totalEggs)} huevos y ${entry.feedConsumedKg} kg de alimento consumido.`,
      createdAt: nowIso(),
    };

    updateState({
      ...state,
      eggLogs: [...state.eggLogs, entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
      notifications: [notification, ...(state.notifications ?? [])].slice(0, 30),
      offlineQueue: [...state.offlineQueue, queueOfflineItem("egg_logs", entry)],
    });

    setFormMessage("");
    setForm(createEmptyEggLogForm());
  }

  function openClassificationEditor(logId: string) {
    const log = state.eggLogs.find((item) => item.id === logId);
    if (!log) {
      return;
    }

    setClassificationLogId(log.id);
    setClassificationDraft(normalizeEggSizeBreakdown(log.sizeBreakdown));
    setClassificationCrackedEggs(log.crackedEggs);
    setClassificationNotes(log.notes ?? "");
    setClassificationMessage("");
  }

  function removeLog(logId: string) {
    if (classificationLogId === logId) {
      setClassificationLogId(null);
    }
    updateState({
      ...state,
      eggLogs: state.eggLogs.filter((log) => log.id !== logId),
    });
  }

  function saveClassification() {
    if (!classificationLog) {
      return;
    }

    if (classifiedEggs > eggsAvailableForClassification) {
      setClassificationMessage(
        "La suma de clasificaciones no puede superar los huevos buenos disponibles.",
      );
      return;
    }

    const notification: FarmNotification = {
      id: makeId("notification"),
      type: "egg_classification",
      title: "Clasificación de huevos completada",
      detail: `${classificationLog.date}: ${formatEggSizeBreakdown(classificationDraft) || "sin cantidades clasificadas"}. Partidos: ${classificationCrackedEggs}.`,
      createdAt: nowIso(),
    };

    updateState({
      ...state,
      eggLogs: state.eggLogs.map((log) =>
        log.id === classificationLog.id
          ? {
              ...log,
              crackedEggs: classificationCrackedEggs,
              notes: classificationNotes.trim() || undefined,
              sizeBreakdown: classificationDraft,
            }
          : log,
      ),
      notifications: [notification, ...(state.notifications ?? [])].slice(0, 30),
    });
    setClassificationLogId(null);
  }

  function saveWeekSettings(event: FormEvent) {
    event.preventDefault();
    const nextSettings = normalizeAccountingWeekSettings(weekSettingsForm);

    updateState({
      ...state,
      accountingWeekSettings: nextSettings,
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="Registro diario de huevos" icon={Egg}>
          <form className="egg-log-capture" onSubmit={submit}>
            <div className="egg-log-capture-intro">
              <p className="text-sm font-black">Registra el día en menos de un minuto.</p>
              <p className="text-xs font-semibold text-[var(--muted)]">
                Agrega el total recogido ahora y clasifica los huevos desde la vista semanal.
              </p>
            </div>
            <div className="egg-log-primary-fields">
              <Field label="Fecha">
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    setFormMessage("");
                    setForm({ ...form, date: event.target.value });
                  }}
                />
              </Field>
              <LargeNumberField
                label="Huevos recogidos"
                hint="Total del día"
                value={form.totalEggs}
                onChange={(value) => setForm({ ...form, totalEggs: value })}
              />
              <NumberField
                label="Quebrados o dañados"
                value={form.crackedEggs}
                onChange={(value) => setForm({ ...form, crackedEggs: value })}
              />
              <NumberField
                label="Alimento consumido (kg)"
                value={form.feedConsumedKg}
                onChange={(value) => {
                  setFormMessage("");
                  setForm({ ...form, feedConsumedKg: value });
                }}
              />
            </div>
            <div className="egg-log-live-summary">
              <MiniTotal label="Recogidos" value={totalEggs} />
              <MiniTotal label="Buenos" value={goodEggs} />
              <MiniTotal label="Cubetas" value={cartons} />
              <MiniTotal label="Sueltos" value={loose} />
            </div>
            <details className="egg-log-details">
              <summary>Más detalles diarios <span>Opcional</span></summary>
              <div className="egg-log-extra-fields">
                <Field label="Vitamina en el agua">
                  <input
                    className="input"
                    value={form.vitaminInWater}
                    onChange={(event) =>
                      setForm({ ...form, vitaminInWater: event.target.value })
                    }
                    placeholder="Ej. Compleland B12"
                  />
                </Field>
                <Field label="Vitamina en el alimento">
                  <input
                    className="input"
                    value={form.vitaminInFeed}
                    onChange={(event) =>
                      setForm({ ...form, vitaminInFeed: event.target.value })
                    }
                    placeholder="Ej. Vitaponedora"
                  />
                </Field>
                <Field label="Notas">
                  <textarea
                    className="input min-h-24 py-3"
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    placeholder="Nota opcional"
                  />
                </Field>
              </div>
            </details>
            {formMessage ? (
              <p className="egg-log-message" role="status">{formMessage}</p>
            ) : null}
            <button className="primary-button egg-log-save-button flex h-14 items-center justify-center gap-2 text-base">
              <Save size={20} />
              Guardar recolección diaria
            </button>
          </form>
        </Card>

        <Card title="Huevos en stock" icon={BarChart3}>
          <div className="grid gap-3">
            <div className="soft-panel grid grid-cols-2 gap-2 p-3 text-center">
              <MiniTotal label="Disponibles" value={stockByCategory.eggsAvailable} />
              <MiniTotal label="Cubetas" value={Math.floor(stockByCategory.eggsAvailable / 30)} />
              <MiniTotal label="Clasificados" value={stockByCategory.categorizedAvailable} />
              <MiniTotal label="Sueltos" value={stockByCategory.eggsAvailable % 30} />
            </div>

            {stockByCategory.uncategorizedAvailable ? (
              <p className="soft-panel p-3 text-sm font-bold text-[var(--muted)]">
                {formatNumber(stockByCategory.uncategorizedAvailable)} huevos disponibles
                aún no tienen una categoría de tamaño.
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
                <ChartEmpty label="Clasifica los huevos por tamaño para ver esta gráfica." />
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-black text-[var(--olive)]">
                Stock clasificado por tipo
              </p>
              <p className="mb-3 text-xs font-semibold text-[var(--muted)]">
                Cada total se actualiza cuando clasificas el registro diario y disminuye al vender ese tipo de huevo.
              </p>
            </div>
            <div className="grid gap-2 text-sm font-bold text-[var(--muted)]">
              {stockByCategory.rows.map((row) => (
                <div key={row.category} className="soft-panel grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3">
                  <span className="flex items-center gap-2 text-base text-[var(--foreground)]">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: eggCategoryColors[row.category] }} />
                    {row.category}
                  </span>
                  <span>
                    Total disponible: <strong className="text-[var(--foreground)]">{formatNumber(row.eggs)} huevos</strong>
                  </span>
                  <span className="text-right text-xs">
                    {row.cartons} cubetas<br />{row.loose} sueltos
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Búsqueda semanal" icon={SearchIcon}>
        <div className="grid gap-4">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={saveWeekSettings}>
            <Field label="Fecha inicial">
              <input
                className="input"
                type="date"
                value={weekSettingsForm.startDate}
                onChange={(event) =>
                  setWeekSettingsForm({
                    ...weekSettingsForm,
                    startDate: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Semana inicial">
              <input
                className="input"
                inputMode="numeric"
                value={formatNumericInputValue(weekSettingsForm.startWeek)}
                onChange={(event) =>
                  setWeekSettingsForm({
                    ...weekSettingsForm,
                    startWeek: parseNumericInputValue(event.target.value),
                  })
                }
              />
            </Field>
            <button className="secondary-button flex h-14 items-center justify-center gap-2 self-end px-5">
              <Save size={18} />
              Actualizar semanas
            </button>
          </form>
          <div className="soft-panel grid gap-1 p-3 text-sm font-bold text-[var(--muted)]">
            <span>{getWeekId(weekSettings.startDate, weekSettings)}</span>
            <span>{formatWeekRange(getWeekId(weekSettings.startDate, weekSettings), weekSettings)}</span>
          </div>
          <Field label="Seleccionar semana">
            <select
              className="input"
              value={searchWeek}
              onChange={(e) => setSearchWeek(e.target.value)}
            >
              <option value="">-- Selecciona una semana --</option>
              {allWeeks.map((week) => (
                <option key={week} value={week}>
                  {week} ({formatWeekRange(week, weekSettings)})
                </option>
              ))}
            </select>
          </Field>

          {weeklyData ? (
            <div className="grid gap-4">
              <div className="soft-panel grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Semana</p>
                  <p className="text-lg font-black">{weeklyData.weekId}</p>
                  <p className="text-xs font-bold text-[var(--muted)]">
                    {format(weeklyData.weekStart, "yyyy-MM-dd")} al {format(weeklyData.weekEnd, "yyyy-MM-dd")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Total de huevos</p>
                  <p className="text-lg font-black">{weeklyData.totalEggs}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Huevos buenos</p>
                  <p className="text-lg font-black">{weeklyData.goodEggs}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">Postura %</p>
                  <p className="text-lg font-black">{weeklyData.layingPercentage}%</p>
                </div>
              </div>

              {weeklyData.vaccines.length > 0 && (
                <div className="soft-panel p-4">
                  <p className="text-sm font-black text-[var(--olive)] mb-2">Vacunas de esta semana</p>
                  {weeklyData.vaccines.map((v) => (
                    <p key={v.id} className="text-sm font-semibold">{v.date}: {v.notes}</p>
                  ))}
                </div>
              )}

              <div className="weekly-egg-log-list">
                {weeklyData.logs.map((log) => {
                  const logClassifiedEggs = getEggSizeTotal(log.sizeBreakdown);
                  const logUnclassifiedEggs = Math.max(
                    log.totalEggs - logClassifiedEggs,
                    0,
                  );

                  return (
                    <article key={log.id} className="weekly-egg-log-card">
                      <div className="weekly-egg-log-heading">
                        <div>
                          <p className="text-sm font-black capitalize">
                            {getDayName(log.date)}
                          </p>
                          <p className="text-xs font-bold text-[var(--muted)]">
                            {log.date} · {formatNumber(log.totalEggs)} recogidos
                          </p>
                        </div>
                        <button
                          className="secondary-button weekly-egg-log-edit"
                          onClick={() => openClassificationEditor(log.id)}
                          type="button"
                        >
                          <Pencil size={16} />
                          Clasificar huevos
                        </button>
                      </div>
                      <div className="weekly-egg-log-metrics">
                        <span><strong>{formatNumber(log.totalEggs)}</strong> total</span>
                        <span><strong>{formatNumber(log.crackedEggs)}</strong> dañados</span>
                        <span><strong>{formatNumber(logClassifiedEggs)}</strong> clasificados</span>
                        <span><strong>{formatNumber(logUnclassifiedEggs)}</strong> por clasificar</span>
                      </div>
                      <p className="weekly-egg-log-classification">
                        {formatEggSizeBreakdown(log.sizeBreakdown) || "Aún sin clasificar"}
                      </p>
                    </article>
                  );
                })}
              </div>

              <div className="soft-panel p-4">
                <p className="text-sm font-black text-[var(--olive)] mb-2">Resumen</p>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div>Promedio de huevos/día: <strong>{weeklyData.avgDailyEggs}</strong></div>
                  <div>Alimento consumido: <strong>{weeklyData.feedConsumed} kg</strong></div>
                  <div>Ingresos: <strong>{formatCop(weeklyData.totalRevenue)}</strong></div>
                  <div>Postura: <strong>{weeklyData.layingPercentage}%</strong></div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Registros recientes de huevos" icon={ClipboardList}>
        <div className="grid gap-3">
          {state.eggLogs
            .slice(-7)
            .reverse()
            .map((log) => (
              <div key={log.id} className="soft-panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{log.date} - <span className="capitalize">{getDayName(log.date)}</span></p>
                  <p className="text-sm font-bold text-[var(--muted)]">
                    {log.synced ? "Guardado" : "Sin conexión"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Huevos: {log.totalEggs} • Quebrados: {log.crackedEggs}
                  {log.feedConsumedKg > 0 && ` • Alimento: ${log.feedConsumedKg}kg`}
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="secondary-button flex h-11 items-center justify-center gap-2 text-sm"
                    type="button"
                    onClick={() => openClassificationEditor(log.id)}
                  >
                    <Pencil size={16} />
                    Clasificar
                  </button>
                  <button
                    className="terracotta-button flex h-11 items-center justify-center gap-2 text-sm"
                    type="button"
                    onClick={() => removeLog(log.id)}
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {classificationLog ? (
        <div
          className="egg-classification-backdrop"
          onMouseDown={() => setClassificationLogId(null)}
          role="presentation"
        >
          <section
            aria-labelledby="classification-editor-title"
            aria-modal="true"
            className="egg-classification-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="egg-classification-modal-header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--clay)]">
                  {format(new Date(`${classificationLog.date}T12:00:00`), "EEEE, MMM d", { locale: es })}
                </p>
                <h2 id="classification-editor-title">Clasificar huevos recogidos</h2>
                <p>Actualiza solo los tamaños. El total recogido está bloqueado.</p>
              </div>
              <button
                aria-label="Cerrar el editor de clasificación"
                className="secondary-button grid h-11 w-11 place-items-center"
                onClick={() => setClassificationLogId(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            <div className="egg-classification-lock">
              <div>
                <span>Total recogido</span>
                <strong>{formatNumber(classificationLog.totalEggs)}</strong>
              </div>
              <div>
                <span>Disponibles para clasificar</span>
                <strong>{formatNumber(eggsAvailableForClassification)}</strong>
              </div>
              <div>
                <span>Clasificados</span>
                <strong>{formatNumber(classifiedEggs)}</strong>
              </div>
              <div>
                <span>Por clasificar</span>
                <strong>{formatNumber(eggsLeftToClassify)}</strong>
              </div>
            </div>
            <div
              aria-label={`${classifiedEggs} de ${eggsAvailableForClassification} huevos clasificados`}
              className="egg-classification-progress"
              role="progressbar"
              aria-valuemax={eggsAvailableForClassification}
              aria-valuemin={0}
              aria-valuenow={classifiedEggs}
            >
              <span
                style={{
                  width: `${eggsAvailableForClassification ? Math.min((classifiedEggs / eggsAvailableForClassification) * 100, 100) : 0}%`,
                }}
              />
            </div>

            <div className="egg-classification-grid">
              {EGG_SIZE_ORDER.map((category) => (
                <EggSizeEntry
                  key={category}
                  category={category}
                  value={classificationDraft[category]}
                  onChange={(value) => updateClassificationDraft(category, value)}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Huevos partidos o dañados"
                value={classificationCrackedEggs}
                onChange={(value) => {
                  setClassificationMessage("");
                  setClassificationCrackedEggs(
                    Math.min(value, classificationLog.totalEggs),
                  );
                }}
              />
              <Field label="Nota de la clasificación">
                <textarea
                  className="input min-h-24 py-3"
                  value={classificationNotes}
                  onChange={(event) => setClassificationNotes(event.target.value)}
                  placeholder="Ej. Se encontraron huevos sucios o partidos."
                />
              </Field>
            </div>
            <p className="egg-classification-help">
              Elige entre C, B, A, AA, AAA y Jumbo. La clasificación no puede superar los huevos buenos disponibles.
            </p>
            {classificationMessage ? (
              <p className="egg-log-message" role="status">{classificationMessage}</p>
            ) : null}

            <footer className="egg-classification-actions">
              <button
                className="secondary-button h-12"
                onClick={() => setClassificationLogId(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primary-button flex h-12 items-center justify-center gap-2"
                onClick={saveClassification}
                type="button"
              >
                <Save size={18} />
                Guardar clasificación
              </button>
            </footer>
          </section>
        </div>
      ) : null}
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
  const [form, setForm] = useState<{
    date: string;
    cartons: number;
    cartonType: EggSizeCategory;
    pricePerCartonCop: number;
    customerName: string;
    customerPhone: string;
    purchaseLocation: string;
  }>({
    date: todayIso(),
    cartons: 0,
    cartonType: "A",
    pricePerCartonCop: 19000,
    customerName: "",
    customerPhone: "",
    purchaseLocation: "",
  });
  const [saleMessage, setSaleMessage] = useState("");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const selectedWeekId = getWeekId(form.date, state.accountingWeekSettings);
  const selectedWeekCost = useMemo(
    () => getWeeklyEggCostBreakdown(state, selectedWeekId),
    [state, selectedWeekId],
  );
  const eggsSold = form.cartons * 30;
  const total = form.cartons * form.pricePerCartonCop;
  const salePricePerEgg = form.pricePerCartonCop / 30;
  const estimatedSaleCost = selectedWeekCost.costPerEggCop * eggsSold;
  const estimatedSaleMargin = total - estimatedSaleCost;
  const costPerEggByWeek = useMemo(() => getCostPerEggByWeek(state), [state]);
  const stockByCategory = useMemo(() => getEggStockByCategoryData(state), [state]);
  const selectedCategoryStock = stockByCategory.rows.find(
    (row) => row.category === form.cartonType,
  );
  const saleBeingEdited = state.sales.find((sale) => sale.id === editingSaleId);
  const cartonsAvailableForForm = cartonsAvailable + (saleBeingEdited?.cartons ?? 0);
  const cartonsAvailableForType =
    (selectedCategoryStock?.cartons ?? 0) +
    (saleBeingEdited?.cartonType === form.cartonType ? saleBeingEdited.cartons : 0);

  function resetSaleForm() {
    setEditingSaleId(null);
    setForm({
      date: todayIso(),
      cartons: 0,
      cartonType: "A",
      pricePerCartonCop: 19000,
      customerName: "",
      customerPhone: "",
      purchaseLocation: "",
    });
  }

  function isQueuedSale(item: OfflineQueueItem, saleId: string) {
    return (
      item.tableName === "sales" &&
      typeof item.payload === "object" &&
      item.payload !== null &&
      "id" in item.payload &&
      item.payload.id === saleId
    );
  }

  function editSale(sale: FarmState["sales"][number]) {
    setEditingSaleId(sale.id);
    setForm({
      date: sale.date,
      cartons: sale.cartons,
      cartonType: sale.cartonType ?? "A",
      pricePerCartonCop: sale.pricePerCartonCop,
      customerName: sale.customerName ?? "",
      customerPhone: sale.customerPhone ?? "",
      purchaseLocation: sale.purchaseLocation ?? "",
    });
    setSaleMessage("Edita los datos de la venta y guarda los cambios.");
  }

  function removeSale(sale: FarmState["sales"][number]) {
    if (!window.confirm(`¿Eliminar la venta de ${sale.cartons} cubetas del ${sale.date}?`)) {
      return;
    }

    updateState({
      ...state,
      sales: state.sales.filter((item) => item.id !== sale.id),
      offlineQueue: state.offlineQueue.filter((item) => !isQueuedSale(item, sale.id)),
    });

    if (editingSaleId === sale.id) {
      resetSaleForm();
    }

    setSaleMessage("Venta eliminada. El stock se actualizó.");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.cartons <= 0 || form.cartons > cartonsAvailableForForm) {
      setSaleMessage(`Solo hay ${cartonsAvailableForForm} cubetas de 30 disponibles para vender.`);
      return;
    }

    if (form.cartons > cartonsAvailableForType) {
      setSaleMessage(
        `Solo hay ${cartonsAvailableForType} cubetas de huevo tipo ${form.cartonType} disponibles. Clasifica más huevos para aumentar este stock.`,
      );
      return;
    }

    if (!form.customerName.trim() || !form.purchaseLocation.trim()) {
      setSaleMessage("Registra el nombre del cliente y el lugar de compra.");
      return;
    }

    const sale = { id: editingSaleId ?? makeId("sale"), ...form };
    updateState({
      ...state,
      sales: editingSaleId
        ? state.sales.map((item) => (item.id === editingSaleId ? sale : item))
        : [...state.sales, sale],
      offlineQueue: [
        ...state.offlineQueue.filter((item) => !isQueuedSale(item, sale.id)),
        queueOfflineItem("sales", sale),
      ],
    });
    const wasEditing = Boolean(editingSaleId);
    resetSaleForm();
    setSaleMessage(
      wasEditing
        ? "Venta actualizada y stock recalculado."
        : "Venta guardada y descontada del stock de huevos.",
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card title={editingSaleId ? "Editar venta de huevos" : "Registrar venta de huevos"} icon={ShoppingCart}>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--olive)]">Cubetas disponibles</p>
                <p className="mt-1 text-4xl font-black">{cartonsAvailable}</p>
                <p className="text-sm font-semibold text-[var(--muted)]">cubetas de 30 huevos</p>
              </div>
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--olive)]">Valor de esta venta</p>
                <p className="mt-1 break-words text-2xl font-black">{formatCop(total)}</p>
                <p className="text-sm font-semibold text-[var(--muted)]">venta actual</p>
              </div>
            </div>
            <Field label="Fecha de venta">
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
            <NumberField
              label="Cubetas vendidas"
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
              label="Precio por cubeta (COP)"
              value={form.pricePerCartonCop}
              onChange={(value) => setForm({ ...form, pricePerCartonCop: value })}
            />
            <Field label="Tipo de huevo vendido">
              <select
                className="input"
                value={form.cartonType}
                onChange={(event) =>
                  setForm({ ...form, cartonType: event.target.value as EggSizeCategory })
                }
              >
                {EGG_SIZE_ORDER.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <div className="soft-panel p-3 text-sm font-bold text-[var(--olive)]">
              Stock de tipo {form.cartonType}: {formatNumber(selectedCategoryStock?.eggs ?? 0)} huevos disponibles
              <span className="ml-2 text-[var(--muted)]">({cartonsAvailableForType} cubetas y {selectedCategoryStock?.loose ?? 0} sueltos)</span>
            </div>
            <Field label="Nombre del cliente">
              <input
                className="input"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                placeholder="Ej. Cliente A"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Teléfono (opcional)">
                <input
                  className="input"
                  inputMode="tel"
                  value={form.customerPhone}
                  onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
                  placeholder="Ej. 300 000 0000"
                />
              </Field>
              <Field label="Lugar de compra">
                <input
                  className="input"
                  value={form.purchaseLocation}
                  onChange={(event) => setForm({ ...form, purchaseLocation: event.target.value })}
                  placeholder="Tienda, finca, domicilio..."
                  required
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--muted)]">Total de la venta</p>
                <p className="text-3xl font-black">{formatCop(total)}</p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {formatCop(salePricePerEgg)}/huevo
                </p>
              </div>
              <div className="soft-panel p-4">
                <p className="text-sm font-bold text-[var(--muted)]">Costo semanal</p>
                <p className="text-3xl font-black">{formatCop(selectedWeekCost.costPerEggCop)}/huevo</p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {formatCop(selectedWeekCost.costPerCartonCop)}/cubeta
                </p>
              </div>
            </div>
            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-[var(--muted)]">Ganancia estimada de esta venta</p>
              <p className="text-3xl font-black">{formatCop(estimatedSaleMargin)}</p>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {formatNumber(eggsSold)} huevos vendidos • {formatCop(estimatedSaleCost)} de costo estimado
              </p>
            </div>
            {saleMessage ? <p className="soft-panel p-3 text-sm font-bold text-[var(--olive)]" role="status">{saleMessage}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="primary-button flex h-14 items-center justify-center gap-2 text-base">
                <ReceiptText size={20} />
                {editingSaleId ? "Guardar cambios" : "Guardar venta y descontar stock"}
              </button>
              {editingSaleId ? (
                <button
                  className="secondary-button h-14"
                  onClick={resetSaleForm}
                  type="button"
                >
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card title="Ventas recientes de huevos" icon={Wallet}>
          <div className="grid gap-3">
            {state.sales
              .slice()
              .reverse()
              .map((sale) => {
                const saleWeek = getWeekId(sale.date, state.accountingWeekSettings);
                const costPerEgg = costPerEggByWeek[saleWeek];
                const saleEggs = sale.cartons * 30;
                const saleTotal = sale.cartons * sale.pricePerCartonCop;
                const estimatedCost = (costPerEgg ?? 0) * saleEggs;
                return (
                  <div key={sale.id} className="soft-panel p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-black">
                        {sale.cartons} cubetas • {formatNumber(saleEggs)} huevos
                      </p>
                      <p className="font-black">{formatCop(saleTotal)}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {sale.date} • Vendido: {formatCop(sale.pricePerCartonCop / 30)}/huevo
                      {costPerEgg !== undefined && (
                        <span className="ml-2">
                          • Costo: {formatCop(costPerEgg)}/huevo • Ganancia: {formatCop(saleTotal - estimatedCost)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                      {sale.customerName} · {sale.purchaseLocation || "Sin lugar registrado"}
                      {sale.customerPhone ? ` · ${sale.customerPhone}` : ""}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        className="secondary-button flex h-11 items-center justify-center gap-2 text-sm"
                        onClick={() => editSale(sale)}
                        type="button"
                      >
                        <Pencil size={16} />
                        Editar
                      </button>
                      <button
                        className="terracotta-button flex h-11 items-center justify-center gap-2 text-sm"
                        onClick={() => removeSale(sale)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      <Card title="Ventas y costo de huevos" icon={BarChart3}>
        <DataBoxList
          emptyLabel="No hay ventas registradas"
          rows={state.sales.slice().reverse().map((sale) => ({
            id: sale.id,
            fields: [
              { label: "Fecha", value: sale.date },
              { label: "Cubetas vendidas", value: sale.cartons },
              { label: "Cantidad de huevos", value: formatNumber(sale.cartons * 30) },
              { label: "Precio/cubeta", value: formatCop(sale.pricePerCartonCop) },
              { label: "Venta/huevo", value: formatCop(sale.pricePerCartonCop / 30) },
              {
                label: "Costo semanal/huevo",
                value: costPerEggByWeek[getWeekId(sale.date, state.accountingWeekSettings)] !== undefined
                  ? formatCop(costPerEggByWeek[getWeekId(sale.date, state.accountingWeekSettings)])
                  : "-",
              },
              { label: "Total", value: formatCop(sale.cartons * sale.pricePerCartonCop) },
            ],
          }))}
        />
      </Card>

      <Card title="Registro de compras de clientes" icon={ClipboardList}>
        <DataBoxList
          emptyLabel="No hay clientes registrados"
          rows={state.sales
            .filter((sale) => sale.customerName?.trim())
            .slice()
            .reverse()
            .map((sale) => ({
              id: sale.id,
              fields: [
                { label: "Fecha", value: sale.date },
                { label: "Cliente", value: sale.customerName },
                { label: "Teléfono", value: sale.customerPhone || "No registrado" },
                { label: "Lugar de compra", value: sale.purchaseLocation || "No registrado" },
                { label: "Tipo de huevo", value: sale.cartonType || "-" },
              ],
            }))}
        />
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Tendencia de ventas" icon={BarChart3}>
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
              <ChartEmpty label="Aún no hay ventas registradas." />
            )}
          </div>
        </Card>

        <Card title="Tendencia de cubetas vendidas" icon={ShoppingCart}>
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
              <ChartEmpty label="Aún no hay cubetas vendidas para mostrar." />
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
              Resumen del lote
            </p>
            <h2 className="text-3xl font-black tracking-tight">{currentBirds} aves</h2>
            <p className="text-sm text-[var(--muted)]">
              {totalArrivals} llegadas • {totalDeaths} muertes • {mortalityPct}% de mortalidad
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Registrar llegada" icon={Plus}>
          <form className="grid gap-4" onSubmit={submitArrival}>
            <Field label="Fecha de llegada">
              <input className="input" type="date" value={arrival.date}
                onChange={(e) => setArrival({ ...arrival, date: e.target.value })} />
            </Field>
            <NumberField label="Cantidad" value={arrival.quantity}
              onChange={(q) => setArrival({ ...arrival, quantity: q })} />
            <Field label="Raza">
              <input className="input" value={arrival.breed}
                onChange={(e) => setArrival({ ...arrival, breed: e.target.value })}
                placeholder="Ej. Ponedoras" />
            </Field>
            <Field label="Notas">
              <input className="input" value={arrival.notes}
                onChange={(e) => setArrival({ ...arrival, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Guardar llegada</button>
          </form>
        </Card>

        <Card title="Registrar mortalidad" icon={ClipboardList}>
          <form className="grid gap-4" onSubmit={submitMortality}>
            <Field label="Fecha">
              <input className="input" type="date" value={mortality.date}
                onChange={(e) => setMortality({ ...mortality, date: e.target.value })} />
            </Field>
            <NumberField label="Muertes" value={mortality.deaths}
              onChange={(d) => setMortality({ ...mortality, deaths: d })} />
            <Field label="Causa">
              <input className="input" value={mortality.cause}
                onChange={(e) => setMortality({ ...mortality, cause: e.target.value })}
                placeholder="Ej. Enfermedad, accidente" />
            </Field>
            <Field label="Notas">
              <input className="input" value={mortality.notes}
                onChange={(e) => setMortality({ ...mortality, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Registrar</button>
          </form>
        </Card>
      </div>

      <Card title="Registro de mortalidad" icon={ClipboardList}>
        <DataBoxList
          emptyLabel="No hay mortalidad registrada"
          rows={state.mortalityRecords.slice().reverse().map((m) => ({
            id: m.id,
            fields: [
              { label: "Fecha", value: m.date },
              { label: "Muertes", value: <span className="text-red-600">{m.deaths}</span> },
              { label: "Causa", value: m.cause || "-" },
              { label: "Notas", value: m.notes || "-" },
            ],
          }))}
        />
      </Card>

      <Card title="Registro de llegadas" icon={Bird}>
        <DataBoxList
          emptyLabel="No hay llegadas registradas"
          rows={state.flockArrivals.slice().reverse().map((a) => ({
            id: a.id,
            fields: [
              { label: "Fecha", value: a.date },
              { label: "Cantidad", value: a.quantity },
              { label: "Raza", value: a.breed || "-" },
              { label: "Notas", value: a.notes || "-" },
            ],
          }))}
        />
      </Card>
    </div>
  );
}

function ExpenseSection({
  state,
  updateState,
  queueOfflineItem,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
}) {
  function createWeeklyExpenseDraft(
    expenses: Expense[] = [],
  ): WeeklyExpenseDraft {
    return expenseCategories.reduce((draft, category) => {
      const entries = expenses.filter((item) => item.category === category);
      draft[category] = {
        amountCop: entries.reduce((sum, item) => sum + item.amountCop, 0),
        description: entries
          .map((item) => item.description.trim())
          .filter(Boolean)
          .join(" · "),
      };
      return draft;
    }, {} as WeeklyExpenseDraft);
  }

  function isManagedExpenseCategory(
    category: Expense["category"],
  ): category is ManagedExpenseCategory {
    return expenseCategories.includes(category as ManagedExpenseCategory);
  }

  const [purchase, setPurchase] = useState({
    date: todayIso(),
    feedType: "Concentrado para ponedoras",
    quantityKg: 0,
    priceCop: 0,
    supplier: "",
  });
  const [selectedWeek, setSelectedWeek] = useState("");
  const [expenseDraft, setExpenseDraft] = useState<WeeklyExpenseDraft>(() =>
    createWeeklyExpenseDraft(),
  );
  const [expenseMessage, setExpenseMessage] = useState("");
  const allWeeks = useMemo(() => getAllWeeks(state), [state]);
  const selectedWeekData = useMemo(
    () => (selectedWeek ? getWeeklyData(state, selectedWeek) : null),
    [state, selectedWeek],
  );
  const selectedExpenses = (selectedWeekData?.weeklyCosts ?? [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedWeekTotal = selectedExpenses.reduce(
    (sum, item) => sum + item.amountCop,
    0,
  );

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
    setPurchase({ date: todayIso(), feedType: "Concentrado para ponedoras", quantityKg: 0, priceCop: 0, supplier: "" });
  }

  function selectExpenseWeek(weekId: string) {
    setSelectedWeek(weekId);
    setExpenseMessage("");
    setExpenseDraft(
      createWeeklyExpenseDraft(
        weekId ? getWeeklyData(state, weekId).weeklyCosts : [],
      ),
    );
  }

  function updateExpenseDraft(
    category: ManagedExpenseCategory,
    changes: Partial<WeeklyExpenseDraft[ManagedExpenseCategory]>,
  ) {
    setExpenseDraft({
      ...expenseDraft,
      [category]: { ...expenseDraft[category], ...changes },
    });
  }

  function isQueuedExpense(item: OfflineQueueItem, id: string) {
    return (
      item.tableName === "expenses" &&
      typeof item.payload === "object" &&
      item.payload !== null &&
      "id" in item.payload &&
      item.payload.id === id
    );
  }

  function saveWeeklyExpenses(event: FormEvent) {
    event.preventDefault();
    if (!selectedWeek) {
      setExpenseMessage("Selecciona una semana antes de guardar los gastos.");
      return;
    }

    const weekExpenses = selectedWeekData?.weeklyCosts ?? [];
    const managedExpenses = weekExpenses.filter((item) =>
      isManagedExpenseCategory(item.category),
    );
    const existingByCategory = new Map(
      managedExpenses.map((item) => [item.category, item]),
    );
    const expenseDate = format(
      getWeekRangeFromId(selectedWeek, state.accountingWeekSettings).start,
      "yyyy-MM-dd",
    );
    const nextExpenses = expenseCategories.flatMap((category) => {
      const draft = expenseDraft[category];
      if (draft.amountCop <= 0) {
        return [];
      }

      return [{
        id: existingByCategory.get(category)?.id ?? makeId("expense"),
        date: expenseDate,
        category,
        amountCop: draft.amountCop,
        description: draft.description.trim(),
      } satisfies Expense];
    });
    const managedExpenseIds = new Set(managedExpenses.map((item) => item.id));

    updateState({
      ...state,
      expenses: [
        ...state.expenses.filter((item) => !managedExpenseIds.has(item.id)),
        ...nextExpenses,
      ].sort((a, b) => a.date.localeCompare(b.date)),
      offlineQueue: [
        ...state.offlineQueue.filter((item) =>
          !managedExpenses.some((expense) => isQueuedExpense(item, expense.id)),
        ),
        ...nextExpenses.map((expense) => queueOfflineItem("expenses", expense)),
      ],
    });
    setExpenseMessage(
      nextExpenses.length
        ? "Los gastos de la semana se guardaron correctamente."
        : "Se eliminaron los gastos registrados de estas categorías para la semana.",
    );
  }

  function removeExpense(item: Expense) {
    if (!window.confirm(`¿Eliminar el gasto de ${expenseCategoryLabels[item.category]}?`)) {
      return;
    }

    updateState({
      ...state,
      expenses: state.expenses.filter((expenseItem) => expenseItem.id !== item.id),
      offlineQueue: state.offlineQueue.filter((queuedItem) => !isQueuedExpense(queuedItem, item.id)),
    });
    setExpenseDraft(createWeeklyExpenseDraft(selectedExpenses.filter((expenseItem) => expenseItem.id !== item.id)));
    setExpenseMessage("El gasto fue eliminado.");
  }

  const selectedWeekRange = selectedWeek
    ? formatWeekRange(selectedWeek, state.accountingWeekSettings)
    : "";
  const weekTotalDraft = expenseCategories.reduce(
    (sum, category) => sum + expenseDraft[category].amountCop,
    0,
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Compra de alimento" icon={Sprout}>
          <form className="grid gap-4" onSubmit={submitPurchase}>
            <Field label="Fecha">
              <input className="input" type="date" value={purchase.date}
                onChange={(e) => setPurchase({ ...purchase, date: e.target.value })} />
            </Field>
            <Field label="Tipo de alimento">
              <input className="input" value={purchase.feedType}
                onChange={(e) => setPurchase({ ...purchase, feedType: e.target.value })} />
            </Field>
            <NumberField label="Cantidad en kg" value={purchase.quantityKg}
              onChange={(q) => setPurchase({ ...purchase, quantityKg: q })} />
            <NumberField label="Precio total (COP)" value={purchase.priceCop}
              onChange={(p) => setPurchase({ ...purchase, priceCop: p })} />
            <Field label="Proveedor">
              <input className="input" value={purchase.supplier}
                onChange={(e) => setPurchase({ ...purchase, supplier: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Guardar compra</button>
          </form>
        </Card>

        <Card title="Gastos de la semana" icon={ReceiptText}>
          <form className="grid gap-4" onSubmit={saveWeeklyExpenses}>
            <Field label="Seleccionar semana">
              <select
                className="input"
                onChange={(event) => selectExpenseWeek(event.target.value)}
                value={selectedWeek}
              >
                <option value="">-- Selecciona una semana --</option>
                {allWeeks.map((week) => (
                  <option key={week} value={week}>
                    {week} ({formatWeekRange(week, state.accountingWeekSettings)})
                  </option>
                ))}
              </select>
            </Field>

            {selectedWeek ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Semana seleccionada</p>
                <p className="mt-1 text-base font-black text-[var(--forest)]">{selectedWeekRange}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {expenseCategories.map((category) => {
                const draft = expenseDraft[category];
                return (
                  <article className="rounded-3xl border border-[var(--line)] bg-[var(--card-soft)] p-4" key={category}>
                    <p className="font-black text-[var(--forest)]">{expenseCategoryLabels[category]}</p>
                    <label className="mt-3 block">
                      <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">Valor (COP)</span>
                      <input
                        aria-label={`Valor de ${expenseCategoryLabels[category]}`}
                        className="input mt-2"
                        inputMode="numeric"
                        onChange={(event) => updateExpenseDraft(category, {
                          amountCop: parseNumericInputValue(event.target.value),
                        })}
                        onFocus={(event) => event.currentTarget.select()}
                        pattern="[0-9]*"
                        type="text"
                        value={formatNumericInputValue(draft.amountCop)}
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">Nota (opcional)</span>
                      <input
                        aria-label={`Nota de ${expenseCategoryLabels[category]}`}
                        className="input mt-2"
                        onChange={(event) => updateExpenseDraft(category, { description: event.target.value })}
                        placeholder="Detalle del gasto"
                        value={draft.description}
                      />
                    </label>
                  </article>
                );
              })}
            </div>

            <div className="rounded-2xl bg-[var(--cream)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Total a guardar</p>
              <p className="mt-1 text-2xl font-black text-[var(--forest)]">{formatCop(weekTotalDraft)}</p>
            </div>
            {expenseMessage ? (
              <p className="rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-bold text-[var(--olive)]">{expenseMessage}</p>
            ) : null}
            <button className="primary-button h-13 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedWeek} type="submit">
              <Save size={20} /> Guardar todos los gastos
            </button>
          </form>
        </Card>
      </div>

      <Card title="Buscar y editar gastos por semana" icon={ReceiptText}>
        {selectedWeekData ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="soft-panel p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{selectedWeek}</p>
                <p className="mt-1 text-base font-black text-[var(--forest)]">{selectedWeekRange}</p>
              </div>
            <div className="rounded-2xl bg-[var(--cream)] px-5 py-3 text-center md:min-w-52">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Total semanal</p>
              <p className="mt-1 text-xl font-black text-[var(--forest)]">{formatCop(selectedWeekTotal)}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-[var(--muted)]">Edita cualquier categoría arriba y presiona “Guardar todos los gastos”.</p>
          <DataBoxList
            emptyLabel="No hay gastos registrados en esta semana."
            rows={selectedExpenses.map((item) => ({
              id: item.id,
              fields: [
                { label: "Categoría", value: expenseCategoryLabels[item.category] },
                { label: "Valor", value: formatCop(item.amountCop) },
                { label: "Descripción", value: item.description || "Sin descripción" },
                {
                  label: "Acciones",
                  value: (
                    <div className="flex flex-wrap gap-2">
                      <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100" onClick={() => removeExpense(item)} type="button">
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  ),
                },
              ],
            }))}
          />
          </div>
        ) : (
          <div className="soft-panel p-5 text-center text-sm font-bold text-[var(--muted)]">
            Selecciona una semana arriba para buscar o editar sus gastos.
          </div>
        )}
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
    <Card title="Inventario" icon={Boxes}>
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
                  <p className="text-sm font-semibold text-[#66736b]">{inventoryCategoryLabels[item.category]}</p>
                </div>
                {low ? <AlertTriangle className="text-[#bf6b16]" /> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <NumberField label={`Cantidad ${item.unit}`} value={item.quantity}
                  onChange={(quantity) => updateState({
                    ...state,
                    inventoryItems: state.inventoryItems.map((current) =>
                      current.id === item.id ? { ...current, quantity } : current,
                    ),
                  })} />
                <NumberField label="Alerta de mínimo" value={item.reorderLevel}
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
      <Card title="Registro de salud" icon={HeartPulse}>
        <form className="grid gap-4" onSubmit={submitHealth}>
          <Field label="Fecha">
            <input className="input" type="date" value={health.date}
              onChange={(e) => setHealth({ ...health, date: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <select className="input" value={health.type}
              onChange={(e) => setHealth({ ...health, type: e.target.value as HealthRecord["type"] })}>
              <option value="sick">Aves enfermas</option>
              <option value="death">Muertes</option>
              <option value="vaccination">Vacunación</option>
              <option value="medicine">Uso de medicina</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Aves enfermas" value={health.sickBirds}
              onChange={(s) => setHealth({ ...health, sickBirds: s })} />
            <NumberField label="Muertes" value={health.deaths}
              onChange={(d) => setHealth({ ...health, deaths: d })} />
          </div>
          <Field label="Notas">
            <textarea className="input min-h-24 py-3" value={health.notes}
              onChange={(e) => setHealth({ ...health, notes: e.target.value })} />
          </Field>
          <button className="primary-button h-13">Guardar nota de salud</button>
        </form>
      </Card>

      <div className="grid gap-4">
        <Card title="Recordatorio" icon={Settings}>
          <form className="grid gap-4" onSubmit={submitTask}>
            <Field label="Título del recordatorio">
              <input className="input" value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                placeholder="Limpieza, mantenimiento, compra de alimento..." />
            </Field>
            <Field label="Fecha límite">
              <input className="input" type="date" value={task.dueDate}
                onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
            </Field>
            <Field label="Notas">
              <input className="input" value={task.notes}
                onChange={(e) => setTask({ ...task, notes: e.target.value })} />
            </Field>
            <button className="primary-button h-13">Agregar recordatorio</button>
          </form>
        </Card>

        <Card title="Mantenimientos abiertos" icon={ClipboardList}>
          <div className="grid gap-3">
            {state.maintenanceTasks.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[#f8f5ed] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="text-sm text-[#66736b]">Vence: {item.dueDate}</p>
                  </div>
                  <button className="rounded-xl bg-white px-3 py-2 text-xs font-black"
                    onClick={() => updateState({
                      ...state,
                      maintenanceTasks: state.maintenanceTasks.map((task) =>
                        task.id === item.id ? { ...task, status: task.status === "done" ? "open" : "done" } : task,
                      ),
                    })}>
                    {item.status === "done" ? "Completado" : "Pendiente"}
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
    const columns = [
      ["date", "fecha"], ["eggsCollected", "huevos_recogidos"],
      ["crackedEggs", "huevos_quebrados"], ["goodEggs", "huevos_buenos"],
      ["feedKg", "alimento_kg"], ["sizeC", "tamano_C"],
      ["sizeB", "tamano_B"], ["sizeA", "tamano_A"],
      ["sizeAA", "tamano_AA"], ["sizeAAA", "tamano_AAA"],
      ["sizeJumbo", "tamano_Jumbo"], ["sizeTotal", "total_clasificado"],
      ["sizeSummary", "resumen_tamanos"], ["cartonsSold", "cubetas_vendidas"],
      ["salesCop", "ventas_cop"], ["expensesCop", "gastos_cop"],
    ] as const;
    const csv = [
      columns.map(([, label]) => label).join(","),
      ...rows.map((row) => columns.map(([key]) => row[key]).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-huevos-brianna-${todayIso()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Granja Brianna Eggs", 14, 18);
    doc.setFontSize(11);
    doc.text(`Fecha: ${todayIso()}`, 14, 28);
    doc.text(`Cubetas disponibles: ${metrics.cartonsAvailable}`, 14, 38);
    doc.text(`Ventas del mes: ${formatCop(metrics.monthlySales)}`, 14, 48);
    doc.text(`Gastos del mes: ${formatCop(metrics.monthlyExpenses)}`, 14, 58);
    doc.text(`Ganancia estimada: ${formatCop(metrics.monthlyProfit)}`, 14, 68);
    let y = 84;
    rows.slice(-10).forEach((row) => {
      doc.text(`${row.date}: ${row.goodEggs} huevos buenos, ${row.cartonsSold} cubetas vendidas, ${formatCop(row.salesCop)} en ventas`, 14, y);
      y += 8;
    });
    doc.save(`reporte-huevos-brianna-${todayIso()}.pdf`);
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={Egg} label="Huevos disponibles" value={metrics.eggsAvailable} tone="harvest" />
        <MetricCard icon={ShoppingCart} label="Cubetas disponibles" value={metrics.cartonsAvailable} tone="clay" />
        <MetricCard icon={Wallet} label="Ganancia del mes" value={formatCop(metrics.monthlyProfit)} tone="plum" />
      </section>

      <Card title="Reportes y exportaciones" icon={Download}>
        <div className="grid gap-3 md:grid-cols-3">
          <button className="primary-button flex h-13 items-center justify-center gap-2" onClick={exportCsv}>
            <Download size={19} /> Exportar CSV
          </button>
          <button className="terracotta-button flex h-13 items-center justify-center gap-2" onClick={() => void exportPdf()}>
            <Download size={19} /> Exportar PDF
          </button>
          <button className="secondary-button flex h-13 items-center justify-center gap-2" onClick={onReset}>
            <RefreshCw size={19} /> Reiniciar datos
          </button>
        </div>
      </Card>

      <Card title="Últimos 14 días" icon={BarChart3}>
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

      <Card title="Registros recientes" icon={ClipboardList}>
        <DataBoxList
          rows={rows.slice().reverse().map((row) => ({
            id: row.date,
            fields: [
              { label: "Fecha", value: row.date },
              { label: "Huevos recogidos", value: row.eggsCollected },
              { label: "Huevos buenos", value: row.goodEggs },
              { label: "Alimento kg", value: row.feedKg || "-" },
              { label: "Tamaños", value: row.sizeSummary },
              { label: "Vendido", value: row.cartonsSold },
              { label: "Ventas", value: formatCop(row.salesCop) },
            ],
          }))}
        />
      </Card>
    </div>
  );
}

function FloatingSideNav({
  activeTab,
  setActiveTab,
  allowedTabs,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  allowedTabs: TabKey[];
}) {
  return (
    <aside className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:left-6">
      <nav className="floating-card grid gap-2 p-2">
        {tabs.filter((tab) => allowedTabs.includes(tab.id)).map((tab) => {
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
  const label = `Cambiar a modo ${nextThemeMode === "nighttime" ? "noche" : "día"}`;

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
  queueOfflineItem,
  onReset,
}: {
  state: FarmState;
  metrics: ReturnType<typeof calculateFarmMetrics>;
  rows: ReturnType<typeof getReportRows>;
  moreSection: MoreSectionKey;
  setMoreSection: (section: MoreSectionKey) => void;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
  onReset: () => void;
}) {
  const options: { id: MoreSectionKey; label: string; detail: string; icon: React.ComponentType<{ size?: number }>; tone: OrganicTone }[] = [
    { id: "inventory", label: "Inventario", detail: "Alimento, medicina y empaques", icon: Boxes, tone: "moss" },
    { id: "health", label: "Salud", detail: "Notas de cuidado y recordatorios", icon: HeartPulse, tone: "plum" },
    { id: "import", label: "Carga masiva", detail: "Plantillas e importación CSV", icon: FileUp, tone: "clay" },
    { id: "reports", label: "Reportes", detail: "CSV, PDF y rendimiento", icon: BarChart3, tone: "harvest" },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
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
      {moreSection === "import" ? <CsvBulkImportSection state={state} updateState={updateState} queueOfflineItem={queueOfflineItem} /> : null}
      {moreSection === "reports" ? <ReportsSection state={state} rows={rows} metrics={metrics} onReset={onReset} /> : null}
    </div>
  );
}

type CsvImportKind = "egg_logs" | "sales" | "expenses" | "investments";

const CSV_IMPORT_TEMPLATES: Record<CsvImportKind, { label: string; fileName: string; headers: string[]; help: string }> = {
  egg_logs: {
    label: "Recolecciones y clasificación",
    fileName: "plantilla_recolecciones_huevos.csv",
    headers: ["fecha", "total_huevos", "huevos_quebrados", "kg_alimento_consumido", "vitaminas_agua", "vitaminas_alimento", "nota", "tipo_c", "tipo_b", "tipo_a", "tipo_aa", "tipo_aaa", "tipo_jumbo"],
    help: "Una fila por día. La fecha debe estar en formato AAAA-MM-DD y los tipos no pueden superar los huevos buenos.",
  },
  sales: {
    label: "Ventas de huevos",
    fileName: "plantilla_ventas_huevos.csv",
    headers: ["fecha", "cubetas", "tipo_huevo", "valor_por_cubeta_cop", "nombre_cliente", "telefono_cliente", "lugar_compra"],
    help: "Una fila por venta. Cada cubeta equivale a 30 huevos. Tipos válidos: C, B, A, AA, AAA o Jumbo. El teléfono es opcional.",
  },
  expenses: {
    label: "Gastos",
    fileName: "plantilla_gastos.csv",
    headers: ["fecha", "categoria", "monto_cop", "descripcion"],
    help: "Categorías válidas: Mantenimiento, Medicina, Vacunas, Cama, Transporte, Mano de obra, Electricidad, Agua, Reparaciones, Empaques o Limpieza.",
  },
  investments: {
    label: "Inversión inicial",
    fileName: "plantilla_inversion_inicial.csv",
    headers: ["fecha", "categoria", "subcategoria", "descripcion", "cantidad", "unidad", "precio_unitario_cop", "proveedor"],
    help: "Usa las categorías listadas abajo. El total se calcula automáticamente: cantidad × precio unitario.",
  },
};

const CSV_EXPENSE_CATEGORY_ALIASES: Record<string, Expense["category"]> = {
  maintenance: "maintenance",
  mantenimiento: "maintenance",
  medicine: "medicine",
  medicina: "medicine",
  transport: "transport",
  transporte: "transport",
  caretaker: "caretaker",
  cuidandero: "caretaker",
  sundays: "sundays",
  dominicales: "sundays",
  administration: "administration",
  administracion: "administration",
  shelves: "shelves",
  anaqueles: "shelves",
};

const CSV_INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  "galpon_construccion", "galpon_materiales_olga", "galpon_materiales_homecenter", "galpon_materiales_laroca", "gallinas_compra", "gallinas_alimento", "gallinas_medicina_vacunas", "gallinas_implementos", "gastos_semanales", "cuidandero", "otros",
];

const CSV_SALE_EGG_TYPES: Record<string, EggSizeCategory> = {
  c: "C",
  b: "B",
  a: "A",
  aa: "AA",
  aaa: "AAA",
  jumbo: "Jumbo",
};

function CsvBulkImportSection({
  state,
  updateState,
  queueOfflineItem,
}: {
  state: FarmState;
  updateState: (state: FarmState) => void;
  queueOfflineItem: (
    tableName: OfflineQueueItem["tableName"],
    payload: unknown,
  ) => OfflineQueueItem;
}) {
  const [kind, setKind] = useState<CsvImportKind>("egg_logs");
  const [message, setMessage] = useState("");
  const template = CSV_IMPORT_TEMPLATES[kind];

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(template.headers)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = template.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function numberFromRow(
    row: Record<string, string>,
    column: string,
    rowNumber: number,
    errors: string[],
    options: { required?: boolean; integer?: boolean; min?: number } = {},
  ) {
    const rawValue = row[column]?.trim() ?? "";
    if (!rawValue && !options.required) {
      return 0;
    }

    const value = parseCsvNumber(rawValue);
    if (
      !Number.isFinite(value) ||
      (options.integer && !Number.isInteger(value)) ||
      (options.min !== undefined && value < options.min)
    ) {
      errors.push(`Fila ${rowNumber}: “${column}” no es válido.`);
      return 0;
    }

    return value;
  }

  function validateHeaders(rows: Record<string, string>[], requiredHeaders: string[]) {
    const headers = new Set(Object.keys(rows[0] ?? {}));
    const missing = requiredHeaders.filter((header) => !headers.has(header));
    return missing.length ? `Faltan las columnas: ${missing.join(", ")}.` : "";
  }

  async function importCsv(file: File) {
    const rows = parseCsv(await file.text());
    if (!rows.length) {
      setMessage("El archivo no tiene filas para importar.");
      return;
    }

    const errors: string[] = [];

    if (kind === "egg_logs") {
      const headerError = validateHeaders(rows, ["fecha", "total_huevos", "huevos_quebrados", "kg_alimento_consumido"]);
      if (headerError) {
        setMessage(headerError);
        return;
      }

      const existingDates = new Set(state.eggLogs.map((log) => log.date));
      const importedDates = new Set<string>();
      const entries = rows.map((row, index) => {
        const rowNumber = index + 2;
        const date = row.fecha?.trim() ?? "";
        const totalEggs = numberFromRow(row, "total_huevos", rowNumber, errors, { required: true, integer: true, min: 1 });
        const crackedEggs = numberFromRow(row, "huevos_quebrados", rowNumber, errors, { required: true, integer: true, min: 0 });
        const feedConsumedKg = numberFromRow(row, "kg_alimento_consumido", rowNumber, errors, { required: true, min: 0.001 });
        const sizeBreakdown = normalizeEggSizeBreakdown({
          C: numberFromRow(row, "tipo_c", rowNumber, errors, { integer: true, min: 0 }),
          B: numberFromRow(row, "tipo_b", rowNumber, errors, { integer: true, min: 0 }),
          A: numberFromRow(row, "tipo_a", rowNumber, errors, { integer: true, min: 0 }),
          AA: numberFromRow(row, "tipo_aa", rowNumber, errors, { integer: true, min: 0 }),
          AAA: numberFromRow(row, "tipo_aaa", rowNumber, errors, { integer: true, min: 0 }),
          Jumbo: numberFromRow(row, "tipo_jumbo", rowNumber, errors, { integer: true, min: 0 }),
        });

        if (!isIsoDate(date)) errors.push(`Fila ${rowNumber}: la fecha debe usar AAAA-MM-DD.`);
        if (existingDates.has(date) || importedDates.has(date)) errors.push(`Fila ${rowNumber}: ya existe una recolección para ${date}.`);
        if (crackedEggs > totalEggs) errors.push(`Fila ${rowNumber}: los huevos quebrados no pueden superar el total.`);
        if (getEggSizeTotal(sizeBreakdown) > totalEggs - crackedEggs) errors.push(`Fila ${rowNumber}: la clasificación supera los huevos buenos.`);
        importedDates.add(date);

        return {
          id: makeId("egg"),
          date,
          totalEggs,
          crackedEggs,
          sizeBreakdown,
          feedConsumedKg,
          vitaminInWater: row.vitaminas_agua?.trim() ?? "",
          vitaminInFeed: row.vitaminas_alimento?.trim() ?? "",
          notes: row.nota?.trim() || undefined,
          synced: false,
          createdAt: nowIso(),
        };
      });

      if (errors.length) {
        setMessage(`No se importó el archivo. ${errors.slice(0, 3).join(" ")}`);
        return;
      }

      updateState({
        ...state,
        eggLogs: [...state.eggLogs, ...entries].sort((a, b) => a.date.localeCompare(b.date)),
        offlineQueue: [...state.offlineQueue, ...entries.map((entry) => queueOfflineItem("egg_logs", entry))],
      });
      setMessage(`${entries.length} recolecciones importadas correctamente.`);
      return;
    }

    if (kind === "sales") {
      const headerError = validateHeaders(rows, ["fecha", "cubetas", "tipo_huevo", "valor_por_cubeta_cop", "nombre_cliente", "lugar_compra"]);
      if (headerError) {
        setMessage(headerError);
        return;
      }

      const stockByCategory = getEggStockByCategoryData(state);
      const requestedEggsByType = Object.fromEntries(
        EGG_SIZE_ORDER.map((type) => [type, 0]),
      ) as Record<EggSizeCategory, number>;
      const entries = rows.map((row, index) => {
        const rowNumber = index + 2;
        const date = row.fecha?.trim() ?? "";
        const cartons = numberFromRow(row, "cubetas", rowNumber, errors, { required: true, integer: true, min: 1 });
        const rawType = row.tipo_huevo?.trim().toLowerCase() ?? "";
        const cartonType = CSV_SALE_EGG_TYPES[rawType];
        const pricePerCartonCop = numberFromRow(row, "valor_por_cubeta_cop", rowNumber, errors, { required: true, min: 1 });
        const customerName = row.nombre_cliente?.trim() ?? "";
        const customerPhone = row.telefono_cliente?.trim() ?? "";
        const purchaseLocation = row.lugar_compra?.trim() ?? "";

        if (!isIsoDate(date)) errors.push(`Fila ${rowNumber}: la fecha debe usar AAAA-MM-DD.`);
        if (!cartonType) errors.push(`Fila ${rowNumber}: “tipo_huevo” debe ser C, B, A, AA, AAA o Jumbo.`);
        if (!customerName) errors.push(`Fila ${rowNumber}: agrega el nombre del cliente.`);
        if (!purchaseLocation) errors.push(`Fila ${rowNumber}: agrega el lugar de compra.`);
        if (cartonType) requestedEggsByType[cartonType] += cartons * 30;

        return {
          id: makeId("sale"),
          date,
          cartons,
          cartonType: cartonType ?? "A",
          pricePerCartonCop,
          customerName,
          customerPhone: customerPhone || undefined,
          purchaseLocation,
        };
      });

      for (const type of EGG_SIZE_ORDER) {
        const available = stockByCategory.rows.find((row) => row.category === type)?.eggs ?? 0;
        if (requestedEggsByType[type] > available) {
          errors.push(`No hay suficientes huevos tipo ${type}: se intentan vender ${requestedEggsByType[type]} y hay ${available} disponibles.`);
        }
      }

      if (errors.length) {
        setMessage(`No se importó el archivo. ${errors.slice(0, 3).join(" ")}`);
        return;
      }

      updateState({
        ...state,
        sales: [...state.sales, ...entries],
        offlineQueue: [...state.offlineQueue, ...entries.map((entry) => queueOfflineItem("sales", entry))],
      });
      setMessage(`${entries.length} ventas importadas correctamente y el stock fue actualizado.`);
      return;
    }

    if (kind === "expenses") {
      const headerError = validateHeaders(rows, ["fecha", "categoria", "monto_cop", "descripcion"]);
      if (headerError) {
        setMessage(headerError);
        return;
      }

      const entries = rows.map((row, index) => {
        const rowNumber = index + 2;
        const date = row.fecha?.trim() ?? "";
        const normalizedCategory = (row.categoria?.trim() ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[\s-]+/g, "_");
        const category = CSV_EXPENSE_CATEGORY_ALIASES[normalizedCategory];
        const amountCop = numberFromRow(row, "monto_cop", rowNumber, errors, { required: true, min: 0.001 });
        const description = row.descripcion?.trim() ?? "";
        if (!isIsoDate(date)) errors.push(`Fila ${rowNumber}: la fecha debe usar AAAA-MM-DD.`);
        if (!category) errors.push(`Fila ${rowNumber}: categoría de gasto no válida.`);
        if (!description) errors.push(`Fila ${rowNumber}: agrega una descripción.`);
        return { id: makeId("expense"), date, category: category ?? "maintenance", amountCop, description };
      });

      if (errors.length) {
        setMessage(`No se importó el archivo. ${errors.slice(0, 3).join(" ")}`);
        return;
      }

      updateState({
        ...state,
        expenses: [...state.expenses, ...entries],
        offlineQueue: [...state.offlineQueue, ...entries.map((entry) => queueOfflineItem("expenses", entry))],
      });
      setMessage(`${entries.length} gastos importados correctamente.`);
      return;
    }

    const headerError = validateHeaders(rows, ["categoria", "descripcion", "cantidad", "unidad", "precio_unitario_cop"]);
    if (headerError) {
      setMessage(headerError);
      return;
    }

    const entries = rows.map((row, index) => {
      const rowNumber = index + 2;
      const date = row.fecha?.trim() ?? "";
      const category = row.categoria?.trim().toLowerCase() as InvestmentCategory;
      const quantity = numberFromRow(row, "cantidad", rowNumber, errors, { required: true, min: 0.001 });
      const unitPrice = numberFromRow(row, "precio_unitario_cop", rowNumber, errors, { required: true, min: 0 });
      const description = row.descripcion?.trim() ?? "";
      const unit = row.unidad?.trim() ?? "";
      if (date && !isIsoDate(date)) errors.push(`Fila ${rowNumber}: la fecha debe usar AAAA-MM-DD.`);
      if (!CSV_INVESTMENT_CATEGORIES.includes(category)) errors.push(`Fila ${rowNumber}: categoría de inversión no válida.`);
      if (!description || !unit) errors.push(`Fila ${rowNumber}: agrega descripción y unidad.`);
      return {
        id: makeId("investment"),
        category,
        subcategory: row.subcategoria?.trim() ?? "",
        description,
        quantity,
        unit,
        unitPrice,
        totalPrice: quantity * unitPrice,
        date: date || undefined,
        supplier: row.proveedor?.trim() || undefined,
      };
    });

    if (errors.length) {
      setMessage(`No se importó el archivo. ${errors.slice(0, 3).join(" ")}`);
      return;
    }

    updateState({
      ...state,
      investments: [...state.investments, ...entries],
      offlineQueue: [...state.offlineQueue, ...entries.map((entry) => queueOfflineItem("investments", entry))],
    });
    setMessage(`${entries.length} inversiones importadas correctamente.`);
  }

  return (
    <Card title="Carga masiva por CSV" icon={FileUp}>
      <div className="grid gap-4">
        <p className="soft-panel p-3 text-sm font-semibold text-[var(--muted)]">
          Solo el perfil de propietario puede descargar plantillas e importar datos. Puedes repetir la carga con archivos nuevos cuando lo necesites.
        </p>
        <Field label="Tipo de información">
          <select className="input" value={kind} onChange={(event) => { setKind(event.target.value as CsvImportKind); setMessage(""); }}>
            {Object.entries(CSV_IMPORT_TEMPLATES).map(([value, option]) => (
              <option key={value} value={value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--cream)] p-4 text-sm font-semibold text-[var(--muted)]">
          {template.help}
          {kind === "investments" ? <p className="mt-2 break-words">Categorías: {CSV_INVESTMENT_CATEGORIES.join(", ")}.</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="secondary-button flex h-12 items-center justify-center gap-2 px-4" onClick={downloadTemplate} type="button">
            <Download size={18} />
            Descargar plantilla CSV
          </button>
          <label className="primary-button flex h-12 cursor-pointer items-center justify-center gap-2 px-4">
            <FileUp size={18} />
            Subir archivo CSV
            <input
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        </div>
        {message ? <p className="soft-panel p-3 text-sm font-bold text-[var(--olive)]" role="status">{message}</p> : null}
      </div>
    </Card>
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
      <button type="button" className="secondary-button h-12 text-sm" onClick={onClear}>Limpiar</button>
      <button type="button" className="secondary-button h-12 text-lg" onClick={() => onDigit(0)}>0</button>
      <button type="button" className="secondary-button h-12 text-sm" onClick={onBackspace}>Borrar</button>
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
      <span className="egg-size-field-label">huevos</span>
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
