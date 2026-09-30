"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Droplets,
  Hammer,
  Home,
  Megaphone,
  MoreHorizontal,
  Plus,
  Receipt,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import {
  Button,
  Card,
  Chips,
  EmptyState,
  ErrorState,
  Fab,
  Field,
  Input,
  ListSkeleton,
  MoneyInput,
  Page,
  SectionTitle,
  Segmented,
  Textarea,
  cn,
} from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import {
  RANGE_LABEL,
  capitalize,
  endOfDay,
  fmtDate,
  fromDateInput,
  inr,
  rangeFor,
  rangeQuery,
  toDateInput,
  type RangePreset,
} from "@/app/lib/format";
import type { PaymentMode } from "@/app/lib/jobs";
import type { Expense } from "@/app/lib/types";

const CATEGORIES = [
  { value: "supplies", label: "Supplies", icon: Droplets },
  { value: "salary", label: "Salary", icon: Users },
  { value: "rent", label: "Rent", icon: Home },
  { value: "utilities", label: "Utilities", icon: Zap },
  { value: "equipment", label: "Equipment", icon: Hammer },
  { value: "marketing", label: "Marketing", icon: Megaphone },
  { value: "other", label: "Other", icon: MoreHorizontal },
];
const iconFor = (c: string) => CATEGORIES.find((x) => x.value === c)?.icon || MoreHorizontal;

const emptyForm = () => ({
  title: "",
  amount: "",
  category: "supplies",
  mode: "cash" as PaymentMode,
  date: toDateInput(new Date()),
  note: "",
});

export default function ExpensesClient() {
  return (
    <Suspense>
      <Expenses />
    </Suspense>
  );
}

function Expenses() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();

  const [preset, setPreset] = useState<Exclude<RangePreset, "custom">>("month");
  const range = useMemo(() => rangeFor(preset), [preset]);
  const { data, loading, error, reload } = useApi<Expense[]>(`/api/expenses?${rangeQuery(range)}`);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.get("add")) openForm(null);
  }, [params]);

  const openForm = (e: Expense | null) => {
    setEditing(e);
    setForm(
      e
        ? { title: e.title, amount: String(e.amount), category: e.category, mode: e.mode, date: toDateInput(new Date(e.date)), note: e.note || "" }
        : emptyForm()
    );
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (params.get("add")) router.replace("/dashboard/expenses");
  };

  const save = async () => {
    if (!(Number(form.amount) > 0)) return toast("Enter an amount", "error");
    const title = form.title.trim() || CATEGORIES.find((c) => c.value === form.category)?.label || "Expense";
    setSaving(true);
    try {
      // noon local time keeps the expense on the chosen day in any timezone math
      const date = fromDateInput(form.date);
      date.setHours(12);
      await api(editing ? `/api/expenses/${editing._id}` : "/api/expenses", {
        method: editing ? "PUT" : "POST",
        body: { ...form, title, amount: Number(form.amount), date: date.toISOString() },
      });
      toast(editing ? "Expense updated" : "Expense added");
      close();
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({ title: "Delete this expense?", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/expenses/${editing._id}`, { method: "DELETE" });
      toast("Expense deleted");
      close();
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const total = (data || []).reduce((s, e) => s + e.amount, 0);
  const byDay = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const e of data || []) {
      const key = toDateInput(new Date(e.date));
      groups.set(key, [...(groups.get(key) || []), e]);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <Page
      title="Expenses"
      back="/dashboard/more"
      actions={
        <Button size="sm" className="max-lg:hidden" icon={<Plus className="size-4" />} onClick={() => openForm(null)}>
          Add expense
        </Button>
      }
    >
      <Chips
        value={preset}
        onChange={setPreset}
        options={(["today", "week", "month", "lastMonth"] as const).map((p) => ({ value: p, label: RANGE_LABEL[p] }))}
      />

      <Card className="mt-3 flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-slate-500">Total spent · {RANGE_LABEL[preset].toLowerCase()}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{inr(total)}</p>
        </div>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Receipt className="size-6" />
        </span>
      </Card>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="mt-4">
          <ListSkeleton />
        </div>
      ) : byDay.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Receipt />}
            title="No expenses recorded"
            text="Track shampoo, polish, salaries and rent to see your real profit."
            action={<Button onClick={() => openForm(null)}>Add expense</Button>}
          />
        </Card>
      ) : (
        byDay.map(([day, items]) => (
          <div key={day}>
            <SectionTitle action={<span className="text-xs font-semibold tabular-nums text-slate-500">{inr(items.reduce((s, e) => s + e.amount, 0))}</span>}>
              {fmtDate(fromDateInput(day))}
            </SectionTitle>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {items.map((e) => {
                const Icon = iconFor(e.category);
                return (
                  <button key={e._id} type="button" onClick={() => openForm(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{e.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {capitalize(e.category)} · {e.mode === "online" ? "Online" : "Cash"}
                        {e.createdBy?.name ? ` · ${e.createdBy.name}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-slate-900">{inr(e.amount)}</span>
                  </button>
                );
              })}
            </Card>
          </div>
        ))
      )}

      <Fab label="Add expense" icon={<Plus className="size-5" />} onClick={() => openForm(null)} />

      <Sheet
        open={open}
        onClose={close}
        title={editing ? "Edit expense" : "Add expense"}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="lg" onClick={remove} aria-label="Delete expense">
                <Trash2 className="size-5" />
              </Button>
            )}
            <Button size="lg" className="flex-1" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Amount">
            <MoneyInput
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className="h-14 text-2xl font-bold"
              autoFocus={!editing}
            />
          </Field>
          <Field label="Category">
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-[11px] font-semibold transition",
                    form.category === c.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"
                  )}
                >
                  <c.icon className="size-5" />
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="What for?">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Snow foam 5L" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={form.date} max={toDateInput(endOfDay(new Date()))} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Paid by">
              <Segmented
                value={form.mode}
                onChange={(mode) => setForm({ ...form, mode })}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "online", label: "Online" },
                ]}
                className="h-12"
              />
            </Field>
          </div>
          <Field label="Note">
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" className="min-h-20" />
          </Field>
        </div>
      </Sheet>
    </Page>
  );
}
