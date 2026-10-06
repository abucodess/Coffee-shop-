import { fmt, type Order, type MenuItem } from "./pos-data";

interface SalesPdfData {
  timeframe: string;
  generatedAt: Date;
  orders: Order[];
  menu: MenuItem[];
}

export function generateSalesPdfReport({ timeframe, generatedAt, orders, menu }: SalesPdfData) {
  // Only include paid/completed orders in the sales report summary
  const paidOrders = orders.filter((o) => o.status === "paid");

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

  // Aggregate product sales
  const productStats = new Map<string, { qty: number; revenue: number; price: number }>();

  paidOrders.forEach((order) => {
    order.lines.forEach((line) => {
      const existing = productStats.get(line.name) || {
        qty: 0,
        revenue: 0,
        price: line.price,
      };
      existing.qty += line.qty;
      existing.revenue += line.price * line.qty;
      productStats.set(line.name, existing);
    });
  });

  const productRows = [...productStats.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const totalUnitsSold = productRows.reduce((sum, [, p]) => sum + p.qty, 0);

  // HTML Report Content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales & Products Report — FUWA Japanese Fluffy Desserts</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #2b231a;
      background: #faf7f2;
      padding: 24px;
      line-height: 1.4;
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
      margin-bottom: 22px;
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
      font-size: 26px;
      font-weight: 800;
      color: #2b231a;
    }
    .meta-right {
      text-align: right;
      font-size: 12px;
      color: #7d7265;
    }
    .meta-right strong {
      color: #2b231a;
      font-size: 13px;
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
      padding: 14px;
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
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #7d7265;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 800;
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
      font-weight: 800;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .table-container {
      background: #ffffff;
      border: 1px solid #e5dcce;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }
    th {
      background: #f4eee2;
      color: #4a3e31;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 10px 14px;
      border-bottom: 1px solid #e5dcce;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid #f2ede4;
      color: #2b231a;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .text-right {
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-paid {
      background: rgba(46, 125, 90, 0.12);
      color: #246d4e;
    }
    .badge-cancelled {
      background: rgba(214, 69, 41, 0.12);
      color: #d64529;
    }
    .badge-cash {
      background: #f4eee2;
      color: #246d4e;
    }
    .badge-card {
      background: #2b231a;
      color: #f6edd9;
    }
    .footer {
      border-top: 1px dashed #d1c7b8;
      padding-top: 14px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #7d7265;
      font-family: 'Space Mono', monospace;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-badge">FUWA POS</div>
      <h1 class="title">Sales & Products Report</h1>
      <div class="mono" style="font-size: 12px; color: #7d7265; margin-top: 2px;">
        Period: <strong>${timeframe}</strong>
      </div>
    </div>
    <div class="meta-right mono">
      <div>Generated: <strong>${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
      <div>Till: <strong>Till 01 (Main Register)</strong></div>
      <div>Store: <strong>FUWA Japanese Fluffy Desserts</strong></div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card dark">
      <div class="stat-label">Total Net Sales</div>
      <div class="stat-value mono">${fmt(totalSales)}</div>
      <div class="stat-sub">${paidOrders.length} Paid Transactions</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Units Sold</div>
      <div class="stat-value mono">${totalUnitsSold}</div>
      <div class="stat-sub">Across all categories</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Ticket</div>
      <div class="stat-value mono">${fmt(avgTicket)}</div>
      <div class="stat-sub">Per completed order</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Payment Breakdown</div>
      <div class="mono" style="font-size: 12px; font-weight: 700; margin-top: 3px;">
        Cash: ${fmt(cashSales)}
      </div>
      <div class="mono" style="font-size: 12px; font-weight: 700; color: #b45309;">
        UPI: ${fmt(upiSales)}
      </div>
      <div class="mono" style="font-size: 12px; font-weight: 700; color: #7d7265;">
        Card: ${fmt(cardSales)}
      </div>
    </div>
  </div>

  <div class="section-title">
    <span>Products Sold Breakdown (${productRows.length} items)</span>
    <span class="mono" style="font-size: 11px; font-weight: normal; color: #7d7265;">Sorted by total revenue</span>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product Name</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Qty Sold</th>
          <th class="text-right">% of Qty</th>
          <th class="text-right">Total Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${
          productRows.length > 0
            ? productRows
                .map(([name, stat], idx) => {
                  const pct = totalUnitsSold
                    ? ((stat.qty / totalUnitsSold) * 100).toFixed(1)
                    : "0.0";
                  return `
            <tr>
              <td class="mono" style="color: #7d7265;">${idx + 1}</td>
              <td style="font-weight: 700;">${name}</td>
              <td class="mono text-right">${fmt(stat.price)}</td>
              <td class="mono text-right" style="font-weight: 700;">${stat.qty}</td>
              <td class="mono text-right" style="color: #7d7265;">${pct}%</td>
              <td class="mono text-right" style="font-weight: 700;">${fmt(stat.revenue)}</td>
            </tr>
          `;
                })
                .join("")
            : `<tr><td colspan="6" style="text-align: center; color: #7d7265; padding: 20px;">No product sales recorded in this period.</td></tr>`
        }
      </tbody>
      ${
        productRows.length > 0
          ? `
      <tfoot>
        <tr style="background: #fbf8f3; font-weight: 700;">
          <td colspan="3" class="mono">Total</td>
          <td class="mono text-right">${totalUnitsSold}</td>
          <td class="mono text-right">100%</td>
          <td class="mono text-right" style="color: #2b231a;">${fmt(totalSubtotal)}</td>
        </tr>
      </tfoot>
      `
          : ""
      }
    </table>
  </div>

  <div class="section-title" style="margin-top: 24px;">
    <span>Completed Orders (${paidOrders.length} orders)</span>
    <span class="mono" style="font-size: 11px; font-weight: normal; color: #7d7265;">All Completed Transactions</span>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Order #</th>
          <th>Time</th>
          <th>Items Ordered</th>
          <th>Payment</th>
          <th>Status</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          paidOrders.length > 0
            ? paidOrders
                .map((o) => {
                  const timeStr = new Date(o.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const itemsSummary = o.lines.map((l) => `${l.name} (${l.qty})`).join(", ");
                  return `
            <tr>
              <td class="mono" style="font-weight: 700;">${o.number}</td>
              <td class="mono" style="color: #7d7265;">${timeStr}</td>
              <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemsSummary}</td>
              <td><span class="badge ${o.payment === "card" ? "badge-card" : "badge-cash"}">${o.payment}</span></td>
              <td><span class="badge badge-paid">paid</span></td>
              <td class="mono text-right" style="font-weight: 700;">${fmt(o.total)}</td>
            </tr>
          `;
                })
                .join("")
            : `<tr><td colspan="6" style="text-align: center; color: #7d7265; padding: 20px;">No completed orders found for this period.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>FUWA Japanese Fluffy Desserts POS — Generated automatically from business records</div>
    <div>Confidential & Proprietary</div>
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
