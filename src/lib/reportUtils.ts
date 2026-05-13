import { getDb, type Bill } from "./db";

export interface RangeSummary {
  totalSales: number;
  paid: number;
  pending: number;
  count: number;
}

export async function billsInRange(start: string, end: string): Promise<Bill[]> {
  const db = getDb();
  return db.bills.where("date").between(start, end, true, true).toArray();
}

export function summarize(bills: Bill[]): RangeSummary {
  return bills.reduce<RangeSummary>(
    (acc, b) => {
      acc.totalSales += b.grandTotal;
      acc.paid += b.paid;
      acc.pending += b.pending;
      acc.count += 1;
      return acc;
    },
    { totalSales: 0, paid: 0, pending: 0, count: 0 },
  );
}

export function dailySeries(bills: Bill[], start: string, end: string) {
  const map = new Map<string, number>();
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const b of bills) {
    map.set(b.date, (map.get(b.date) || 0) + b.grandTotal);
  }
  return Array.from(map.entries()).map(([date, sales]) => ({ date, sales }));
}

export function paymentBreakdown(bills: Bill[]) {
  const m = new Map<string, number>();
  for (const b of bills) m.set(b.paymentType, (m.get(b.paymentType) || 0) + b.grandTotal);
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
}

export function billsToCSV(bills: Bill[]): string {
  const headers = ["Bill No", "Year", "Date", "Customer", "Phone", "Subtotal", "Discount", "Grand Total", "Paid", "Pending", "Payment"];
  const rows = bills.map((b) => [
    b.billNumber, b.year, b.date,
    `"${b.customerName.replace(/"/g, '""')}"`,
    b.customerPhone,
    b.subtotal, b.discountValue, b.grandTotal, b.paid, b.pending, b.paymentType,
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}
