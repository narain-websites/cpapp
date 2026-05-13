import { useState } from "react";
import { motion } from "framer-motion";
import { unlock } from "@/lib/authStore";
import { toast } from "sonner";

export function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const append = (d: string) => {
    setError(false);
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) tryUnlock(next);
  };

  const tryUnlock = async (p: string) => {
    const ok = await unlock(p);
    if (ok) { onUnlock(); }
    else {
      setError(true);
      setPin("");
      toast.error("Wrong PIN");
      navigator.vibrate?.(80);
    }
  };

  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card text-card-foreground rounded-2xl shadow-xl p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
            CP
          </div>
          <h1 className="mt-4 text-2xl font-bold">Chawla Plywood</h1>
          <p className="text-sm text-muted-foreground">Enter PIN to continue</p>
        </div>

        <motion.div
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex justify-center gap-3 mb-8"
        >
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < pin.length ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => append(d)}
              className="h-14 rounded-xl bg-secondary hover:bg-accent text-xl font-semibold transition-colors active:scale-95"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => append("0")}
            className="h-14 rounded-xl bg-secondary hover:bg-accent text-xl font-semibold transition-colors active:scale-95"
          >
            0
          </button>
          <button
            onClick={back}
            className="h-14 rounded-xl bg-muted hover:bg-accent text-sm font-medium transition-colors active:scale-95"
          >
            ⌫
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Default PIN: <span className="font-mono">0000</span>
        </p>
      </motion.div>
    </div>
  );
}
