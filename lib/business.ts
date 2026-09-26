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
