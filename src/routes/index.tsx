import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Receipt, Users, Package, BarChart3, IndianRupee, Clock, FileText, UserCheck } from "lucide-react";
import { ClientApp } from "@/components/ClientApp";
import { getDb, formatBillNo } from "@/lib/db";
import { formatINR, todayISO, isoToDisplay } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => <ClientApp><Dashboard /></ClientApp>,
});

function Dashboard() {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const today = todayISO();
    const monthStart = today.slice(0, 7) + "-01";
    const [bills, customers] = await Promise.all([db.bills.toArray(), db.customers.count()]);
    const todayBills = bills.filter((b) => b.date === today);
    const monthBills = bills.filter((b) => b.date >= monthStart);
    const todaySales = todayBills.reduce((s, b) => s + b.grandTotal, 0);
    const pending = bills.reduce((s, b) => s + b.pending, 0);
    const recent = [...bills].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

    // last 7 days
    const series: { day: string; sales: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      const total = bills.filter((b) => b.date === iso).reduce((s, b) => s + b.grandTotal, 0);
      series.push({ day: label, sales: Math.round(total) });
    }
    return { todaySales, pending, monthCount: monthBills.length, customers, recent, series };
  }, []);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const stats = [
    { label: "Today's Sales", value: formatINR(data.todaySales), icon: IndianRupee, color: "bg-success/10 text-success" },
    { label: "Pending", value: formatINR(data.pending), icon: Clock, color: "bg-warning/10 text-warning" },
    { label: "Bills This Month", value: String(data.monthCount), icon: FileText, color: "bg-primary/10 text-primary" },
    { label: "Total Customers", value: String(data.customers), icon: UserCheck, color: "bg-chart-3/10 text-chart-3" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your business</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card text-card-foreground rounded-2xl p-4 border"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-lg lg:text-xl font-bold mt-0.5 truncate">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction to="/billing/new" label="New Bill" icon={Receipt} />
        <QuickAction to="/customers" label="Customers" icon={Users} />
        <QuickAction to="/products" label="Products" icon={Package} />
        <QuickAction to="/reports" label="Reports" icon={BarChart3} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl p-4 border">
          <h2 className="font-semibold mb-3">Last 7 days</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.series}>
                <XAxis dataKey="day" stroke="currentColor" opacity={0.5} fontSize={12} />
                <YAxis stroke="currentColor" opacity={0.5} fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border">
          <h2 className="font-semibold mb-3">Recent Bills</h2>
          {data.recent.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No bills yet</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recent.map((b) => (
                <Link
                  key={b.id}
                  to="/billing/$year/$number"
                  params={{ year: String(b.year), number: String(b.billNumber) }}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{b.customerName || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">#{formatBillNo(b.year, b.billNumber)} · {isoToDisplay(b.date)}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-semibold">{formatINR(b.grandTotal)}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.pending > 0 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
                      {b.pending > 0 ? "Pending" : "Paid"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Link to={to} className="flex items-center gap-3 bg-card border rounded-xl p-3 hover:bg-accent transition-colors">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
