import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Phone, Download, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { ClientApp } from "@/components/ClientApp";
import { useConfirm } from "@/components/ConfirmDialog";
import { getDb, type Customer, type CustomerType } from "@/lib/db";
import { customersToCSV, customersToVCF, parseCSVCustomers, downloadBlob } from "@/lib/dataIO";

export const Route = createFileRoute("/customers")({
  component: () => <ClientApp><Customers /></ClientApp>,
});

function Customers() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CustomerType>("all");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { confirm, node: confirmNode } = useConfirm();

  const customers = useLiveQuery(async () => {
    const all = await getDb().customers.orderBy("name").toArray();
    return all.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q);
      const matchF = filter === "all" || c.type === filter;
      return matchQ && matchF;
    });
  }, [q, filter]) || [];

  const onDelete = (c: Customer) => {
    confirm({
      title: "Delete customer?",
      message: `Delete ${c.name}? This cannot be undone.`,
      onConfirm: async () => {
        await getDb().customers.delete(c.id!);
        toast.success("Customer deleted");
      },
    });
  };

  const exportCSV = async () => {
    const all = await getDb().customers.toArray();
    downloadBlob(new Blob([customersToCSV(all)], { type: "text/csv" }), "customers.csv");
    toast.success("CSV exported");
  };

  const exportVCF = async () => {
    const all = await getDb().customers.toArray();
    downloadBlob(new Blob([customersToVCF(all)], { type: "text/vcard" }), "customers.vcf");
    toast.success("VCF exported");
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      const parsed = parseCSVCustomers(text);
      if (!parsed.length) return toast.error("No rows found in CSV");
      const now = Date.now();
      await getDb().customers.bulkAdd(parsed.map((c) => ({ ...c, createdAt: now })));
      toast.success(`Imported ${parsed.length} customers`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent"><Download className="w-4 h-4" />CSV</button>
          <button onClick={exportVCF} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent"><FileText className="w-4 h-4" />VCF</button>
          <label className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent cursor-pointer">
            <Upload className="w-4 h-4" />Import
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
          </label>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" />Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-card"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2.5 rounded-lg border bg-card text-sm">
          <option value="all">All</option>
          <option value="bulk">Bulk</option>
          <option value="retail">Retail</option>
        </select>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No customers yet</div>
        ) : (
          <div className="divide-y">
            {customers.map((c) => (
              <div key={c.id} className="p-4 flex items-center gap-3 hover:bg-accent/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="w-3 h-3" />{c.phone || "—"}</a>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${c.type === "bulk" ? "bg-primary/20 text-primary" : "bg-muted"}`}>{c.type}</span>
                  </div>
                  {c.address && <div className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</div>}
                </div>
                <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-2 rounded-lg hover:bg-accent"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete(c)} className="p-2 rounded-lg hover:bg-accent text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && <CustomerForm customer={editing} onClose={() => setShowForm(false)} />}
      {confirmNode}
    </div>
  );
}

function CustomerForm({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [type, setType] = useState<CustomerType>(customer?.type || "retail");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    const db = getDb();
    if (customer?.id) {
      await db.customers.update(customer.id, { name, phone, address, type });
      toast.success("Customer updated");
    } else {
      await db.customers.add({ name, phone, address, type, createdAt: Date.now() });
      toast.success("Customer added");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4"
      >
        <h2 className="text-lg font-bold">{customer ? "Edit" : "Add"} customer</h2>
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
        <Field label="Address" value={address} onChange={setAddress} />
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <div className="flex gap-2 mt-1">
            {(["retail", "bulk"] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm capitalize ${type === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >{t}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-accent text-sm">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}{required && " *"}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
    </div>
  );
}
