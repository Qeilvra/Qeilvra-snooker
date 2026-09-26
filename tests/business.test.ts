import { describe, expect, it } from "vitest";
import { bookingsOverlap, calculateOrderTotal, calculateTableCharge, deductInventory, tableStatusAfterSessionClose } from "../lib/business";
import { can } from "../lib/permissions";

describe("hourly billing", () => {
  it("bills actual per-minute usage", () => {
    expect(calculateTableCharge(new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:30:00Z"), 1200)).toBe(1800);
  });
  it("supports configured rounding", () => {
    expect(calculateTableCharge(new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T10:06:00Z"), 600, 0, 5)).toBe(100);
  });
});

describe("booking overlap", () => {
  it("detects intersecting ranges but permits touching ranges", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    const end = new Date("2026-01-01T11:00:00Z");
    expect(bookingsOverlap(start, end, new Date("2026-01-01T10:30:00Z"), new Date("2026-01-01T11:30:00Z"))).toBe(true);
    expect(bookingsOverlap(start, end, end, new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });
});

describe("permissions", () => {
  it("keeps sensitive operations away from staff", () => {
    expect(can("staff", "pos.use")).toBe(true);
    expect(can("staff", "reports.view")).toBe(false);
    expect(can("staff", "discounts.apply")).toBe(false);
    expect(can("manager", "discounts.apply")).toBe(true);
  });
});

describe("order and inventory integrity", () => {
  it("applies discounts and tax without floating point drift", () => {
    expect(calculateOrderTotal(1000, 500, 100, 70)).toBe(1470);
  });
  it("rejects overselling inventory", () => {
    expect(deductInventory(10, 3)).toBe(7);
    expect(() => deductInventory(2, 3)).toThrow("Insufficient stock");
  });
});

describe("session closing", () => {
  it("releases occupied tables without clearing explicit maintenance", () => {
    expect(tableStatusAfterSessionClose("occupied")).toBe("available");
    expect(tableStatusAfterSessionClose("maintenance")).toBe("maintenance");
  });
});
