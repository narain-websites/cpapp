import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Save, Download, Upload, ImagePlus, KeyRound, Info } from "lucide-react";
import { toast } from "sonner";
import { ClientApp } from "@/components/ClientApp";
import { useConfirm } from "@/components/ConfirmDialog";
import { ensureSettings, getDb, type Settings } from "@/lib/db";
import { changePin } from "@/lib/authStore";
import { backupAll, restoreAll, downloadBlob } from "@/lib/dataIO";

export const Route = createFileRoute("/settings")({
  component: () => <ClientApp><SettingsPage /></ClientApp>,
});

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const { confirm, node } = useConfirm();

  useEffect(() => { ensureSettings().then(setS); }, []);
  if (!s) return null;

  const update = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  const save = async () => {
    await getDb().settings.update(1, s);
    toast.success("Settings saved");
  };

  const handlePin = async () => {
    if (!oldPin || !newPin) return toast.error("Fill both fields");
    if (newPin.length < 4) return toast.error("PIN must be at least 4 digits");
    const ok = await changePin(oldPin, newPin);
    if (ok) { toast.success("PIN updated"); setOldPin(""); setNewPin(""); }
    else toast.error("Old PIN incorrect");
  };

  const onLogo = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update({ logoBase64: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const doBackup = async () => {
    const blob = await backupAll();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `chawla-backup-${stamp}.json`);
    toast.success("Backup downloaded");
  };

  const onRestore = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      confirm({
        title: "Restore from backup?",
        message: "This will overwrite ALL existing data on this device. Continue?",
        confirmLabel: "Restore",
        onConfirm: async () => {
          try {
            await restoreAll(String(r.result));
            toast.success("Restored. Reloading…");
            setTimeout(() => location.reload(), 800);
          } catch (e: any) {
            toast.error("Invalid backup: " + (e?.message ?? ""));
          }
        },
      });
    };
    r.readAsText(file);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section title="Firm details">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center border">
            {s.logoBase64
              ? <img src={s.logoBase64} alt="logo" className="w-full h-full object-cover" />
              : <ImagePlus className="w-8 h-8 text-muted-foreground" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg border text-sm">Change logo</button>
          {s.logoBase64 && <button type="button" onClick={() => update({ logoBase64: "" })} className="px-3 py-2 rounded-lg border text-sm text-destructive">Remove</button>}
        </div>
        <Field label="Firm name" value={s.firmName} onChange={(v) => update({ firmName: v })} />
        <Field label="Tagline" value={s.tagline} onChange={(v) => update({ tagline: v })} />
        <Field label="Address line 1" value={s.address1} onChange={(v) => update({ address1: v })} />
        <Field label="Address line 2" value={s.address2} onChange={(v) => update({ address2: v })} />
        <Field label="Address line 3" value={s.address3} onChange={(v) => update({ address3: v })} />
        <Field label="Phone" value={s.phone} onChange={(v) => update({ phone: v })} />
        <Field label="GST" value={s.gst} onChange={(v) => update({ gst: v })} />
      </Section>

      <Section title="Snap-to-Bill behavior">
        <div>
          <label className="text-xs text-muted-foreground">When the same product is snapped again</label>
          <div className="flex gap-2 mt-1">
            {([
              ["increment", "Increment qty"],
              ["newRow", "Add new row"],
            ] as const).map(([v, l]) => (
              <button key={v} onClick={() => update({ snapQtyMode: v })}
                className={`flex-1 py-2 rounded-lg text-sm ${s.snapQtyMode === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Security">
        <Field label="Current PIN" value={oldPin} onChange={setOldPin} type="password" />
        <Field label="New PIN" value={newPin} onChange={setNewPin} type="password" />
        <button onClick={handlePin} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5"><KeyRound className="w-4 h-4" />Update PIN</button>
      </Section>

      <Section title="Backup & Restore">
        <p className="text-xs text-muted-foreground">Backups include every customer, product, image, embedding, and bill. Stored as a single JSON file.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={doBackup} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"><Download className="w-4 h-4" />Backup</button>
          <input ref={restoreRef} type="file" accept=".json,.chawla-backup,application/json" className="hidden"
            onChange={(e) => e.target.files?.[0] && onRestore(e.target.files[0])} />
          <button onClick={() => restoreRef.current?.click()} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"><Upload className="w-4 h-4" />Restore</button>
        </div>
      </Section>

      <Section title="About" icon={<Info className="w-4 h-4" />}>
        <p className="text-sm text-muted-foreground">
          Chawla Plywood is a fully offline billing app. All data lives on this device — no servers, no cloud accounts.
          Use Backup regularly and copy the file off-device for safety.
        </p>
      </Section>

      <div className="sticky bottom-20 lg:bottom-4 flex justify-end">
        <button onClick={save} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg flex items-center gap-2">
          <Save className="w-4 h-4" />Save settings
        </button>
      </div>
      {node}
    </div>
  );
}

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">{icon}{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
    </div>
  );
}
