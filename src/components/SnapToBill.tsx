import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Loader2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Product } from "@/lib/db";
import { computeEmbeddingFromCanvas, matchEmbedding, preloadModel, isModelReady, type Match } from "@/lib/mlMatcher";

interface MatchView extends Match { product: Product }

export function SnapToBill({
  onAdd, onClose, sessionCount,
}: {
  onAdd: (product: Product) => void;
  onClose: () => void;
  sessionCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [status, setStatus] = useState("Starting camera…");
  const [modelReady, setModelReady] = useState(isModelReady());
  const slow = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 4) <= 2;
  const interval = slow ? 1500 : 800;

  const products = useLiveQuery(() => getDb().products.toArray(), []) || [];
  const prodMap = new Map(products.map((p) => [p.id!, p]));

  // Camera setup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("Detecting…");
        }
      } catch (e: any) {
        setStatus("Camera error: " + (e?.message ?? "blocked"));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    preloadModel().then(() => { if (!cancelled) setModelReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!modelReady) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = async () => {
      if (stopped) return;
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.videoWidth > 0) {
        c.width = 224; c.height = 224;
        const ctx = c.getContext("2d")!;
        // crop center square
        const sz = Math.min(v.videoWidth, v.videoHeight);
        const sx = (v.videoWidth - sz) / 2, sy = (v.videoHeight - sz) / 2;
        ctx.drawImage(v, sx, sy, sz, sz, 0, 0, 224, 224);
        try {
          const emb = await computeEmbeddingFromCanvas(c);
          const m = await matchEmbedding(emb);
          const view = m
            .map((x) => ({ ...x, product: prodMap.get(x.productId)! }))
            .filter((x) => x.product);
          setMatches(view);
        } catch (e) {
          console.warn(e);
        }
      }
      timer = setTimeout(step, interval);
    };
    step();
    return () => { stopped = true; clearTimeout(timer); };
  }, [modelReady, products.length]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      <div className="absolute top-0 inset-x-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full bg-black/50">
          <X className="w-5 h-5" />
        </button>
        <div className="text-sm flex items-center gap-2">
          {!modelReady && <Loader2 className="w-4 h-4 animate-spin" />}
          {modelReady ? status : "Loading model…"}
        </div>
        <div className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          +{sessionCount}
        </div>
      </div>

      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Reticle */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-64 h-64 border-2 border-white/60 rounded-2xl">
          <div className="w-full h-full border-2 border-primary/70 rounded-2xl animate-pulse" />
        </div>
      </div>

      {slow && (
        <div className="absolute top-16 inset-x-4 text-center text-xs bg-warning/30 text-warning px-3 py-1 rounded-full">
          Slow device — detection runs every 1.5s
        </div>
      )}

      {/* Match tray */}
      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="absolute bottom-0 inset-x-0 bg-card text-card-foreground rounded-t-3xl p-3 max-h-[40vh] overflow-x-auto"
          >
            <div className="text-xs text-muted-foreground mb-2 px-1">Matches</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {matches.map((m) => {
                const confirmed = m.similarity >= 0.82;
                return (
                  <div key={m.productId} className="shrink-0 w-36 bg-background rounded-xl border overflow-hidden">
                    <div className="aspect-square bg-muted relative">
                      {m.product.imageBase64 && <img src={m.product.imageBase64} alt={m.product.name} className="w-full h-full object-cover" />}
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${confirmed ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                        {confirmed ? `${Math.round(m.similarity * 100)}%` : `?${Math.round(m.similarity * 100)}%`}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium truncate">{m.product.name}</div>
                      <button
                        onClick={() => { onAdd(m.product); navigator.vibrate?.(30); }}
                        className="mt-1 w-full py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
