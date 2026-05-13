import { getDb, type Customer } from "./db";

export function customersToCSV(customers: Customer[]): string {
  const headers = ["Name", "Phone", "Address", "Type"];
  const rows = customers.map((c) =>
    [c.name, c.phone, c.address, c.type]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function customersToVCF(customers: Customer[]): string {
  return customers
    .map((c) =>
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${c.name}`,
        `TEL;TYPE=CELL:${c.phone}`,
        c.address ? `ADR:;;${c.address};;;;` : "",
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

export function parseCSVCustomers(text: string): Omit<Customer, "id" | "createdAt">[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const dataLines = lines[0].toLowerCase().includes("name") ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const cols = parseCSVLine(line);
    const [name = "", phone = "", address = "", type = "retail"] = cols;
    return {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      type: (type.trim().toLowerCase() === "bulk" ? "bulk" : "retail") as "bulk" | "retail",
    };
  }).filter((c) => c.name);
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function backupAll(): Promise<Blob> {
  const db = getDb();
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    customers: await db.customers.toArray(),
    products: await db.products.toArray(),
    productEmbeddings: await db.productEmbeddings.toArray(),
    bills: await db.bills.toArray(),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

export async function restoreAll(text: string) {
  const data = JSON.parse(text);
  const db = getDb();
  await db.transaction("rw", [db.settings, db.customers, db.products, db.productEmbeddings, db.bills], async () => {
    await Promise.all([
      db.settings.clear(), db.customers.clear(), db.products.clear(),
      db.productEmbeddings.clear(), db.bills.clear(),
    ]);
    if (data.settings?.length) await db.settings.bulkPut(data.settings);
    if (data.customers?.length) await db.customers.bulkPut(data.customers);
    if (data.products?.length) await db.products.bulkPut(data.products);
    if (data.productEmbeddings?.length) await db.productEmbeddings.bulkPut(data.productEmbeddings);
    if (data.bills?.length) await db.bills.bulkPut(data.bills);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
