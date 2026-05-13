import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ClientApp } from "@/components/ClientApp";
import { billsInRange, summarize, dailySeries, paymentBreakdown, billsToCSV } from "@/lib/reportUtils";
import { downloadBlob } from "@/lib/dataIO";
import { formatINR, isoToDisplay, todayISO } from "@/lib/format";
import { formatBillNo, type Bill } from "@/lib/db";

export const Route = createFileRoute("/reports")({
  component: () => <ClientApp><Reports /></ClientApp>,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const today = todayISO();
  const [start, setStart] = useState(today.slice(0, 8) + "01");
  const [end, setEnd] = useState(today);
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    billsInRange(start, end).then(setBills);
  }, [start, end]);

  const summary = useMemo(() => summarize(bills), [bills]);
  const series = useMemo(() => dailySeries(bills, start, end), [bills, start, end]);
  const breakdown = useMemo(() => paymentBreakdown(bills), [bills]);
  const pending = useMemo(() => bills.filter((b) => b.pending > 0), [bills]);

  const exportCSV = () => {
    downloadBlob(new Blob([billsToCSV(bills)], { type: "text/csv" }), `report-${start}-to-${end}.csv`);
    toast.success("CSV exported");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Sales Report", 14, 18);
    doc.setFontSize(10); doc.text(`${isoToDisplay(start)} — ${isoToDisplay(end)}`, 14, 26);
    doc.text(`Total Sales: ${formatINR(summary.totalSales)}`, 14, 36);
    doc.text(`Paid: ${formatINR(summary.paid)}`, 14, 42);
    doc.text(`Pending: ${formatINR(summary.pending)}`, 14, 48);
    doc.text(`Bills: ${summary.count}`, 14, 54);
    autoTable(doc, {
      startY: 64,
      head: [["Bill", "Date", "Customer", "Total", "Paid", "Pending"]],
      body: bills.map((b) => [
        formatBillNo(b.year, b.billNumber), isoToDisplay(b.date), b.customerName,
        formatINR(b.grandTotal), formatINR(b.paid), formatINR(b.pending),
      ]),
      styles: { fontSize: 9 },
    });
    doc.save(`report-${start}-to-${end}.pdf`);
  };

  const stats = [
    { label: "Total Sales", value: formatINR(summary.totalSales) },
    { label: "Paid", value: formatINR(summary.paid) },
    { label: "Pending", value: formatINR(summary.pending) },
    { label: "Bills", value: String(summary.count) },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"><Download className="w-4 h-4" />CSV</button>
          <button onClick={exportPDF} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5"><FileText className="w-4 h-4" />PDF</button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border rounded-2xl p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-lg lg:text-xl font-bold mt-0.5 truncate">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Daily sales</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={10} stroke="currentColor" opacity={0.6} />
                <YAxis fontSize={10} stroke="currentColor" opacity={0.6} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Payment modes</h2>
          <div className="h-64">
            {breakdown.length === 0
              ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
              : <ResponsiveContainer>
                  <PieChart>
                    <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                      {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
            }
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Pending payments</h2>
          <span className="text-xs text-muted-foreground">{pending.length} bills</span>
        </div>
        {pending.length === 0
          ? <div className="p-12 text-center text-muted-foreground">No pending payments</div>
          : <div className="divide-y">
              {pending.map((b) => (
                <Link key={b.id} to="/billing/$year/$number" params={{ year: String(b.year), number: String(b.billNumber) }}
                  className="p-3 flex items-center gap-3 hover:bg-accent/50">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{b.customerName}</div>
                    <div className="text-xs text-muted-foreground">#{formatBillNo(b.year, b.billNumber)} · {isoToDisplay(b.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-warning">{formatINR(b.pending)}</div>
                    <div className="text-[10px] text-muted-foreground">of {formatINR(b.grandTotal)}</div>
                  </div>
                </Link>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
