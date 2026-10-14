import { fmt, SHOP_INFO, type Order, type MenuItem } from "./pos-data";

interface SalesPdfData {
  timeframe: string;
  generatedAt: Date;
  orders: Order[];
  menu: MenuItem[];
}

function escapeHtml(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface DayGroup {
  dateKey: string;
  timestamp: number;
  dateFormatted: string;
  fullDateTitle: string;
  orders: Order[];
  totalSales: number;
  totalOrders: number;
  totalUnits: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
}

interface ProductStat {
  name: string;
  category: string;
  unitPrice: number;
  qtySold: number;
  revenue: number;
}

export function generateSalesPdfReport({ timeframe, generatedAt, orders, menu }: SalesPdfData) {
  // Only include paid orders for sales revenue
  const paidOrders = orders.filter((o) => o.status === "paid");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  const totalSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalSubtotal = paidOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const cashSales = paidOrders
    .filter((o) => o.payment === "cash")
    .reduce((sum, o) => sum + o.total, 0);
  const upiSales = paidOrders
    .filter((o) => o.payment === "upi")
    .reduce((sum, o) => sum + o.total, 0);
  const cardSales = paidOrders
    .filter((o) => o.payment === "card")
    .reduce((sum, o) => sum + o.total, 0);
  const avgTicket = paidOrders.length ? totalSales / paidOrders.length : 0;

  // 1. Group paid orders day by day in chronological order
  const dayGroupsMap = new Map<string, DayGroup>();

  paidOrders.forEach((order) => {
    const d = new Date(order.createdAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dateFormatted = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const fullDateTitle = d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    let group = dayGroupsMap.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        timestamp: dayStart,
        dateFormatted,
        fullDateTitle,
        orders: [],
        totalSales: 0,
        totalOrders: 0,
        totalUnits: 0,
        cashSales: 0,
        upiSales: 0,
        cardSales: 0,
      };
      dayGroupsMap.set(dateKey, group);
    }

    const orderUnits = order.lines.reduce((s, l) => s + l.qty, 0);
    group.orders.push(order);
    group.totalOrders += 1;
    group.totalUnits += orderUnits;
    group.totalSales += order.total;

    if (order.payment === "cash") group.cashSales += order.total;
    else if (order.payment === "upi") group.upiSales += order.total;
    else if (order.payment === "card") group.cardSales += order.total;
  });

  // Sort day groups chronologically (Day 1 -> Day 31)
  const dayGroups = [...dayGroupsMap.values()].sort((a, b) => a.timestamp - b.timestamp);

  // Sort orders within each day group chronologically by time
  dayGroups.forEach((group) => {
    group.orders.sort((a, b) => a.createdAt - b.createdAt);
  });

  // 2. Aggregate product sales (how many of each product was sold)
  const menuCategoryMap = new Map<string, string>();
  menu.forEach((m) => {
    if (m.name && m.category) {
      menuCategoryMap.set(m.name.trim().toLowerCase(), m.category);
    }
  });

  const productStatsMap = new Map<string, ProductStat>();

  paidOrders.forEach((order) => {
    order.lines.forEach((line) => {
      const trimmedName = line.name.trim();
      const cat =
        menuCategoryMap.get(trimmedName.toLowerCase()) ||
        line.category ||
        "Fluffy Desserts";

      const existing = productStatsMap.get(trimmedName) || {
        name: trimmedName,
        category: cat,
        unitPrice: line.price,
        qtySold: 0,
        revenue: 0,
      };
      existing.qtySold += line.qty;
      existing.revenue += line.price * line.qty;
      productStatsMap.set(trimmedName, existing);
    });
  });

  // Sort products primarily by quantity sold descending, then revenue descending
  const productRows = [...productStatsMap.values()].sort(
    (a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue,
  );
  const totalUnitsSold = productRows.reduce((sum, p) => sum + p.qtySold, 0);

  // Category breakdown
  const categoryStatsMap = new Map<string, { qty: number; revenue: number }>();
  productRows.forEach((p) => {
    const cat = categoryStatsMap.get(p.category) || { qty: 0, revenue: 0 };
    cat.qty += p.qtySold;
    cat.revenue += p.revenue;
    categoryStatsMap.set(p.category, cat);
  });
  const categoryRows = [...categoryStatsMap.entries()].sort((a, b) => b[1].qty - a[1].qty);

  // Percentages for payment methods
  const cashPct = totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0;
  const upiPct = totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0;
  const cardPct = totalSales > 0 ? Math.round((cardSales / totalSales) * 100) : 0;

  // HTML Report Content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales & Products Report — ${escapeHtml(SHOP_INFO.fullName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Space+Mono:wght@400;700&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Nunito', 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #2b231a;
      background: #faf7f2;
      padding: 24px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mono {
      font-family: 'Space Mono', monospace;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px dashed #d1c7b8;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .logo-badge {
      display: inline-block;
      background: #2b231a;
      color: #f6edd9;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #2b231a;
      letter-spacing: -0.02em;
    }
    .meta-right {
      text-align: right;
      font-size: 11.5px;
      color: #6c5e50;
      line-height: 1.5;
    }
    .meta-right strong {
      color: #2b231a;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #ffffff;
      border: 1px solid #e5dcce;
      border-radius: 12px;
      padding: 13px 14px;
    }
    .stat-card.dark {
      background: #2b231a;
      color: #f6edd9;
      border: 1px solid #2b231a;
    }
    .stat-card.dark .stat-label {
      color: rgba(246, 237, 217, 0.7);
    }
    .stat-card.dark .stat-value {
      color: #f6edd9;
    }
    .stat-card.dark .stat-sub {
      color: #e5b045;
    }
    .stat-label {
      font-family: 'Space Mono', monospace;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7d7265;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 900;
      color: #2b231a;
    }
    .stat-sub {
      font-size: 11px;
      font-weight: 600;
      color: #7d7265;
      margin-top: 3px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 900;
      margin-top: 24px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      color: #2b231a;
      border-bottom: 1px solid #e5dcce;
      padding-bottom: 6px;
    }
    .section-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: #7d7265;
    }
    .table-container {
      background: #ffffff;
      border: 1px solid #e5dcce;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 11.5px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #f4eee2;
      color: #4a3e31;
      font-family: 'Space Mono', monospace;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 9px 12px;
      border-bottom: 1px solid #e5dcce;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #f2ede4;
      color: #2b231a;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td {
      background: #faf8f5;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    tfoot td {
      background: #fbf8f3;
      border-top: 2px solid #e5dcce;
      font-weight: 800;
      padding: 10px 12px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-upi {
      background: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
    }
    .badge-cash {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-card {
      background: #f3f4f6;
      color: #1f2937;
      border: 1px solid #e5e7eb;
    }
    .badge-cat {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .day-block {
      margin-bottom: 22px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .day-header {
      background: #f4eee2;
      border: 1px solid #e5dcce;
      border-bottom: none;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .day-header .day-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #2b231a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .day-header .day-metrics {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
      font-family: 'Space Mono', monospace;
      color: #6c5e50;
    }
    .day-header .day-total-badge {
      background: #2b231a;
      color: #ffffff;
      padding: 3px 9px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
    }
    .day-table-wrap {
      border: 1px solid #e5dcce;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    .items-list {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }
    .items-list li {
      margin-bottom: 2px;
      color: #3b3228;
    }
    .category-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .category-pill {
      background: #ffffff;
      border: 1px solid #e5dcce;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .category-pill strong {
      color: #2b231a;
    }
    .footer {
      border-top: 1px dashed #d1c7b8;
      padding-top: 14px;
      margin-top: 26px;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #7d7265;
      font-family: 'Space Mono', monospace;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .day-block {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .page-break {
        page-break-before: always;
      }
      tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <!-- Report Header -->
  <div class="header">
    <div>
      <div class="logo-badge">FUWA POS · OFFICIAL REPORT</div>
      <h1 class="title">Sales &amp; Products Report</h1>
      <div class="mono" style="font-size: 12.5px; color: #7d7265; margin-top: 4px;">
        Reporting Period: <strong style="color: #2b231a;">${escapeHtml(timeframe)}</strong>
      </div>
    </div>
    <div class="meta-right mono">
      <div>Store: <strong>${escapeHtml(SHOP_INFO.fullName)}</strong></div>
      <div>Address: <strong>${escapeHtml(SHOP_INFO.addressLine1)} (PIN: ${escapeHtml(SHOP_INFO.pin)})</strong></div>
      <div>Contact: <strong>${escapeHtml(SHOP_INFO.phone)}</strong> · FSSAI: <strong>${escapeHtml(SHOP_INFO.fssai)}</strong></div>
      <div>Generated: <strong>${generatedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong> (Till 01)</div>
    </div>
  </div>

  <!-- Key Metrics Executive Overview -->
  <div class="stats-grid">
    <div class="stat-card dark">
      <div class="stat-label">Total Net Revenue</div>
      <div class="stat-value mono">${fmt(totalSales)}</div>
      <div class="stat-sub">${paidOrders.length} Completed Orders${cancelledOrders.length > 0 ? ` (${cancelledOrders.length} cancelled)` : ""}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Units Sold</div>
      <div class="stat-value mono">${totalUnitsSold}</div>
      <div class="stat-sub">Across ${productRows.length} distinct products</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Order Value</div>
      <div class="stat-value mono">${fmt(avgTicket)}</div>
      <div class="stat-sub">Average ticket per customer</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Payment Modes Split</div>
      <div class="mono" style="font-size: 11px; font-weight: 700; color: #4338ca; margin-top: 2px;">
        UPI: ${fmt(upiSales)} (${upiPct}%)
      </div>
      <div class="mono" style="font-size: 11px; font-weight: 700; color: #065f46;">
        Cash: ${fmt(cashSales)} (${cashPct}%)
      </div>
      <div class="mono" style="font-size: 11px; font-weight: 700; color: #1f2937;">
        Card: ${fmt(cardSales)} (${cardPct}%)
      </div>
    </div>
  </div>

  <!-- Multi-Day Executive Performance Table (Visible when report spans more than 1 day) -->
  ${
    dayGroups.length > 1
      ? `
  <div class="section-title">
    <span>Daily Sales Summary (${dayGroups.length} Active Days in ${escapeHtml(timeframe)})</span>
    <span class="section-subtitle mono">Aggregated by calendar date</span>
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th class="text-center">Orders</th>
          <th class="text-center">Units Sold</th>
          <th class="text-right">Cash</th>
          <th class="text-right">UPI</th>
          <th class="text-right">Card</th>
          <th class="text-right">Day Total</th>
          <th class="text-right">% of Period</th>
        </tr>
      </thead>
      <tbody>
        ${dayGroups
          .map((d) => {
            const share = totalSales > 0 ? ((d.totalSales / totalSales) * 100).toFixed(1) : "0.0";
            return `
          <tr>
            <td style="font-weight: 700;">${escapeHtml(d.dateFormatted)}</td>
            <td class="mono text-center">${d.totalOrders}</td>
            <td class="mono text-center">${d.totalUnits}</td>
            <td class="mono text-right" style="color: #065f46;">${fmt(d.cashSales)}</td>
            <td class="mono text-right" style="color: #4338ca;">${fmt(d.upiSales)}</td>
            <td class="mono text-right" style="color: #1f2937;">${fmt(d.cardSales)}</td>
            <td class="mono text-right" style="font-weight: 800;">${fmt(d.totalSales)}</td>
            <td class="mono text-right" style="color: #7d7265;">${share}%</td>
          </tr>
        `;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td>Total (${dayGroups.length} days)</td>
          <td class="mono text-center">${paidOrders.length}</td>
          <td class="mono text-center">${totalUnitsSold}</td>
          <td class="mono text-right">${fmt(cashSales)}</td>
          <td class="mono text-right">${fmt(upiSales)}</td>
          <td class="mono text-right">${fmt(cardSales)}</td>
          <td class="mono text-right" style="color: #2b231a;">${fmt(totalSales)}</td>
          <td class="mono text-right">100%</td>
        </tr>
      </tfoot>
    </table>
  </div>
  `
      : ""
  }

  <!-- SECTION: Each Day Details of Each Order -->
  <div class="section-title">
    <span>Daily Order Details (${paidOrders.length} Completed Orders)</span>
    <span class="section-subtitle mono">Detailed breakdown of each order organized by day</span>
  </div>

  ${
    dayGroups.length > 0
      ? dayGroups
          .map((group) => {
            return `
    <div class="day-block">
      <div class="day-header">
        <div class="day-title">
          <span>📅 ${escapeHtml(group.fullDateTitle)}</span>
        </div>
        <div class="day-metrics">
          <span><strong>${group.totalOrders}</strong> Orders</span>
          <span>•</span>
          <span><strong>${group.totalUnits}</strong> Items</span>
          <span>•</span>
          <span>UPI: <strong>${fmt(group.upiSales)}</strong></span>
          <span>•</span>
          <span>Cash: <strong>${fmt(group.cashSales)}</strong></span>
          ${group.cardSales > 0 ? `<span>•</span><span>Card: <strong>${fmt(group.cardSales)}</strong></span>` : ""}
          <span class="day-total-badge mono">Total: ${fmt(group.totalSales)}</span>
        </div>
      </div>

      <div class="day-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 14%;">Order #</th>
              <th style="width: 11%;">Time</th>
              <th style="width: 20%;">Customer</th>
              <th style="width: 35%;">Items Ordered</th>
              <th style="width: 10%;">Payment</th>
              <th style="width: 10%;" class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${group.orders
              .map((o) => {
                const timeStr = new Date(o.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const customerDisplay = o.customerName
                  ? `${escapeHtml(o.customerName)}${o.customerPhone ? `<br><span class="mono" style="font-size: 10px; color: #7d7265;">+91 ${escapeHtml(o.customerPhone)}</span>` : ""}`
                  : `<span style="color: #9c8e7f; font-style: italic;">Walk-in Customer</span>`;

                const itemsListHtml = `
                  <ul class="items-list">
                    ${o.lines
                      .map(
                        (l) =>
                          `<li>• <strong>${escapeHtml(l.name)}</strong> × ${l.qty} <span class="mono" style="color: #7d7265;">(${fmt(l.price * l.qty)})</span></li>`,
                      )
                      .join("")}
                  </ul>
                  ${o.discount ? `<div class="mono" style="font-size: 10px; color: #b45309; margin-top: 2px;">🏷️ Discount: -${fmt(o.discount)}</div>` : ""}
                `;

                const payBadgeClass =
                  o.payment === "upi"
                    ? "badge-upi"
                    : o.payment === "card"
                      ? "badge-card"
                      : "badge-cash";

                return `
              <tr>
                <td>
                  <span class="mono" style="font-weight: 800; color: #2b231a;">${escapeHtml(o.number)}</span>
                  ${o.invoiceNumber ? `<br><span class="mono" style="font-size: 9.5px; color: #7d7265;">${escapeHtml(o.invoiceNumber)}</span>` : ""}
                </td>
                <td class="mono" style="color: #6c5e50;">${timeStr}</td>
                <td>${customerDisplay}</td>
                <td>${itemsListHtml}</td>
                <td>
                  <span class="badge ${payBadgeClass}">${escapeHtml(o.payment)}</span>
                </td>
                <td class="mono text-right" style="font-weight: 800; color: #2b231a;">${fmt(o.total)}</td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="font-size: 11px;">
                Daily Subtotal for <strong>${escapeHtml(group.dateFormatted)}</strong>
              </td>
              <td colspan="2" class="mono" style="font-size: 11px;">
                ${group.totalOrders} Orders · ${group.totalUnits} Items Sold
              </td>
              <td class="mono text-right" style="font-size: 12.5px; color: #2b231a;">
                ${fmt(group.totalSales)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
            `;
          })
          .join("")
      : `
    <div class="table-container" style="padding: 24px; text-align: center; color: #7d7265;">
      No completed orders recorded for this period.
    </div>
  `
  }

  <!-- SECTION: Product Sales Summary AT THE END -->
  <div class="section-title" style="margin-top: 32px;">
    <span>📦 Product Sales Summary — Total Units Sold Per Product</span>
    <span class="section-subtitle mono">Ranked by total quantity sold during ${escapeHtml(timeframe)}</span>
  </div>

  ${
    categoryRows.length > 0
      ? `
  <div class="category-pills">
    ${categoryRows
      .map(
        ([catName, catStat]) => `
      <div class="category-pill">
        <span>${escapeHtml(catName)}:</span>
        <strong class="mono">${catStat.qty} sold</strong>
        <span class="mono" style="color: #7d7265;">(${fmt(catStat.revenue)})</span>
      </div>
    `,
      )
      .join("")}
  </div>
  `
      : ""
  }

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 35%;">Product Name</th>
          <th style="width: 18%;">Category</th>
          <th style="width: 12%;" class="text-right">Unit Price</th>
          <th style="width: 12%;" class="text-right">Units Sold</th>
          <th style="width: 8%;" class="text-right">% of Qty</th>
          <th style="width: 10%;" class="text-right">Total Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${
          productRows.length > 0
            ? productRows
                .map((p, idx) => {
                  const qtyPct = totalUnitsSold > 0 ? ((p.qtySold / totalUnitsSold) * 100).toFixed(1) : "0.0";
                  return `
            <tr>
              <td class="mono" style="color: #7d7265;">${idx + 1}</td>
              <td style="font-weight: 800; color: #2b231a;">${escapeHtml(p.name)}</td>
              <td><span class="badge badge-cat">${escapeHtml(p.category)}</span></td>
              <td class="mono text-right">${fmt(p.unitPrice)}</td>
              <td class="mono text-right" style="font-weight: 800; font-size: 12.5px; color: #2b231a;">
                ${p.qtySold} <span style="font-size: 10px; font-weight: normal; color: #7d7265;">units</span>
              </td>
              <td class="mono text-right" style="color: #7d7265;">${qtyPct}%</td>
              <td class="mono text-right" style="font-weight: 800; color: #2b231a;">${fmt(p.revenue)}</td>
            </tr>
          `;
                })
                .join("")
            : `<tr><td colspan="7" style="text-align: center; color: #7d7265; padding: 24px;">No product sales recorded in this period.</td></tr>`
        }
      </tbody>
      ${
        productRows.length > 0
          ? `
      <tfoot>
        <tr>
          <td colspan="4" class="mono">Total Products Sold (${productRows.length} Distinct Products)</td>
          <td class="mono text-right" style="font-size: 12.5px; color: #2b231a;">${totalUnitsSold} units</td>
          <td class="mono text-right">100%</td>
          <td class="mono text-right" style="font-size: 12.5px; color: #2b231a;">${fmt(totalSubtotal)}</td>
        </tr>
      </tfoot>
      `
          : ""
      }
    </table>
  </div>

  <!-- Report Footer -->
  <div class="footer">
    <div>
      ${escapeHtml(SHOP_INFO.fullName)} POS — Official sales &amp; inventory report | Contact: ${escapeHtml(SHOP_INFO.phone)} | FSSAI: ${escapeHtml(SHOP_INFO.fssai)}
    </div>
    <div>Confidential &amp; Proprietary Business Record</div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
  `;

  // Open formatted print document window that invokes browser's native print-to-PDF
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
