// Inventory categories the studio adds on top of the built-in ones (Super Admin / Admin)
import InventoryItem, { INVENTORY_CATEGORIES } from "@/app/models/InventoryItem";
import { setSetting } from "@/app/models/Setting";
import { fail, ok, withAuth } from "@/app/lib/auth";
import { CATEGORY_SETTING, customCategories } from "@/app/lib/inventory";
import { MANAGERS } from "@/app/lib/roles";

export const GET = withAuth(MANAGERS, async () => ok(await customCategories()));

/** { label } → adds a category; returns the new list */
export const POST = withAuth(MANAGERS, async (req) => {
  const label = String((await req.json()).label || "").trim().replace(/\s+/g, " ");
  if (!label) return fail("Enter a category name");
  if (label.length > 30) return fail("Keep the name under 30 characters");

  const list = await customCategories();
  const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`;
  const taken = (INVENTORY_CATEGORIES as readonly string[]).includes(value) || list.some((c) => c.value === value || c.label.toLowerCase() === label.toLowerCase());
  if (taken) return fail("That category already exists");

  const next = [...list, { value, label }];
  await setSetting(CATEGORY_SETTING, next);
  return ok(next);
});

/** ?value=<category> → removes a category that no item uses */
export const DELETE = withAuth(MANAGERS, async (req) => {
  const value = new URL(req.url).searchParams.get("value") || "";
  const list = await customCategories();
  if (!list.some((c) => c.value === value)) return fail("Category not found", 404);
  const used = await InventoryItem.countDocuments({ category: value });
  if (used) return fail(`${used} item(s) use this category — move them first`);
  const next = list.filter((c) => c.value !== value);
  await setSetting(CATEGORY_SETTING, next);
  return ok(next);
});
