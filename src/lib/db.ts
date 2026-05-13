import Dexie, { type Table } from "dexie";

export type CustomerType = "bulk" | "retail";
export type PaymentType = "Cash" | "UPI" | "Card" | "Pending" | "Mixed";
export type DiscountType = "flat" | "percent";

export interface Settings {
  id: number;
  firmName: string;
  tagline: string;
  address1: string;
  address2: string;
  address3: string;
  phone: string;
  gst: string;
  logoBase64: string;
  pin: string;
  theme: "light" | "dark";
  backupReminder: number; // days
  snapQtyMode: "newRow" | "increment";
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address: string;
  type: CustomerType;
  createdAt: number;
}

export interface Product {
  id?: number;
  name: string;
  imageBase64: string;
  createdAt: number;
}

export interface ProductEmbedding {
  productId: number;
  embeddingBase64: string; // base64-encoded Float32Array
}

export interface BillItem {
  productId?: number;
  productName: string;
  price: number;
  qty: number;
  amount: number;
}

export interface Bill {
  id?: number;
  billNumber: number;
  year: number;
  date: string; // ISO date YYYY-MM-DD
  customerId?: number;
  customerName: string;
  customerPhone: string;
  items: BillItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  grandTotal: number;
  paid: number;
  pending: number;
  paymentType: PaymentType;
  createdAt: number;
  updatedAt: number;
}

export class ChawlaDB extends Dexie {
  settings!: Table<Settings, number>;
  customers!: Table<Customer, number>;
  products!: Table<Product, number>;
  productEmbeddings!: Table<ProductEmbedding, number>;
  bills!: Table<Bill, number>;

  constructor() {
    super("ChawlaPlywoodDB");
    this.version(1).stores({
      settings: "id",
      customers: "++id, name, phone, type, createdAt",
      products: "++id, name, createdAt",
      productEmbeddings: "productId",
      bills: "++id, billNumber, year, date, customerId, customerName, paymentType, createdAt, [year+billNumber]",
    });
  }
}

// Lazy singleton — only instantiate in browser
let _db: ChawlaDB | null = null;
export function getDb(): ChawlaDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie unavailable on server");
  }
  if (!_db) _db = new ChawlaDB();
  return _db;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  firmName: "Chawla Plywood",
  tagline: "Quality Plywood & Hardware",
  address1: "Main Market",
  address2: "",
  address3: "",
  phone: "",
  gst: "",
  logoBase64: "",
  pin: "0000",
  theme: "light",
  backupReminder: 7,
  snapQtyMode: "increment",
};

export async function ensureSettings(): Promise<Settings> {
  const db = getDb();
  const existing = await db.settings.get(1);
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function nextBillNumber(year: number): Promise<number> {
  const db = getDb();
  const last = await db.bills.where({ year }).reverse().sortBy("billNumber");
  const max = last.length ? Math.max(...last.map((b) => b.billNumber)) : 0;
  return max + 1;
}

export function formatBillNo(year: number, n: number) {
  return `${year}-${String(n).padStart(3, "0")}`;
}
