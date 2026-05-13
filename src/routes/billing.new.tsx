import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, Save, Camera, Download, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ClientApp } from "@/components/ClientApp";
import { SnapToBill } from "@/components/SnapToBill";
import {
  getDb, ensureSettings, nextBillNumber, formatBillNo,
  type Bill, type BillItem, type Customer, type DiscountType, type PaymentType, type Product, type Settings,
} from "@/lib/db";
import { todayISO } from "@/lib/format";
import { formatINR } from "@/lib/format";
import { computeBillTotals, makeEmptyItem, saveBill, PAYMENT_TYPES } from "@/lib/billStore";
import { downloadInvoice, printInvoice } from "@/lib/pdfGenerator";

export const Route = createFileRoute("/billing/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search.edit ? Number(search.edit) : undefined,
  }),
  component: () => <ClientApp><BillEditor /></ClientApp>,
});

const DRAFT_KEY = "chawla_bill_draft";

function BillEditor() {
  const navigate = useNavigate();
  const { edit: editId } = Route.useSearch();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [billId, setBillId] = useState<number | undefined>(undefined);
  const [billNumber, setBillNumber] = useState<number>(0);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [date, setDate] = useState(todayISO());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<BillItem[]>([makeEmptyItem()]);
  const [discountType, setDiscountType] = useState<DiscountType>("flat");
  const [discountValue, setDiscountValue] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>("Cash");
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapSession, setSnapSession] = useState(0);

  const customers = useLiveQuery(() => getDb().customers.toArray(), []) || [];
  const products = useLiveQuery(() => getDb().products.toArray(), []) || [];

  // Init: load existing bill (edit), draft, or fresh number
  useEffect(() => {
    (async () => {
      const s = await ensureSettings(); setSettings(s);
      if (editId) {
        const existing = await getDb().bills.get(editId);
        if (existing) {
          setBillId(existing.id);
          setBillNumber(existing.billNumber);
          setYear(existing.year);
          setDate(existing.date);
          setCustomerName(existing.customerName);
          setCustomerPhone(existing.customerPhone);
          setCustomerId(existing.customerId);
          setItems(existing.items.length ? existing.items : [makeEmptyItem()]);
          setDiscountType(existing.discountType);
          setDiscountValue(existing.discountValue);
          setPaid(existing.paid);
          setPaymentType(existing.paymentType);
          sessionStorage.removeItem(DRAFT_KEY);
          return;
        }
      }
      const draftRaw = sessionStorage.getItem(DRAFT_KEY);
      if (draftRaw) {
        try {
          const d = JSON.parse(draftRaw);
          setBillNumber(d.billNumber);
          setDate(d.date);
          setCustomerName(d.customerName);
          setCustomerPhone(d.customerPhone);
          setCustomerId(d.customerId);
          setItems(d.items?.length ? d.items : [makeEmptyItem()]);
          setDiscountType(d.discountType);
          setDiscountValue(d.discountValue);
          setPaid(d.paid);
          setPaymentType(d.paymentType);
          return;
        } catch {}
      }
      setBillNumber(await nextBillNumber(year));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Auto-save draft (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!billNumber) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        billNumber, date, customerName, customerPhone, customerId,
        items, discountType, discountValue, paid, paymentType,
      }));
    }, 1000);
  }, [billNumber, date, customerName, customerPhone, customerId, items, discountType, discountValue, paid, paymentType]);

  const totals = useMemo(() => computeBillTotals(items, discountType, discountValue, paid), [items, discountType, discountValue, paid]);

  const updateItem = (i: number, patch: Partial<BillItem>) => {
    setItems((arr) => {
      const next = [...arr];
      next[i] = { ...next[i], ...patch };
      next[i].amount = (Number(next[i].price) || 0) * (Number(next[i].qty) || 0);
      return next;
    });
  };

  const addItem = () => setItems((a) => [...a, makeEmptyItem()]);
  const removeItem = (i: number) => setItems((a) => a.length > 1 ? a.filter((_, idx) => idx !== i) : a);

  const addProductToBill = (product: Product, defaultPrice = 0) => {
    setItems((current) => {
      const idx = current.findIndex((it) => it.productId === product.id);
      if (idx >= 0 && settings?.snapQtyMode === "increment") {
        const next = [...current];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1, amount: (next[idx].qty + 1) * next[idx].price };
        return next;
      }
      // empty first row?
      const firstEmpty = current.findIndex((it) => !it.productName);
      const newItem: BillItem = {
        productId: product.id, productName: product.name, price: defaultPrice, qty: 1, amount: defaultPrice,
      };
      if (firstEmpty >= 0) {
        const next = [...current]; next[firstEmpty] = newItem; return next;
      }
      return [...current, newItem];
    });
    setSnapSession((c) => c + 1);
  };

  const handleSave = async () => {
    if (!customerName.trim()) return toast.error("Customer name required");
    if (items.every((it) => !it.productName)) return toast.error("Add at least one product");
    const cleanItems = items.filter((it) => it.productName.trim());
    const t = computeBillTotals(cleanItems, discountType, discountValue, paid);
    const bill: Omit<Bill, "id" | "createdAt" | "updatedAt"> & { id?: number } = {
      id: billId, billNumber, year, date, customerId, customerName, customerPhone,
      items: cleanItems, subtotal: t.subtotal, discountType, discountValue,
      grandTotal: t.grandTotal, paid, pending: t.pending, paymentType,
    };
    const id = await saveBill(bill);
    setBillId(id);
    sessionStorage.removeItem(DRAFT_KEY);
    toast.success("Bill saved");
    return id;
  };

  const handleSavePrint = async (mode: "print" | "download") => {
    await handleSave();
    const all = await getDb().bills.where({ year, billNumber }).toArray();
    const saved = all[0];
    const s = await ensureSettings();
    if (saved) {
      if (mode === "print") printInvoice(saved, s); else downloadInvoice(saved, s);
    }
  };

  const newBill = async () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setBillId(undefined);
    setBillNumber(await nextBillNumber(year));
    setDate(todayISO());
    setCustomerName(""); setCustomerPhone(""); setCustomerId(undefined);
    setItems([makeEmptyItem()]);
    setDiscountValue(0); setPaid(0); setPaymentType("Cash");
    setSnapSession(0);
    toast.success("New bill started");
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">New Bill #{formatBillNo(year, billNumber)}</h1>
          <p className="text-xs text-muted-foreground">Auto-saved draft</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={newBill} className="px-3 py-2 rounded-lg border text-sm">New</button>
          <button onClick={() => setSnapOpen(true)} className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm flex items-center gap-1.5 relative">
            <Camera className="w-4 h-4" />Snap
            {snapSession > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{snapSession}</span>
            )}
          </button>
          <button onClick={handleSave} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
            <Save className="w-4 h-4" />Save
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Bill No</label>
          <input type="number" value={billNumber} onChange={(e) => setBillNumber(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
        </div>
        <CustomerAutocomplete
          customers={customers} value={customerName}
          onChange={setCustomerName}
          onPick={(c) => { setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone); }}
          phone={customerPhone} onPhoneChange={setCustomerPhone}
        />
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b">
          <h2 className="font-semibold">Items</h2>
          <button onClick={addItem} className="px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1"><Plus className="w-3 h-3" />Row</button>
        </div>
        <div className="divide-y">
          {items.map((it, i) => (
            <ItemRow
              key={i} item={it} products={products}
              onChange={(patch) => updateItem(i, patch)}
              onRemove={() => removeItem(i)}
            />
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4 grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Discount</label>
            <div className="flex gap-2 mt-1">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="px-3 py-2.5 rounded-lg border bg-background text-sm">
                <option value="flat">₹</option>
                <option value="percent">%</option>
              </select>
              <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="flex-1 px-3 py-2.5 rounded-lg border bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Paid</label>
            <input type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Payment type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background">
              {PAYMENT_TYPES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 space-y-2 self-start">
          <Row label="Subtotal" value={formatINR(totals.subtotal)} />
          {discountValue > 0 && <Row label="Discount" value={"-" + formatINR(totals.subtotal - totals.grandTotal)} />}
          <div className="border-t pt-2"><Row label="Grand Total" value={formatINR(totals.grandTotal)} bold /></div>
          <Row label="Paid" value={formatINR(paid)} />
          <Row label="Pending" value={formatINR(totals.pending)} warn={totals.pending > 0} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={() => handleSavePrint("download")} className="px-4 py-2.5 rounded-lg border text-sm flex items-center gap-1.5">
          <Download className="w-4 h-4" />Save & Download PDF
        </button>
        <button onClick={() => handleSavePrint("print")} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
          <Printer className="w-4 h-4" />Save & Print
        </button>
      </div>

      {snapOpen && (
        <SnapToBill
          sessionCount={snapSession}
          onClose={() => setSnapOpen(false)}
          onAdd={(p) => addProductToBill(p)}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold text-base" : ""} ${warn ? "text-warning font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function CustomerAutocomplete({
  customers, value, onChange, onPick, phone, onPhoneChange,
}: {
  customers: Customer[]; value: string; onChange: (v: string) => void; onPick: (c: Customer) => void;
  phone: string; onPhoneChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = customers.filter((c) => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 6);
  const exact = customers.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());

  const addInline = async () => {
    if (!value.trim()) return;
    const id = (await getDb().customers.add({ name: value.trim(), phone, address: "", type: "retail", createdAt: Date.now() })) as number;
    onPick({ id, name: value.trim(), phone, address: "", type: "retail", createdAt: Date.now() });
    setOpen(false);
    toast.success("Customer added");
  };

  return (
    <>
      <div className="relative">
        <label className="text-xs text-muted-foreground">Customer</label>
        <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" placeholder="Type to search…" />
        {open && value && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {matches.map((c) => (
              <button key={c.id} type="button" onMouseDown={() => onPick(c)}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone}</div>
              </button>
            ))}
            {!exact && (
              <button type="button" onMouseDown={addInline}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-t text-primary flex items-center gap-1">
                <Plus className="w-3 h-3" />Add "{value}" as new customer
              </button>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Phone</label>
        <input type="tel" value={phone} onChange={(e) => onPhoneChange(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
      </div>
    </>
  );
}

function ItemRow({ item, products, onChange, onRemove }: {
  item: BillItem; products: Product[];
  onChange: (patch: Partial<BillItem>) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = products.filter((p) => p.name.toLowerCase().includes(item.productName.toLowerCase())).slice(0, 6);
  const exact = products.find((p) => p.name.toLowerCase() === item.productName.trim().toLowerCase());

  const addInline = async () => {
    if (!item.productName.trim()) return;
    const id = (await getDb().products.add({ name: item.productName.trim(), imageBase64: "", createdAt: Date.now() })) as number;
    onChange({ productId: id });
    toast.success("Product added");
    setOpen(false);
  };

  return (
    <div className="p-3 grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12 sm:col-span-5 relative">
        <label className="text-[10px] text-muted-foreground">Product</label>
        <input
          value={item.productName}
          onChange={(e) => { onChange({ productName: e.target.value, productId: undefined }); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
          placeholder="Product name"
        />
        {open && item.productName && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {matches.map((p) => (
              <button key={p.id} type="button" onMouseDown={() => { onChange({ productId: p.id, productName: p.name }); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2">
                {p.imageBase64 && <img src={p.imageBase64} className="w-8 h-8 rounded object-cover" alt="" />}
                {p.name}
              </button>
            ))}
            {!exact && (
              <button type="button" onMouseDown={addInline}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-t text-primary flex items-center gap-1">
                <Plus className="w-3 h-3" />Add "{item.productName}" to products
              </button>
            )}
          </div>
        )}
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="text-[10px] text-muted-foreground">Price</label>
        <input type="number" min={0} value={item.price || ""} onChange={(e) => onChange({ price: Number(e.target.value) })}
          className="w-full px-2 py-2 rounded-lg border bg-background text-sm" />
      </div>
      <div className="col-span-3 sm:col-span-2">
        <label className="text-[10px] text-muted-foreground">Qty</label>
        <input type="number" min={0} value={item.qty || ""} onChange={(e) => onChange({ qty: Number(e.target.value) })}
          className="w-full px-2 py-2 rounded-lg border bg-background text-sm" />
      </div>
      <div className="col-span-3 sm:col-span-2">
        <label className="text-[10px] text-muted-foreground">Amount</label>
        <div className="px-2 py-2 rounded-lg bg-muted text-sm font-medium text-right">{formatINR(item.amount)}</div>
      </div>
      <button onClick={onRemove} className="col-span-2 sm:col-span-1 h-10 rounded-lg hover:bg-destructive/10 text-destructive flex items-center justify-center" aria-label="Remove">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
