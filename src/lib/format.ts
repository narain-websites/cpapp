export function formatINR(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
