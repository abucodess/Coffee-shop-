import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Calendar,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Calculator,
  XCircle,
  Award,
  Banknote,
  CreditCard,
  QrCode,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fmt, type Order } from "@/lib/pos-data";
import { usePos } from "@/lib/pos-store";
import { fetchOrdersByRange } from "@/lib/pos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  buildChartData,
  getDateRangeForFilter,
  getShopCurrentYearMonth,
  getShopTodayDateString,
  type ChartDataPoint,
  type DashboardFilterType,
} from "@/lib/dashboard-dates";
import { AdminRoute } from "@/auth";

function DashboardPage() {
  return (
    <AdminRoute>
      <Dashboard />
    </AdminRoute>
  );
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FUWA Japanese Fluffy Desserts" },
      { name: "description", content: "Sales analytics, revenue metrics and dessert performance for FUWA." },
      { property: "og:title", content: "Dashboard — FUWA Japanese Fluffy Desserts" },
      {
        property: "og:description",
        content: "Sales analytics, revenue metrics and dessert performance for FUWA.",
      },
    ],
  }),
  component: DashboardPage,
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Generate selectable years including past years
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - 8 + i).reverse();

function Dashboard() {
  const storeOrders = usePos((s) => s.orders);
  const menu = usePos((s) => s.menu);

  // 1. Filter state - Only the 5 allowed options
  const [filterType, setFilterType] = useState<DashboardFilterType>("today");
  const [selectedDate, setSelectedDate] = useState<string>(() => getShopTodayDateString());
  const [selectedYear, setSelectedYear] = useState<number>(() => getShopCurrentYearMonth().year);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getShopCurrentYearMonth().month);

  // Default custom range: past 7 days to today
  const [customStart, setCustomStart] = useState<string>(() => {
    const today = getShopTodayDateString();
    const [y = 2026, m = 1, d = 1] = today.split("-").map(Number);
    const prev = new Date(y, m - 1, d - 7);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getShopTodayDateString());

  // Data fetching state
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // 2. Compute date boundaries using the coffee shop's local timezone
  const dateFilterResult = useMemo(() => {
    return getDateRangeForFilter(filterType, {
      selectedDate,
      year: selectedYear,
      month: selectedMonth,
      startDate: customStart,
      endDate: customEnd,
    });
  }, [filterType, selectedDate, selectedYear, selectedMonth, customStart, customEnd]);

  const { start, end, label: periodLabel, badge: filterBadge } = dateFilterResult;

  const startTime = start?.getTime();
  const endTime = end?.getTime();

  // 3. Query orders from Supabase using date boundaries (or in-memory store in offline mode)
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setFetchError(null);

    if (!isSupabaseConfigured) {
      // In offline / fallback test environment, filter store orders consistently
      const res = storeOrders.filter((o) => {
        if (start && o.createdAt < start.getTime()) return false;
        if (end && o.createdAt > end.getTime()) return false;
        return true;
      });
      setFilteredOrders(res);
      setIsLoading(false);
      return;
    }

    // Query real Supabase data with server-side date range boundaries
    fetchOrdersByRange(start, end)
      .then((data) => {
        if (!isCancelled) {
          setFilteredOrders(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Dashboard fetch error:", err);
          setFetchError("Failed to load dashboard data. Please try again.");
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [startTime, endTime, filterType, refreshTrigger, storeOrders, start, end]);

  // 4. Dynamic metrics calculations (ONLY paid orders contribute to revenue/sales)
  const paidOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === "paid"),
    [filteredOrders],
  );

  const cancelledOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === "cancelled"),
    [filteredOrders],
  );

  const totalSales = useMemo(() => paidOrders.reduce((sum, o) => sum + o.total, 0), [paidOrders]);

  const totalPaidOrders = paidOrders.length;
  const avgOrderValue = totalPaidOrders > 0 ? totalSales / totalPaidOrders : 0;

  const cashSales = useMemo(
    () => paidOrders.filter((o) => o.payment === "cash").reduce((sum, o) => sum + o.total, 0),
    [paidOrders],
  );

  const cardSales = useMemo(
    () => paidOrders.filter((o) => o.payment === "card").reduce((sum, o) => sum + o.total, 0),
    [paidOrders],
  );

  const upiSales = useMemo(
    () => paidOrders.filter((o) => o.payment === "upi").reduce((sum, o) => sum + o.total, 0),
    [paidOrders],
  );

  const cashPct = totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0;
  const cardPct = totalSales > 0 ? Math.round((cardSales / totalSales) * 100) : 0;
  const upiPct = totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0;

  const cancelledSalesTotal = useMemo(
    () => cancelledOrders.reduce((sum, o) => sum + o.total, 0),
    [cancelledOrders],
  );

  // Best-selling products using historical order-item snapshots (excluded cancelled orders)
  const bestSellers = useMemo(() => {
    const counts = new Map<string, { qty: number; revenue: number }>();
    for (const order of paidOrders) {
      for (const line of order.lines) {
        const cur = counts.get(line.name) || { qty: 0, revenue: 0 };
        cur.qty += line.qty;
        cur.revenue += line.price * line.qty;
        counts.set(line.name, cur);
      }
    }
    return [...counts.entries()]
      .map(([name, stat]) => ({ name, qty: stat.qty, revenue: stat.revenue }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 5);
  }, [paidOrders]);

  const maxBestSellerQty = bestSellers[0]?.qty ?? 1;

  // 5. Sales chart data with dynamic grouping based on selected filter
  const chartData = useMemo(() => {
    return buildChartData(filterType, start, end, paidOrders);
  }, [filterType, start, end, paidOrders]);

  const chartSubtitle = useMemo(() => {
    switch (filterType) {
      case "today":
      case "date":
        return "Hourly sales breakdown";
      case "month":
        return "Daily sales breakdown";
      case "custom": {
        if (!start || !end) return "Sales breakdown";
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 31) return "Daily sales breakdown";
        if (diffDays <= 180) return "Weekly sales breakdown";
        return "Monthly sales breakdown";
      }
      case "all":
      default:
        return "Monthly sales breakdown";
    }
  }, [filterType, start, end]);

  // PDF report download for the current filtered range
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const { generateSalesPdfReport } = await import("@/lib/sales-pdf");
      generateSalesPdfReport({
        timeframe: periodLabel,
        generatedAt: new Date(),
        orders: paidOrders,
        menu,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header & Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Dashboard</h1>
            {isLoading && <span className="font-mono text-xs text-ink-soft">Loading...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshTrigger((c) => c + 1)}
              disabled={isLoading}
              title="Refresh data"
              className="press flex items-center gap-1.5 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink shadow-card transition-colors hover:bg-cream"
            >
              <RefreshCw className="size-3.5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting || isLoading}
              className="press flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-extrabold text-coffee shadow-card disabled:opacity-50"
            >
              <Download className="size-4 stroke-[2.5]" />
              {isExporting ? "Generating PDF…" : "Download PDF Report"}
            </button>
          </div>
        </div>

        {/* Date Filter Bar: Exactly the 5 requested options */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-2xl border border-fuwa-brown/15 bg-fuwa-surface p-1 text-xs font-bold shadow-xs">
            <button
              type="button"
              data-testid="filter-today"
              onClick={() => setFilterType("today")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 transition-colors ${
                filterType === "today"
                  ? "bg-fuwa-orange text-white shadow-xs"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              data-testid="filter-date"
              onClick={() => setFilterType("date")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 transition-colors ${
                filterType === "date"
                  ? "bg-fuwa-orange text-white shadow-xs"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              Select date
            </button>
            <button
              type="button"
              data-testid="filter-month"
              onClick={() => setFilterType("month")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 transition-colors ${
                filterType === "month"
                  ? "bg-fuwa-orange text-white shadow-xs"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              Select month
            </button>
            <button
              type="button"
              data-testid="filter-custom"
              onClick={() => setFilterType("custom")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 transition-colors ${
                filterType === "custom"
                  ? "bg-fuwa-orange text-white shadow-xs"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              Custom date range
            </button>
            <button
              type="button"
              data-testid="filter-all"
              onClick={() => setFilterType("all")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 transition-colors ${
                filterType === "all"
                  ? "bg-fuwa-orange text-white shadow-xs"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              All time
            </button>
          </div>

          {/* Sub-inputs when specific filter options are active */}
          {filterType === "date" && (
            <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-bold shadow-card">
              <Calendar className="size-3.5 text-ink-soft" />
              <label htmlFor="select-date-picker" className="text-ink-soft">
                Date:
              </label>
              <input
                id="select-date-picker"
                aria-label="Select date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono text-xs font-bold text-ink outline-none cursor-pointer"
              />
            </div>
          )}

          {filterType === "month" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-bold shadow-card">
              <Calendar className="size-3.5 text-ink-soft" />
              <label htmlFor="select-month-picker" className="text-ink-soft">
                Month:
              </label>
              <select
                id="select-month-picker"
                aria-label="Select month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-lg border border-ink/15 bg-cream/50 px-2 py-0.5 font-bold text-ink outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <label htmlFor="select-year-picker" className="text-ink-soft">
                Year:
              </label>
              <select
                id="select-year-picker"
                aria-label="Select year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-ink/15 bg-cream/50 px-2 py-0.5 font-mono font-bold text-ink outline-none cursor-pointer"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterType === "custom" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-xs font-bold shadow-card">
              <Calendar className="size-3.5 text-ink-soft" />
              <label htmlFor="custom-start-picker" className="text-ink-soft">
                From:
              </label>
              <input
                id="custom-start-picker"
                aria-label="Start date"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent font-mono text-xs font-bold text-ink outline-none cursor-pointer"
              />
              <span className="text-ink-soft">to</span>
              <label htmlFor="custom-end-picker" className="text-ink-soft">
                To:
              </label>
              <input
                id="custom-end-picker"
                aria-label="End date"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent font-mono text-xs font-bold text-ink outline-none cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Clear display of currently active filter and period */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="rounded-lg bg-amber/20 px-2.5 py-0.5 font-mono text-xs font-extrabold uppercase tracking-wider text-amber-deep">
            {filterBadge}
          </span>
          <span className="text-ink" data-testid="selected-period-label">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-tomato/30 bg-tomato/10 p-4 text-sm font-bold text-tomato">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => setRefreshTrigger((c) => c + 1)}
            className="rounded-lg bg-tomato px-3 py-1 text-xs text-cream hover:opacity-90"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row: 2 cols on mobile, 3 on tablet, 5 on desktop */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <Stat
            dark
            icon={TrendingUp}
            label="Total Sales"
            value={fmt(totalSales)}
            sub={`${totalPaidOrders} paid orders`}
          />
        </div>
        <Stat
          icon={CheckCircle2}
          label="Paid Orders"
          value={String(totalPaidOrders)}
          sub={`Avg ${fmt(avgOrderValue)} / order`}
        />
        <Stat
          icon={Calculator}
          label="Average Order Value"
          value={fmt(avgOrderValue)}
          sub={`across ${totalPaidOrders} orders`}
        />
        <Stat
          icon={XCircle}
          label="Cancelled Orders"
          value={String(cancelledOrders.length)}
          sub="Excluded from revenue"
        />
        <Stat
          icon={Award}
          label="Top Item"
          value={bestSellers[0]?.name ?? "—"}
          sub={bestSellers[0] ? `${bestSellers[0].qty} sold` : "No sales yet"}
          small
        />
      </section>

      {/* Sales Chart Section */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Sales Chart</h2>
            <p className="font-mono text-xs text-ink-soft">{chartSubtitle}</p>
          </div>
          <div className="font-mono text-xs font-bold text-ink-soft">
            Total: <span className="text-ink font-bold">{fmt(totalSales)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm font-bold text-ink-soft">
            Loading...
          </div>
        ) : paidOrders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-cream/30 p-6 text-center">
            <p className="text-sm font-bold text-ink-soft">No sales recorded for this period.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(43,35,26,0.08)"
                />
                <XAxis
                  dataKey="label"
                  stroke="#6f6252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(43,35,26,0.15)" }}
                />
                <YAxis
                  stroke="#6f6252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="sales" fill="#B64608" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Bottom Section: Best Sellers and Payments */}
      <section className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink">Best sellers</h2>
            <span className="font-mono text-xs font-bold text-ink-soft">
              {bestSellers.length} items ranked
            </span>
          </div>
          <div className="space-y-3.5">
            {bestSellers.map((item, idx) => (
              <div key={item.name} className="group">
                <div className="flex items-center justify-between text-sm font-bold text-ink">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span
                      className={`grid size-6 place-items-center rounded-lg text-xs font-black shrink-0 ${
                        idx === 0
                          ? "bg-amber text-coffee shadow-xs"
                          : idx === 1
                            ? "bg-cream border border-ink/15 text-coffee font-extrabold"
                            : idx === 2
                              ? "bg-sand text-coffee"
                              : "bg-ink/5 text-ink-soft"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-soft group-hover:text-ink">
                    {item.qty} {item.qty === 1 ? "unit" : "units"} ·{" "}
                    <span className="font-bold text-coffee">{fmt(item.revenue)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-cream overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber transition-all duration-500"
                    style={{ width: `${(item.qty / maxBestSellerQty) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {bestSellers.length === 0 && (
              <p className="text-sm font-bold text-ink-soft">No sales recorded for this period.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
          <h2 className="mb-4 text-lg font-extrabold text-ink">Payments</h2>
          <div className="space-y-1">
            <Row
              label="Cash Sales"
              value={fmt(cashSales)}
              dot="bg-mint"
              icon={Banknote}
              percentage={cashPct}
            />
            <Row
              label="Card Sales"
              value={fmt(cardSales)}
              dot="bg-coffee"
              icon={CreditCard}
              percentage={cardPct}
            />
            <Row
              label="UPI Sales"
              value={fmt(upiSales)}
              dot="bg-amber"
              icon={QrCode}
              percentage={upiPct}
            />
          </div>

          <div className="mt-4 flex justify-between border-t border-dashed border-ink/20 pt-3 font-bold text-ink">
            <span className="text-sm">Total Sales</span>
            <span className="font-mono text-base font-black text-coffee">{fmt(totalSales)}</span>
          </div>

          <div className="mt-4 rounded-xl border border-tomato/20 bg-tomato/5 p-3">
            <div className="flex items-center justify-between text-xs font-bold text-tomato">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-tomato" />
                Cancelled Orders ({cancelledOrders.length})
              </span>
              <span className="font-mono">{fmt(cancelledSalesTotal)}</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink-soft">
              Excluded from revenue and best-selling metrics
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  dark,
  small,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
  small?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`card-hover flex flex-col justify-between rounded-2xl border p-4 sm:p-5 shadow-card transition-all ${
        dark
          ? "border-fuwa-brown/20 bg-fuwa-brown text-fuwa-surface"
          : "border-fuwa-brown/10 bg-fuwa-surface text-fuwa-brown"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-mono text-[11px] font-bold uppercase tracking-wider sm:text-xs ${
            dark ? "text-fuwa-cream/70" : "text-fuwa-brown/65"
          }`}
        >
          {label}
        </span>
        {Icon && (
          <span
            className={`grid size-7 place-items-center rounded-lg ${
              dark ? "bg-fuwa-orange text-white" : "bg-fuwa-cream text-fuwa-orange"
            }`}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div
        className={`mt-2 font-bold ${
          small ? "text-lg font-extrabold sm:text-xl truncate" : "font-mono text-2xl sm:text-3xl"
        } ${dark ? "text-fuwa-cream" : "text-fuwa-brown"}`}
      >
        {value}
      </div>
      <div
        className={`mt-1 truncate text-xs font-semibold ${
          dark ? "text-fuwa-cream/65" : "text-fuwa-brown/60"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  dot,
  icon: Icon,
  percentage,
}: {
  label: string;
  value: string;
  dot: string;
  icon?: React.ComponentType<{ className?: string }>;
  percentage?: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm font-bold text-ink">
      <span className="flex items-center gap-2">
        {Icon ? (
          <span className="grid size-6 place-items-center rounded-md bg-cream text-ink-soft">
            <Icon className="size-3.5" />
          </span>
        ) : (
          <span className={`size-2.5 rounded-full ${dot}`} />
        )}
        <span>{label}</span>
      </span>
      <div className="flex items-center gap-2">
        {percentage !== undefined && !isNaN(percentage) && (
          <span className="font-mono text-xs font-semibold text-ink-soft">
            {percentage}%
          </span>
        )}
        <span className="font-mono">{value}</span>
      </div>
    </div>
  );
}

function CustomChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}) {
  if (active && payload && payload.length && payload[0]) {
    const data: ChartDataPoint = payload[0].payload;
    return (
      <div className="rounded-xl border border-ink/15 bg-paper p-3 shadow-card text-xs">
        <div className="font-mono font-bold text-ink-soft mb-1">
          {data.tooltipLabel || data.label}
        </div>
        <div className="flex items-center justify-between gap-4 font-bold text-ink">
          <span>Sales:</span>
          <span className="font-mono text-amber-deep text-sm">{fmt(data.sales)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-bold text-ink-soft">
          <span>Paid Orders:</span>
          <span className="font-mono">{data.orders}</span>
        </div>
      </div>
    );
  }
  return null;
}
