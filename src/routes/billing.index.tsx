import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { ClientApp } from "@/components/ClientApp";
import { getDb, formatBillNo } from "@/lib/db";
import { formatINR, isoToDisplay } from "@/lib/format";

export const Route = createFileRoute("/billing/")({
  component: () => <ClientApp><BillingList /></ClientApp>,
});

function BillingList() {
  const [q, setQ] = useState("");
  const bills = useLiveQuery(async () => {
    const all = await getDb().bills.orderBy("createdAt").reverse().toArray();
    return all.filter((b) => !q || b.customerName.toLowerCase().includes(q.toLowerCase()) || formatBillNo(b.year, b.billNumber).includes(q));
  }, [q]) || [];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} total</p>
        </div>
        <Link to="/billing/new" className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" />New bill
        </Link>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bills…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-card" />
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        {bills.length === 0
          ? <div className="p-12 text-center text-muted-foreground">No bills yet</div>
          : (
            <div className="divide-y">
              {bills.map((b) => (
                <Link key={b.id} to="/billing/$year/$number" params={{ year: String(b.year), number: String(b.billNumber) }}
                  className="p-4 flex items-center gap-3 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{b.customerName || "—"}</div>
                    <div className="text-xs text-muted-foreground">#{formatBillNo(b.year, b.billNumber)} · {isoToDisplay(b.date)} · {b.items.length} items</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{formatINR(b.grandTotal)}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.pending > 0 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
                      {b.pending > 0 ? formatINR(b.pending) + " due" : "Paid"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
