import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ClientApp } from "@/components/ClientApp";
import { getDb, ensureSettings, formatBillNo, type Bill, type Settings } from "@/lib/db";
import { formatINR, isoToDisplay } from "@/lib/format";
import { downloadInvoice, printInvoice } from "@/lib/pdfGenerator";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/billing/$year/$number")({
  component: () => <ClientApp><BillView /></ClientApp>,
});

function BillView() {
  const { year, number } = Route.useParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, node } = useConfirm();

  useEffect(() => {
    (async () => {
      const found = await getDb().bills.where({ year: Number(year), billNumber: Number(number) }).first();
      setBill(found || null);
      setSettings(await ensureSettings());
      setLoading(false);
    })();
  }, [year, number]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!bill) return <div className="text-center py-12"><div className="text-lg font-semibold">Bill not found</div><Link to="/billing" className="text-primary text-sm">Back to bills</Link></div>;

  const onDelete = () => {
    confirm({
      title: "Delete bill?",
      message: `Delete bill #${formatBillNo(bill.year, bill.billNumber)}?`,
      onConfirm: async () => {
        await getDb().bills.delete(bill.id!);
        toast.success("Deleted");
        history.back();
      },
    });
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/billing" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />Back
        </Link>
        <div className="flex gap-2">
          <Link to="/billing/new" search={{ edit: bill.id! }} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"><Pencil className="w-4 h-4" />Edit</Link>
          <button onClick={() => settings && downloadInvoice(bill, settings)} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"><Download className="w-4 h-4" />PDF</button>
          <button onClick={() => settings && printInvoice(bill, settings)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5"><Printer className="w-4 h-4" />Print</button>
          <button onClick={onDelete} className="px-3 py-2 rounded-lg border text-destructive text-sm flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Delete</button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Bill</div>
            <div className="text-2xl font-bold">#{formatBillNo(bill.year, bill.billNumber)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Date</div>
            <div className="font-medium">{isoToDisplay(bill.date)}</div>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Customer</div>
          <div className="font-semibold">{bill.customerName}</div>
          {bill.customerPhone && <div className="text-sm text-muted-foreground">{bill.customerPhone}</div>}
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2">Price</th>
                <th className="text-center p-2">Qty</th>
                <th className="text-right p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{it.productName}</td>
                  <td className="p-2 text-right">{formatINR(it.price)}</td>
                  <td className="p-2 text-center">{it.qty}</td>
                  <td className="p-2 text-right font-medium">{formatINR(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full sm:w-72 space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatINR(bill.subtotal)} />
          {bill.discountValue > 0 && <Row label={`Discount`} value={"-" + formatINR(bill.subtotal - bill.grandTotal)} />}
          <div className="border-t pt-1.5"><Row label="Grand Total" value={formatINR(bill.grandTotal)} bold /></div>
          <Row label={`Paid (${bill.paymentType})`} value={formatINR(bill.paid)} />
          {bill.pending > 0 && <Row label="Pending" value={formatINR(bill.pending)} warn />}
        </div>
      </div>
      {node}
    </div>
  );
}

function Row({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold text-base" : ""} ${warn ? "text-warning font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
