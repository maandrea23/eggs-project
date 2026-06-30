"use client";

import {
  Building2,
  DollarSign,
  Egg,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateInvestmentBreakdown,
  formatCop,
  formatNumber,
  getBirdsTotalInvestment,
  getGalponTotal,
} from "@/lib/calculations";
import type { FarmState, InvestmentItem } from "@/lib/types";

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
}: {
  state: FarmState;
}) {
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
                    className="soft-panel flex items-center justify-between p-3"
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
                    <span className="ml-3 shrink-0 text-sm font-black">
                      {formatCop(inv.totalPrice)}
                    </span>
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
