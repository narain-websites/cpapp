import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bill, Settings } from "./db";
import { formatBillNo } from "./db";
import { isoToDisplay } from "./format";

function rs(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateInvoicePDF(bill: Bill, settings: Settings): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36; // margin
  let y = 32;

  // Top blessing
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("|| Shri Ganeshay Namaha ||", W / 2, y, { align: "center" });
  y += 22;

  // Logo top-right
  const logoSize = 64;
  if (settings.logoBase64) {
    try { doc.addImage(settings.logoBase64, "PNG", W - M - logoSize, y - 6, logoSize, logoSize); } catch {}
  }

  // Firm details centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(settings.firmName, W / 2, y + 8, { align: "center" });

  let cy = y + 24;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  if (settings.tagline) {
    doc.text(settings.tagline, W / 2, cy, { align: "center" });
    cy += 13;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addr = [settings.address1, settings.address2, settings.address3].filter(Boolean).join(", ");
  if (addr) { doc.text(addr, W / 2, cy, { align: "center" }); cy += 12; }
  const contactBits: string[] = [];
  if (settings.phone) contactBits.push(`Phone: ${settings.phone}`);
  if (settings.gst) contactBits.push(`GST: ${settings.gst}`);
  if (contactBits.length) { doc.text(contactBits.join("   |   "), W / 2, cy, { align: "center" }); cy += 12; }

  y = Math.max(cy, y + logoSize) + 10;

  // Divider
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 16;

  // Bill meta row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Bill No: ${formatBillNo(bill.year, bill.billNumber)}`, M, y);
  doc.text(`Date: ${isoToDisplay(bill.date)}`, W - M, y, { align: "right" });
  y += 18;

  // Customer block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Bill To:", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(bill.customerName || "—", M + 50, y);
  y += 13;
  if (bill.customerPhone) {
    doc.setFontSize(9);
    doc.text(`Ph: ${bill.customerPhone}`, M + 50, y);
    y += 12;
  }
  y += 6;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["Sr", "Product", "Price", "Qty", "Amount"]],
    body: bill.items.map((it, i) => [
      String(i + 1),
      it.productName,
      rs(it.price),
      String(it.qty),
      rs(it.amount),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 10, cellPadding: 7 },
    headStyles: { fillColor: [140, 50, 30], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32, halign: "center" },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "center", cellWidth: 50 },
      4: { halign: "right", cellWidth: 100 },
    },
  });

  // @ts-expect-error lastAutoTable on doc
  let endY = doc.lastAutoTable.finalY + 18;
  const rightX = W - M;
  const labelX = W - 220;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal:", labelX, endY);
  doc.text(rs(bill.subtotal), rightX, endY, { align: "right" });
  endY += 15;

  if (bill.discountValue > 0) {
    doc.text("Discount:", labelX, endY);
    doc.text("-" + rs(bill.subtotal - bill.grandTotal), rightX, endY, { align: "right" });
    endY += 15;
  }

  doc.setLineWidth(0.4);
  doc.line(labelX, endY - 4, rightX, endY - 4);
  endY += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Grand Total:", labelX, endY);
  doc.text(rs(bill.grandTotal), rightX, endY, { align: "right" });
  endY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Paid (${bill.paymentType}):`, labelX, endY);
  doc.text(rs(bill.paid), rightX, endY, { align: "right" });
  endY += 15;

  if (bill.pending > 0) {
    doc.setTextColor(180, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Pending:", labelX, endY);
    doc.text(rs(bill.pending), rightX, endY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    endY += 15;
  }

  // Footer
  const footerY = Math.max(endY + 50, H - 70);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text("Thank you for your business!", W / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subject to Kolhapur Judiciary only.", W / 2, footerY + 16, { align: "center" });

  return doc;
}

export function downloadInvoice(bill: Bill, settings: Settings) {
  const doc = generateInvoicePDF(bill, settings);
  doc.save(`Bill-${formatBillNo(bill.year, bill.billNumber)}.pdf`);
}

export function printInvoice(bill: Bill, settings: Settings) {
  const doc = generateInvoicePDF(bill, settings);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}
