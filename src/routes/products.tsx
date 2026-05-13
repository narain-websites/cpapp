import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, Camera, ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ClientApp } from "@/components/ClientApp";
import { useConfirm } from "@/components/ConfirmDialog";
import { getDb, type Product } from "@/lib/db";
import { indexProduct, reindexAll } from "@/lib/mlMatcher";

export const Route = createFileRoute("/products")({
  component: () => <ClientApp><Products /></ClientApp>,
});

async function fileToResizedBase64(file: File, max = 512): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function Products() {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const { confirm, node } = useConfirm();

  const products = useLiveQuery(async () => {
    const all = await getDb().products.orderBy("name").toArray();
    return all.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  }, [q]) || [];

  const onDelete = (p: Product) => {
    confirm({
      title: "Delete product?",
      message: `Delete ${p.name}?`,
      onConfirm: async () => {
        await getDb().products.delete(p.id!);
        await getDb().productEmbeddings.delete(p.id!);
        toast.success("Deleted");
      },
    });
  };

  const handleReindex = async () => {
    setReindexing(true);
    toast.info("Building product index…");
    await reindexAll();
    setReindexing(false);
    toast.success("Index ready");
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReindex} disabled={reindexing}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent disabled:opacity-50">
            <Sparkles className="w-4 h-4" />{reindexing ? "Indexing…" : "Re-index"}
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" />Add
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-card" />
      </div>

      {products.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border">No products yet</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            <div key={p.id} className="bg-card border rounded-2xl overflow-hidden">
              <div className="aspect-square bg-muted">
                {p.imageBase64
                  ? <img src={p.imageBase64} alt={p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImagePlus className="w-8 h-8" /></div>}
              </div>
              <div className="p-3">
                <div className="font-medium truncate text-sm">{p.name}</div>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="flex-1 py-1.5 rounded-md hover:bg-accent text-xs flex items-center justify-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                  <button onClick={() => onDelete(p)} className="flex-1 py-1.5 rounded-md hover:bg-accent text-xs text-destructive flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ProductForm product={editing} onClose={() => setShowForm(false)} />}
      {node}
    </div>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [name, setName] = useState(product?.name || "");
  const [imageBase64, setImageBase64] = useState(product?.imageBase64 || "");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (file: File) => {
    const b64 = await fileToResizedBase64(file);
    setImageBase64(b64);
  };

  const captureCamera = async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 80, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, width: 600,
      });
      if (photo.dataUrl) setImageBase64(photo.dataUrl);
    } catch {
      // Fallback to web file input with capture
      fileRef.current?.click();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    const db = getDb();
    let id: number;
    if (product?.id) {
      await db.products.update(product.id, { name, imageBase64 });
      id = product.id;
    } else {
      id = (await db.products.add({ name, imageBase64, createdAt: Date.now() })) as number;
    }
    if (imageBase64) { indexProduct(id, imageBase64).catch(() => {}); }
    toast.success(product ? "Product updated" : "Product added");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold">{product ? "Edit" : "Add"} product</h2>

        <div className="aspect-square w-40 mx-auto rounded-xl bg-muted overflow-hidden border">
          {imageBase64
            ? <img src={imageBase64} alt="preview" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImagePlus className="w-10 h-10" /></div>}
        </div>

        <div className="flex gap-2 justify-center">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent">
            <ImagePlus className="w-4 h-4" />Gallery
          </button>
          <button type="button" onClick={captureCamera}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-accent">
            <Camera className="w-4 h-4" />Camera
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full mt-1 px-3 py-2.5 rounded-lg border bg-background" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-accent text-sm">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
        </div>
      </form>
    </div>
  );
}
