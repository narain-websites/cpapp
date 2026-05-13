import { useEffect, useState, useCallback } from "react";
import { ensureSettings, getDb } from "./db";

const SESSION_KEY = "chawla_unlocked";
const LAST_ACTIVITY_KEY = "chawla_last_activity";
const AUTO_LOCK_MS = 5 * 60 * 1000;

let listeners: Array<() => void> = [];
function notify() { listeners.forEach((l) => l()); }

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SESSION_KEY) !== "1") return false;
  const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
  if (Date.now() - last > AUTO_LOCK_MS) {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
  return true;
}

export function touchActivity() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export async function unlock(pin: string): Promise<boolean> {
  const s = await ensureSettings();
  if (s.pin === pin) {
    sessionStorage.setItem(SESSION_KEY, "1");
    touchActivity();
    notify();
    return true;
  }
  return false;
}

export function lock() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  notify();
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const s = await ensureSettings();
  if (s.pin !== oldPin) return false;
  await getDb().settings.update(1, { pin: newPin });
  return true;
}

export function useAuth() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setUnlocked(isUnlocked());
    listeners.push(sync);
    sync();
    setReady(true);
    const interval = setInterval(sync, 30 * 1000);
    const onActivity = () => { if (isUnlocked()) touchActivity(); };
    ["click", "keydown", "touchstart", "mousemove"].forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );
    return () => {
      listeners = listeners.filter((l) => l !== sync);
      clearInterval(interval);
      ["click", "keydown", "touchstart", "mousemove"].forEach((e) =>
        window.removeEventListener(e, onActivity)
      );
    };
  }, []);

  const doLock = useCallback(() => lock(), []);
  return { unlocked, ready, lock: doLock };
}
