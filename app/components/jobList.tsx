"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Clock, User2 } from "lucide-react";
import { fmtDate, fmtTime, fmtWhen, inr } from "@/app/lib/format";
import type { JobRow, SortKey } from "@/app/lib/jobRows";
import { StatusBadge, PayBadge } from "./jobs";
import type { SheetData } from "write-excel-file/browser";
import { Card, Plate, cn } from "./ui";

const when = (d: Date | null) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : "—");
const money = (n: number) => (n ? inr(n) : "—");
// table cells are narrow: "Sanjay Sutradhar, Chandan Manna" → "Sanjay, Chandan" (full names on hover)
const firstNames = (names: string) =>
  names
    .split(",")
    .map((n) => n.trim().split(/\s+/)[0])
    .filter(Boolean)
    .join(", ");

/* ───────────── Grid card ───────────── */

export function JobGridCard({ row }: { row: JobRow }) {
  return (
    <Link href={`/dashboard/service-entry/${row.id}`} className="block">
      <Card className="flex h-full flex-col p-4 transition active:scale-[0.99] active:bg-slate-50">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Plate number={row.bikeNumber || "—"} size="sm" />
              <StatusBadge status={row.status} />
              {row.due > 0 && <PayBadge job={row.job} />}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-slate-800">{[row.model, row.owner].filter(Boolean).join(" · ") || "Walk-in customer"}</p>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">{row.services}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold tabular-nums text-slate-900">{inr(row.total)}</p>
            <p className="text-xs text-slate-400">{row.label}</p>
            {row.discount > 0 && <p className="text-[11px] font-medium text-emerald-600">−{inr(row.discount)} off</p>}
          </div>
        </div>

        {/* Payment */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
          {row.cash > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Cash {inr(row.cash)}</span>}
          {row.online > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Online {inr(row.online)}</span>}
          {row.due > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600">Due {inr(row.due)}</span>}
          {row.collectedBy && <span className="font-medium text-slate-400">· by {row.collectedBy}</span>}
        </div>

        {/* When */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500" style={{ marginTop: "0.75rem" }}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 shrink-0" /> In {fmtWhen(row.inAt)}
            </span>
            {row.doneAt && (
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="size-3.5 shrink-0" /> {row.doneKind === "delivered" ? "Delivered" : "Ready"} {fmtWhen(row.doneAt)}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {row.doneBy && (
              <>
                <User2 className="size-3.5" />
                {row.doneBy}
              </>
            )}
            <ChevronRight className="size-4 text-slate-300" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

/* ───────────── Phone list row ───────────── */

export function JobListRow({ row }: { row: JobRow }) {
  return (
    <Link href={`/dashboard/service-entry/${row.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-slate-900">{row.bikeNumber || "—"}</span>
          <StatusBadge status={row.status} />
        </div>
        <p className="truncate text-xs text-slate-500">
          {row.services} · {fmtWhen(row.inAt)}
        </p>
        <p className="truncate text-[11px] tabular-nums text-slate-400">
          {[row.cash ? `Cash ${inr(row.cash)}` : "", row.online ? `Online ${inr(row.online)}` : "", row.due ? `Due ${inr(row.due)}` : "", row.doneBy]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold tabular-nums text-slate-900">{inr(row.total)}</p>
        <p className="text-[11px] text-slate-400">{row.label}</p>
      </div>
    </Link>
  );
}

/* ───────────── Desktop table ───────────── */

type Col = { key: string; label: string; sort?: [SortKey, SortKey?]; align?: "right"; className?: string };

const COLS: Col[] = [
  { key: "job", label: "Job", sort: ["jobno"] },
  { key: "in", label: "In → Done", sort: ["new", "old"] },
  { key: "bike", label: "Bike · customer", sort: ["bike"] },
  { key: "svc", label: "Services", className: "min-w-40" },
  { key: "by", label: "Done by" },
  { key: "st", label: "Status" },
  { key: "total", label: "Total", sort: ["amt_desc", "amt_asc"], align: "right" },
  { key: "disc", label: "Disc.", align: "right" },
  { key: "cash", label: "Cash", align: "right" },
  { key: "online", label: "Online", align: "right" },
  { key: "due", label: "Due", sort: ["due"], align: "right" },
  { key: "coll", label: "Collected" },
];

export function JobTable({
  rows,
  totals,
  sort,
  onSort,
}: {
  rows: JobRow[];
  totals: { count: number; total: number; discount: number; cash: number; online: number; due: number };
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0_rgb(226_232_240)]">
            <tr>
              {COLS.map((c) => {
                const active = c.sort?.includes(sort);
                const next = c.sort ? (c.sort[1] && sort === c.sort[0] ? c.sort[1] : c.sort[0]) : null;
                return (
                  <th key={c.key} className={cn("whitespace-nowrap px-2.5 py-2.5", c.align === "right" && "text-right", c.className)}>
                    {next ? (
                      <button
                        type="button"
                        onClick={() => onSort(next)}
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-slate-800", active && "text-brand-700")}
                      >
                        {c.label}
                        {active && (sort === "old" || sort === "amt_asc" || sort === "jobno" || sort === "bike" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => (window.location.href = `/dashboard/service-entry/${r.id}`)}>
                <td className="whitespace-nowrap px-2.5 py-2.5">
                  <Link href={`/dashboard/service-entry/${r.id}`} className="font-semibold text-brand-700" onClick={(e) => e.stopPropagation()}>
                    {r.label}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                  {when(r.inAt)}
                  <span className={cn("block text-xs", r.doneAt ? "text-emerald-700" : "text-slate-400")}>
                    {r.doneAt ? `${r.doneKind === "delivered" ? "✓ Delivered" : "Ready"} ${fmtTime(r.doneAt)}${fmtDate(r.doneAt) !== fmtDate(r.inAt) ? `, ${fmtDate(r.doneAt)}` : ""}` : "not done yet"}
                  </span>
                </td>
                <td className="max-w-44 px-2.5 py-2" title={[r.owner, r.phone, r.model].filter(Boolean).join(" · ")}>
                  <span className="block whitespace-nowrap font-mono font-semibold text-slate-900">{r.bikeNumber || "—"}</span>
                  {(r.owner || r.phone || r.model) && (
                    <span className="block truncate text-xs text-slate-500">{[r.owner, r.phone].filter(Boolean).join(" · ") || r.model}</span>
                  )}
                </td>
                <td className="max-w-52 px-2.5 py-2.5 text-slate-700">{r.services}</td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600" title={r.doneBy}>
                  {firstNames(r.doneBy) || "—"}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{inr(r.total)}</td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-emerald-600">{r.discount ? `−${inr(r.discount)}` : "—"}</td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-slate-700">{money(r.cash)}</td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-sky-700">{money(r.online)}</td>
                <td className={cn("whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums", r.due ? "font-semibold text-red-600" : "text-slate-400")}>{money(r.due)}</td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600" title={r.collectedBy}>
                  {firstNames(r.collectedBy) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgb(226_232_240)]">
            <tr>
              <td className="px-2.5 py-2.5" colSpan={6}>
                Total · {totals.count} job{totals.count === 1 ? "" : "s"}
              </td>
              <td className="px-2.5 py-2.5 text-right tabular-nums">{inr(totals.total)}</td>
              <td className="px-2.5 py-2.5 text-right tabular-nums text-emerald-600">{totals.discount ? `−${inr(totals.discount)}` : "—"}</td>
              <td className="px-2.5 py-2.5 text-right tabular-nums">{inr(totals.cash)}</td>
              <td className="px-2.5 py-2.5 text-right tabular-nums text-sky-700">{inr(totals.online)}</td>
              <td className="px-2.5 py-2.5 text-right tabular-nums text-red-600">{inr(totals.due)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ───────────── Excel export ───────────── */

export async function exportJobsToExcel(rows: JobRow[], fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = [
    "Job",
    "Date in",
    "Done (delivered / ready)",
    "Status",
    "Bike number",
    "Owner",
    "Phone",
    "Model",
    "Services",
    "Done by",
    "Subtotal",
    "Discount",
    "Total",
    "Cash",
    "Online",
    "Due",
    "Collected by",
    "Notes",
  ].map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#E8EEF6" }));

  const dt = "dd/mm/yyyy hh:mm AM/PM";
  const amount = (n: number) => ({ value: n, type: Number, format: "#,##0.00" });
  const data: unknown[][] = [
    header,
    ...rows.map((r) => [
      r.label,
      { value: r.inAt, type: Date, format: dt },
      r.doneAt ? { value: r.doneAt, type: Date, format: dt } : "",
      r.statusLabel,
      r.bikeNumber,
      r.owner,
      r.phone,
      r.model,
      r.services,
      r.doneBy,
      amount(r.subtotal),
      amount(r.discount),
      amount(r.total),
      amount(r.cash),
      amount(r.online),
      amount(r.due),
      r.collectedBy,
      r.notes,
    ]),
  ];
  const sum = (k: "subtotal" | "discount" | "total" | "cash" | "online" | "due") => ({
    value: rows.reduce((s, r) => s + r[k], 0),
    type: Number,
    format: "#,##0.00",
    fontWeight: "bold" as const,
  });
  data.push([
    { value: `Total (${rows.length} jobs)`, fontWeight: "bold" as const },
    "", "", "", "", "", "", "", "", "",
    sum("subtotal"), sum("discount"), sum("total"), sum("cash"), sum("online"), sum("due"),
    "", "",
  ]);

  await writeXlsxFile(data as unknown as SheetData, {
    sheet: "Jobs",
    stickyRowsCount: 1,
    columns: [8, 20, 22, 10, 14, 16, 13, 16, 32, 14, 10, 10, 10, 10, 10, 10, 16, 24].map((width) => ({ width })),
  }).toFile(fileName);
}
