"use client";

import {
  Building2,
  DollarSign,
  Egg,
  PiggyBank,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import {
  calculateInvestmentBreakdown,
  formatCop,
  formatNumber,
  getBirdsTotalInvestment,
  getGalponTotal,
} from "@/lib/calculations";
import type { FarmState, InvestmentItem, InvestmentCategory } from "@/lib/types";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const makeId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;

const investmentCategories: InvestmentCategory[] = [
  "galpon_construccion",
  "galpon_materiales_olga",
  "galpon_materiales_homecenter",
  "galpon_materiales_laroca",
  "gallinas_compra",
  "gallinas_alimento",
  "gallinas_medicina_vacunas",
  "gallinas_implementos",
  "gastos_semanales",
  "cuidandero",
  "otros",
];

const categoryLabels: Record<InvestmentCategory, string> = {
  galpon_construccion: "Galpon - Construccion",
  galpon_materiales_olga: "Galpon - Materiales OLGA",
  galpon_materiales_homecenter: "Galpon - Materiales Homecenter",
  galpon_materiales_laroca: "Galpon - Materiales La Roca",
  gallinas_compra: "Gallinas - Compra",
  gallinas_alimento: "Gallinas - Alimento",
  gallinas_medicina_vacunas: "Gallinas - Medicina/Vacunas",
  gallinas_implementos: "Gallinas - Implementos",
  gastos_semanales: "Gastos Semanales",
  cuidandero: "Cuidandero",
  otros: "Otros",
};

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
    <section className="floating-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="organic-illustration grid h-10 w-10 place-items-center rounded-[1.25rem] shadow-sm">
          <Icon size={20} />
        </div>
        <h3 className="text-lg font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function InvestmentSection({
  state,
  updateState,
}: {
  state: FarmState;
  updateState?: (next: FarmState, msg?: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    date: todayIso(),
    category: "galpon_construccion" as InvestmentCategory,
    subcategory: "",
    description: "",
    quantity: 1,
    unit: "unidad",
    unitPrice: 0,
    totalPrice: 0,
    supplier: "",
  });

  function submitInvestment(e: FormEvent) {
    e.preventDefault();
    if (!updateState) return;
    const next = { id: makeId("investment"), ...newItem };
    updateState(
      { ...state, investments: [...(state.investments ?? []), next] },
      "Investment saved.",
    );
    setNewItem({
      date: todayIso(),
      category: "galpon_construccion" as InvestmentCategory,
      subcategory: "",
      description: "",
      quantity: 1,
      unit: "unidad",
      unitPrice: 0,
      totalPrice: 0,
      supplier: "",
    });
    setShowForm(false);
  }

  function removeInvestment(id: string) {
    if (!updateState) return;
    updateState(
      {
        ...state,
        investments: (state.investments ?? []).filter((x) => x.id !== id),
      },
      "Removed.",
    );
  }

  const breakdown = useMemo(
    () => calculateInvestmentBreakdown(state.investments ?? []),
    [state.investments],
  );
  const galponTotal = useMemo(
    () => getGalponTotal(state.investments ?? []),
    [state.investments],
  );
  const birdsTotal = useMemo(
    () => getBirdsTotalInvestment(state.investments ?? []),
    [state.investments],
  );

  const chartData = useMemo(
    () =>
      breakdown.categories
        .filter((c) => c.amount > 0)
        .map((c) => ({
          name: c.label.replace("Galpon - ", "").replace("Gallinas - ", ""),
          amount: c.amount,
          fill: c.color,
        })),
    [breakdown],
  );

  const weeklyCosts = useMemo(() => {
    const weekly = state.investments?.filter(
      (i) => i.category === "gastos_semanales",
    ) ?? [];
    return weekly.sort(
      (a, b) => (a.date ?? "").localeCompare(b.date ?? ""),
    );
  }, [state.investments]);

  const totalRevenue = useMemo(
    () =>
      state.sales.reduce(
        (sum, s) => sum + s.cartons * s.pricePerCartonCop,
        0,
      ),
    [state.sales],
  );

  const totalExpenses = useMemo(
    () =>
      state.expenses.reduce((sum, e) => sum + e.amountCop, 0) +
      state.feedPurchases.reduce((sum, f) => sum + f.priceCop, 0),
    [state.feedPurchases, state.expenses],
  );

  const netBalance = totalRevenue - breakdown.total - totalExpenses;

  return (
    <div className="grid gap-5">
      <section className="floating-card tone-card tone-moss overflow-hidden p-5 text-[var(--foreground)] md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--clay)]">
              Resumen de inversion
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
              {formatCop(breakdown.total)}
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              Inversion total desde la construccion del galpon hasta la
              produccion de huevos. {formatCop(totalRevenue)} en ventas
              generadas hasta ahora.
            </p>
          </div>
          <div className="organic-illustration hidden h-28 w-28 shrink-0 place-items-center rounded-[2rem] md:grid">
            <PiggyBank className="text-[var(--forest)]" size={50} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-full bg-[var(--mustard)] px-5 py-3 text-sm font-black text-[#263429]">
            Galpon: {formatCop(galponTotal)}
          </div>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            Gallinas: {formatCop(birdsTotal)}
          </div>
          <div className="rounded-full bg-[var(--cream)] px-5 py-3 text-sm font-black text-[var(--olive)]">
            Balance:{" "}
            {netBalance <= 0 ? (
              <span className="text-[var(--clay)]">{formatCop(netBalance)}</span>
            ) : (
              <span className="text-[var(--forest)]">+{formatCop(netBalance)}</span>
            )}
          </div>
        </div>
      </section>

      {updateState && (
        <section className="floating-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="organic-illustration grid h-10 w-10 place-items-center rounded-[1.25rem] shadow-sm">
                <Plus size={20} />
              </div>
              <h3 className="text-lg font-black">Agregar inversion</h3>
            </div>
            {!showForm && (
              <button
                className="primary-button h-11 px-5 text-sm"
                onClick={() => setShowForm(true)}
              >
                <Plus size={16} /> Nueva inversion
              </button>
            )}
          </div>
          {showForm && (
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submitInvestment}>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Date</label>
                <input className="input" type="date" value={newItem.date}
                  onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Category</label>
                <select className="input" value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InvestmentCategory })}>
                  {investmentCategories.map((c) => (
                    <option key={c} value={c}>{categoryLabels[c]}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Subcategory</label>
                <input className="input" value={newItem.subcategory}
                  onChange={(e) => setNewItem({ ...newItem, subcategory: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Description</label>
                <input className="input" value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Quantity</label>
                <input className="input" inputMode="numeric" value={newItem.quantity || ""}
                  onChange={(e) => {
                    const q = parseInt(e.target.value) || 0;
                    setNewItem({ ...newItem, quantity: q, totalPrice: q * newItem.unitPrice });
                  }} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Unit</label>
                <input className="input" value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Unit price COP</label>
                <input className="input" inputMode="numeric" value={newItem.unitPrice || ""}
                  onChange={(e) => {
                    const p = parseInt(e.target.value) || 0;
                    setNewItem({ ...newItem, unitPrice: p, totalPrice: newItem.quantity * p });
                  }} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Total price COP</label>
                <input className="input" inputMode="numeric" value={newItem.totalPrice || ""}
                  onChange={(e) => setNewItem({ ...newItem, totalPrice: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[var(--muted)]">Supplier</label>
                <input className="input" value={newItem.supplier}
                  onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <button className="primary-button h-13 flex-1">
                  <Save size={17} /> Save
                </button>
                <button type="button" className="h-13 w-13 rounded-2xl bg-[var(--line)] grid place-items-center"
                  onClick={() => setShowForm(false)}>
                  <X size={18} />
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Galpon" icon={Building2}>
          <p className="text-3xl font-black">{formatCop(galponTotal)}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Incluye construccion (obra gris, mano de obra, transporte) y
            materiales de OLGA, Homecenter y La Roca.
          </p>
          <div className="mt-4 grid gap-2">
            {breakdown.categories
              .filter(
                (c) =>
                  c.key.startsWith("galpon_") && c.amount > 0,
              )
              .map((c) => (
                <div
                  key={c.key}
                  className="soft-panel flex items-center justify-between p-3"
                >
                  <span className="text-sm font-bold">{c.label.replace("Galpon - ", "")}</span>
                  <span className="text-sm font-black">
                    {formatCop(c.amount)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        <Card title="Gallinas" icon={Egg}>
          <p className="text-3xl font-black">{formatCop(birdsTotal)}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Incluye compra de 400 gallinas ponedoras, alimento desde febrero
            hasta junio, medicamentos, vacunas e implementos del galpon.
          </p>
          <div className="mt-4 grid gap-2">
            {breakdown.categories
              .filter(
                (c) =>
                  c.key.startsWith("gallinas_") && c.amount > 0,
              )
              .map((c) => (
                <div
                  key={c.key}
                  className="soft-panel flex items-center justify-between p-3"
                >
                  <span className="text-sm font-bold">{c.label.replace("Gallinas - ", "")}</span>
                  <span className="text-sm font-black">
                    {formatCop(c.amount)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        <Card title="Gastos Semanales" icon={TrendingDown}>
          <p className="text-3xl font-black">
            {formatCop(
              breakdown.byCategory.gastos_semanales ?? 0,
            )}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Costos operativos semanales durante el inicio de la produccion
            (alimento + cuidador + transporte).
          </p>
          <div className="mt-4 grid gap-2">
            {weeklyCosts.map((w) => (
              <div
                key={w.id}
                className="soft-panel flex items-center justify-between p-3"
              >
                <span className="text-sm font-bold">
                  {w.subcategory}
                </span>
                <span className="text-sm font-black">
                  {formatCop(w.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="floating-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="organic-illustration grid h-10 w-10 place-items-center rounded-[1.25rem] shadow-sm">
            <DollarSign size={20} />
          </div>
          <h3 className="text-lg font-black">
            Desglose de inversion por categoria
          </h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 8"
                stroke="var(--line)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatCop(value) : value
                }
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Analisis" icon={TrendingUp}>
          <div className="grid gap-4">
            <div className="soft-panel p-4">
              <p className="font-black">Costo total por gallina</p>
              <p className="mt-1 text-2xl font-black">
                {formatCop(
                  Math.round(birdsTotal / 400),
                )}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Inversion en aves + alimento + medicinas + implementos
                dividido entre 400 gallinas.
              </p>
            </div>
            <div className="soft-panel p-4">
              <p className="font-black">Costo del galpon por gallina</p>
              <p className="mt-1 text-2xl font-black">
                {formatCop(
                  Math.round(galponTotal / 400),
                )}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Infraestructura dividida entre la capacidad de 400 aves.
              </p>
            </div>
            <div className="soft-panel p-4">
              <p className="font-black">
                Punto de equilibrio estimado
              </p>
              <p className="mt-1 text-2xl font-black">
                {formatCop(
                  Math.round(breakdown.total / 30 / 300),
                )}{" "}
                / carton
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Para recuperar la inversion de {formatCop(breakdown.total)}{" "}
                necesitas vender ~{formatNumber(breakdown.total / 30 / 300)}{" "}
                cartones a ${formatCop(300)} cada uno. Con produccion actual
                de ~150 huevos/dia (~5 cartones), serian~
                {formatNumber(breakdown.total / 30 / 300 / 5 / 30)} meses.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Detalle de inversiones" icon={PiggyBank}>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid gap-2">
              {state.investments
                ?.filter((inv) => inv.totalPrice > 0)
                .sort((a, b) => b.totalPrice - a.totalPrice)
                .slice(0, 30)
                .map((inv) => (
                  <div
                    key={inv.id}
                    className="soft-panel flex items-center justify-between gap-2 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {inv.description}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {inv.subcategory}
                        {inv.supplier ? ` - ${inv.supplier}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-sm font-black">
                        {formatCop(inv.totalPrice)}
                      </span>
                      {updateState && (
                        <button
                          className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--line)] text-[var(--clay)]"
                          onClick={() => removeInvestment(inv.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              {(!state.investments ||
                state.investments.length === 0) && (
                <p className="text-sm font-semibold text-[var(--muted)]">
                  No hay inversiones registradas.
                </p>
              )}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
