import { getDb, type Bill, type BillItem, type DiscountType, type PaymentType } from "./db";

export function computeBillTotals(
  items: BillItem[],
  discountType: DiscountType,
  discountValue: number,
  paid: number,
) {
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  let grandTotal = subtotal;
  if (discountType === "percent") grandTotal = subtotal * (1 - (Number(discountValue) || 0) / 100);
  else grandTotal = subtotal - (Number(discountValue) || 0);
  if (grandTotal < 0) grandTotal = 0;
  const pending = Math.max(0, grandTotal - (Number(paid) || 0));
  return { subtotal, grandTotal, pending };
}

export function makeEmptyItem(): BillItem {
  return { productName: "", price: 0, qty: 1, amount: 0 };
}

export async function saveBill(bill: Omit<Bill, "id" | "createdAt" | "updatedAt"> & { id?: number; createdAt?: number }): Promise<number> {
  const db = getDb();
  const now = Date.now();
  if (bill.id) {
    const existing = await db.bills.get(bill.id);
    await db.bills.put({ ...bill, createdAt: existing?.createdAt ?? now, updatedAt: now } as Bill);
    return bill.id;
  } else {
    const id = await db.bills.add({ ...bill, createdAt: now, updatedAt: now } as Bill);
    return id as number;
  }
}

export const PAYMENT_TYPES: PaymentType[] = ["Cash", "UPI", "Card", "Pending", "Mixed"];
