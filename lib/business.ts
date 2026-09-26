export type BillingPrecision = 1 | 5 | 15 | 60;

export function calculateTableCharge(start: Date, end: Date, hourlyRate: number, pausedSeconds = 0, precision: BillingPrecision = 1) {
  if (end < start || hourlyRate < 0 || pausedSeconds < 0) throw new Error("Invalid billing values");
  const elapsedMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000 - pausedSeconds / 60);
  const billableMinutes = Math.ceil(elapsedMinutes / precision) * precision;
  return Math.round((billableMinutes / 60) * hourlyRate * 100) / 100;
}

export function bookingsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  if (aEnd <= aStart || bEnd <= bStart) throw new Error("End time must be after start time");
  return aStart < bEnd && bStart < aEnd;
}

export function calculateOrderTotal(subtotal: number, tableCharge: number, discount: number, tax: number) {
  if ([subtotal, tableCharge, discount, tax].some((value) => value < 0)) throw new Error("Totals cannot be negative");
  if (discount > subtotal + tableCharge) throw new Error("Discount exceeds subtotal");
  return Math.round((subtotal + tableCharge - discount + tax) * 100) / 100;
}

export function deductInventory(stock: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive integer");
  if (quantity > stock) throw new Error("Insufficient stock");
  return stock - quantity;
}

export function tableStatusAfterSessionClose(current: "available" | "occupied" | "reserved" | "maintenance" | "inactive") {
  return current === "occupied" ? "available" : current;
}
