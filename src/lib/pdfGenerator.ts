import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bill, Settings } from "./db";
import { formatBillNo } from "./db";
import { formatINR, isoToDisplay } from "./format";

export function generateInvoicePDF(bill: Bill, settings: Settings): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 28;

  // Top blessing
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text("|| Shri Ganeshay Namaha ||", W / 2, y, { align: "center" });
  y += 18;

  // Logo + firm info (left)
  if (settings.logoBase64) {
    try { doc.addImage(settings.logoBase64, "PNG", 28, y, 56, 56); } catch {}
  }
  const leftX = settings.logoBase64 ? 92 : 28;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(settings.firmName, leftX, y + 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (settings.tagline) doc.text(settings.tagline, leftX, y + 28);
  const addrLines = [settings.address1, settings.address2, settings.address3].filter(Boolean);
  addrLines.forEach((l, i) => doc.text(l, leftX, y + 40 + i * 11));
  if (settings.phone) doc.text(`Phone: ${settings.phone}`, leftX, y + 40 + addrLines.length * 11);
  if (settings.gst) doc.text(`GST: ${settings.gst}`, leftX, y + 52 + addrLines.length * 11);

  // Bill no & date (right)
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Bill No: ${formatBillNo(bill.year, bill.billNumber)}`, W - 28, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${isoToDisplay(bill.date)}`, W - 28, y + 30, { align: "right" });

  y += 100;
  doc.setLineWidth(0.5);
  doc.line(28, y, W - 28, y);
  y += 14;

  // Customer
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Bill To:", 28, y);
  doc.setFont("helvetica", "normal");
  doc.text(bill.customerName || "—", 70, y);
  if (bill.customerPhone) doc.text(`Ph: ${bill.customerPhone}`, W - 28, y, { align: "right" });
  y += 14;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["Sr", "Product", "Price", "Qty", "Amount"]],
    body: bill.items.map((it, i) => [
      String(i + 1),
      it.productName,
      formatINR(it.price),
      String(it.qty),
      formatINR(it.amount),
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [140, 50, 30], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      2: { halign: "right" },
      3: { halign: "center" },
      4: { halign: "right" },
    },
  });

  // @ts-expect-error lastAutoTable on doc
  let endY = doc.lastAutoTable.finalY + 16;
  const rightX = W - 28;
  const labelX = W - 180;

  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Subtotal:", labelX, endY);
  doc.text(formatINR(bill.subtotal), rightX, endY, { align: "right" });
  endY += 14;

  if (bill.discountValue > 0) {
    const disp = bill.discountType === "percent" ? `${bill.discountValue}%` : formatINR(bill.discountValue);
    doc.text(`Discount (${disp}):`, labelX, endY);
    doc.text("-" + formatINR(bill.subtotal - bill.grandTotal), rightX, endY, { align: "right" });
    endY += 14;
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Grand Total:", labelX, endY);
  doc.text(formatINR(bill.grandTotal), rightX, endY, { align: "right" });
  endY += 16;

  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Paid (${bill.paymentType}):`, labelX, endY);
  doc.text(formatINR(bill.paid), rightX, endY, { align: "right" });
  endY += 14;

  if (bill.pending > 0) {
    doc.setTextColor(180, 30, 30);
    doc.text("Pending:", labelX, endY);
    doc.text(formatINR(bill.pending), rightX, endY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    endY += 14;
  }

  // Footer
  endY = Math.max(endY + 60, doc.internal.pageSize.getHeight() - 80);
  doc.setFont("helvetica", "italic"); doc.setFontSize(10);
  doc.text("Thank you for your business!", W / 2, endY, { align: "center" });
  endY += 30;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Authorized Signatory", W - 28, endY, { align: "right" });
  doc.line(W - 160, endY - 4, W - 28, endY - 4);

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
