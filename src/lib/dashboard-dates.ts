import { fmt, type Order } from "./pos-data";

export const SHOP_TIMEZONE = "Asia/Kolkata";

export type DashboardFilterType = "today" | "date" | "month" | "custom" | "all";

export interface FilterOptions {
  selectedDate?: string; // YYYY-MM-DD
  year?: number;
  month?: number; // 1 to 12
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface DateFilterResult {
  start: Date | null;
  end: Date | null;
  label: string;
  badge: string;
}

export interface ChartDataPoint {
  key: string;
  label: string;
  tooltipLabel: string;
  sales: number;
  orders: number;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the shop's timezone
 */
export function getShopTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns current year and month (1-12) in the shop's timezone
 */
export function getShopCurrentYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "10", 10);
  return { year, month };
}

/**
 * Extract hour (0-23) in shop's timezone
 */
export function getHourInShopTz(timestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const hourPart = parts.find((p) => p.type === "hour");
  const val = parseInt(hourPart?.value || "0", 10);
  return val === 24 ? 0 : val;
}

/**
 * Extract day of month (1-31) in shop's timezone
 */
export function getDayInShopTz(timestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    day: "numeric",
  }).formatToParts(new Date(timestamp));
  const dayPart = parts.find((p) => p.type === "day");
  return parseInt(dayPart?.value || "1", 10);
}

/**
 * Extract year and month (1-12) in shop's timezone
 */
export function getYearMonthInShopTz(timestamp: number): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(timestamp));
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
  return { year, month };
}

export function formatShopDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShopShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShopMonth(year: number, month: number): string {
  const d = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Compute date boundaries and display labels for a selected filter
 */
export function getDateRangeForFilter(
  type: DashboardFilterType,
  options: FilterOptions = {},
): DateFilterResult {
  switch (type) {
    case "today": {
      const todayStr = getShopTodayDateString();
      const start = new Date(`${todayStr}T00:00:00.000+05:30`);
      const end = new Date(`${todayStr}T23:59:59.999+05:30`);
      return {
        start,
        end,
        label: `Today (${formatShopDate(start)})`,
        badge: "Today",
      };
    }

    case "date": {
      const dateStr = options.selectedDate || getShopTodayDateString();
      const start = new Date(`${dateStr}T00:00:00.000+05:30`);
      const end = new Date(`${dateStr}T23:59:59.999+05:30`);
      return {
        start,
        end,
        label: formatShopDate(start),
        badge: "Specific Date",
      };
    }

    case "month": {
      const currentYM = getShopCurrentYearMonth();
      const year = options.year ?? currentYM.year;
      const month = options.month ?? currentYM.month;
      const mStr = String(month).padStart(2, "0");
      const start = new Date(`${year}-${mStr}-01T00:00:00.000+05:30`);
      const daysInMonth = new Date(year, month, 0).getDate();
      const end = new Date(
        `${year}-${mStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999+05:30`,
      );
      return {
        start,
        end,
        label: formatShopMonth(year, month),
        badge: "Monthly View",
      };
    }

    case "custom": {
      let sStr = options.startDate || getShopTodayDateString();
      let eStr = options.endDate || getShopTodayDateString();
      if (sStr > eStr) {
        [sStr, eStr] = [eStr, sStr];
      }
      const start = new Date(`${sStr}T00:00:00.000+05:30`);
      const end = new Date(`${eStr}T23:59:59.999+05:30`);
      return {
        start,
        end,
        label: `${formatShopShortDate(start)} – ${formatShopShortDate(end)}`,
        badge: "Custom Range",
      };
    }

    case "all":
    default:
      return {
        start: null,
        end: null,
        label: "All Time (Historical)",
        badge: "All Time",
      };
  }
}

/**
 * Builds real chart data points based on selected filter and paid orders
 */
export function buildChartData(
  filterType: DashboardFilterType,
  start: Date | null,
  end: Date | null,
  paidOrders: Order[],
): ChartDataPoint[] {
  // 1. Hourly grouping for Today or Specific Date
  if (filterType === "today" || filterType === "date") {
    const hourly: ChartDataPoint[] = Array.from({ length: 24 }, (_, h) => {
      const hStr = String(h).padStart(2, "0");
      return {
        key: String(h),
        label: `${hStr}:00`,
        tooltipLabel: `${hStr}:00 – ${hStr}:59`,
        sales: 0,
        orders: 0,
      };
    });

    for (const order of paidOrders) {
      const h = getHourInShopTz(order.createdAt);
      if (h >= 0 && h < 24) {
        hourly[h].sales += order.total;
        hourly[h].orders += 1;
      }
    }

    return hourly.map((p) => ({
      ...p,
      sales: Math.round(p.sales * 100) / 100,
    }));
  }

  // 2. Daily grouping for Selected Month
  if (filterType === "month" && start) {
    const { year: sYear, month: sMonth } = getYearMonthInShopTz(start.getTime());
    const daysInMonth = new Date(sYear, sMonth, 0).getDate();
    const monthName = new Intl.DateTimeFormat("en-GB", {
      timeZone: SHOP_TIMEZONE,
      month: "short",
    }).format(start);

    const daily: ChartDataPoint[] = Array.from({ length: daysInMonth }, (_, idx) => {
      const d = idx + 1;
      return {
        key: String(d),
        label: `${d}`,
        tooltipLabel: `${monthName} ${d}, ${sYear}`,
        sales: 0,
        orders: 0,
      };
    });

    for (const order of paidOrders) {
      const d = getDayInShopTz(order.createdAt);
      if (d >= 1 && d <= daysInMonth) {
        daily[d - 1].sales += order.total;
        daily[d - 1].orders += 1;
      }
    }

    return daily.map((p) => ({
      ...p,
      sales: Math.round(p.sales * 100) / 100,
    }));
  }

  // 3. Custom Range: daily for shorter ranges (<= 31 days), weekly (32-180 days) or monthly (> 180 days)
  if (filterType === "custom" && start && end) {
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
      // Daily grouping
      const days: ChartDataPoint[] = [];
      const cur = new Date(start);
      while (cur.getTime() <= end.getTime()) {
        const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE }).format(cur);
        const shortLabel = new Intl.DateTimeFormat("en-GB", {
          timeZone: SHOP_TIMEZONE,
          day: "numeric",
          month: "short",
        }).format(cur);
        const fullLabel = new Intl.DateTimeFormat("en-GB", {
          timeZone: SHOP_TIMEZONE,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(cur);

        days.push({
          key: dateStr,
          label: shortLabel,
          tooltipLabel: fullLabel,
          sales: 0,
          orders: 0,
        });

        cur.setDate(cur.getDate() + 1);
      }

      const map = new Map(days.map((d) => [d.key, d]));
      for (const order of paidOrders) {
        const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE }).format(
          new Date(order.createdAt),
        );
        const bucket = map.get(dateKey);
        if (bucket) {
          bucket.sales += order.total;
          bucket.orders += 1;
        }
      }

      return days.map((p) => ({ ...p, sales: Math.round(p.sales * 100) / 100 }));
    } else if (diffDays <= 180) {
      // Weekly grouping
      const weeks: (ChartDataPoint & { startMs: number; endMs: number })[] = [];
      let curStart = new Date(start);
      let weekNum = 1;

      while (curStart.getTime() <= end.getTime()) {
        const curEnd = new Date(curStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        const actualEnd = curEnd.getTime() > end.getTime() ? end : curEnd;
        const labelStart = new Intl.DateTimeFormat("en-GB", {
          timeZone: SHOP_TIMEZONE,
          day: "numeric",
          month: "short",
        }).format(curStart);
        const labelEnd = new Intl.DateTimeFormat("en-GB", {
          timeZone: SHOP_TIMEZONE,
          day: "numeric",
          month: "short",
        }).format(actualEnd);

        weeks.push({
          key: `W${weekNum}`,
          label: `${labelStart}–${labelEnd}`,
          tooltipLabel: `${labelStart} – ${labelEnd}`,
          sales: 0,
          orders: 0,
          startMs: curStart.getTime(),
          endMs: actualEnd.getTime(),
        });

        curStart = new Date(curEnd.getTime() + 1);
        weekNum++;
      }

      for (const order of paidOrders) {
        const bucket = weeks.find(
          (w) => order.createdAt >= w.startMs && order.createdAt <= w.endMs,
        );
        if (bucket) {
          bucket.sales += order.total;
          bucket.orders += 1;
        }
      }

      return weeks.map((w) => ({
        key: w.key,
        label: w.label,
        tooltipLabel: w.tooltipLabel,
        sales: Math.round(w.sales * 100) / 100,
        orders: w.orders,
      }));
    } else {
      // Monthly grouping for longer custom ranges
      return buildMonthlyGrouping(start, end, paidOrders);
    }
  }

  // 4. All time: monthly sales
  if (paidOrders.length === 0) {
    const now = new Date();
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: SHOP_TIMEZONE,
      month: "short",
      year: "numeric",
    }).format(now);
    return [{ key: "current", label, tooltipLabel: label, sales: 0, orders: 0 }];
  }

  let minTime = Infinity;
  for (const o of paidOrders) {
    if (o.createdAt < minTime) minTime = o.createdAt;
  }
  const firstDate = new Date(minTime);
  const now = new Date();
  return buildMonthlyGrouping(firstDate, now, paidOrders);
}

function buildMonthlyGrouping(
  startDate: Date,
  endDate: Date,
  paidOrders: Order[],
): ChartDataPoint[] {
  const { year: startY, month: startM } = getYearMonthInShopTz(startDate.getTime());
  const { year: endY, month: endM } = getYearMonthInShopTz(endDate.getTime());

  const months: ChartDataPoint[] = [];
  let y = startY;
  let m = startM;

  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const d = new Date(`${key}-01T00:00:00+05:30`);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: SHOP_TIMEZONE,
      month: "short",
      year: "2-digit",
    }).format(d);
    const fullLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: SHOP_TIMEZONE,
      month: "long",
      year: "numeric",
    }).format(d);

    months.push({ key, label, tooltipLabel: fullLabel, sales: 0, orders: 0 });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const map = new Map(months.map((item) => [item.key, item]));
  for (const order of paidOrders) {
    const { year, month } = getYearMonthInShopTz(order.createdAt);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const bucket = map.get(key);
    if (bucket) {
      bucket.sales += order.total;
      bucket.orders += 1;
    }
  }

  return months.map((p) => ({ ...p, sales: Math.round(p.sales * 100) / 100 }));
}
