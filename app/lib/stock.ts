// Stock level helpers — shared between server and client.

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(item: { stock: number; minStock?: number }): StockLevel {
  if (item.stock <= 0) return "out";
  if ((item.minStock || 0) > 0 && item.stock <= (item.minStock || 0)) return "low";
  return "ok";
}

/** Mongo filter for items that need restocking (out of stock or at/below reorder level). */
export const LOW_STOCK_FILTER = {
  isActive: true,
  $or: [{ stock: { $lte: 0 } }, { $expr: { $and: [{ $gt: ["$minStock", 0] }, { $lte: ["$stock", "$minStock"] }] } }],
};

export function fmtQty(n: number, unit?: string) {
  const v = Math.round(n * 100) / 100;
  return `${v.toLocaleString("en-IN")}${unit ? ` ${unit}` : ""}`;
}
