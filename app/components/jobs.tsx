"use client";

import Link from "next/link";
import { ChevronRight, User2 } from "lucide-react";
import { STATUS_META, balanceOf, jobLabel, paymentState, type JobStatus } from "@/app/lib/jobs";
import { fmtWhen, inr, phoneDigits } from "@/app/lib/format";
import { serviceName, type Job } from "@/app/lib/types";
import { Badge, Card, Plate, TONE_DOT, cn } from "./ui";

export function StatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", TONE_DOT[meta.tone])} />
      {meta.short}
    </Badge>
  );
}

export function PayBadge({ job }: { job: Job }) {
  const st = paymentState(job);
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

export function JobCard({ job }: { job: Job }) {
  const bike = job.bikeId;
  const due = balanceOf(job);
  return (
    <Link href={`/dashboard/service-entry/${job._id}`} className="block">
      <Card className="p-4 transition active:scale-[0.99] active:bg-slate-50">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Plate number={bike?.bikeNumber || "—"} size="sm" />
              <StatusBadge status={job.status} />
              {due > 0 && <PayBadge job={job} />}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-slate-800">
              {[bike?.model, bike?.ownerName].filter(Boolean).join(" · ") || "Walk-in customer"}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">{job.services.map(serviceName).join(", ")}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold tabular-nums text-slate-900">{inr(job.total)}</p>
            <p className="text-xs text-slate-400">{jobLabel(job)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
          <span>{fmtWhen(job.createdAt)}</span>
          <span className="flex items-center gap-1">
            {job.assignedTo?.name && (
              <>
                <User2 className="size-3.5" />
                {job.assignedTo.name}
              </>
            )}
            <ChevronRight className="size-4 text-slate-300" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

/** Pre-filled WhatsApp message for the customer: receipt, or "ready for pickup". */
export function whatsappLink(job: Job) {
  const bike = job.bikeId;
  const due = balanceOf(job);
  const lines: string[] = [];
  const name = bike?.ownerName ? ` ${bike.ownerName}` : "";

  if (job.status === "completed") {
    lines.push(`Hi${name}, your bike *${bike?.bikeNumber}* is shining and ready for pickup at Quick Shine! ✨`);
  } else {
    lines.push(`Hi${name}, thank you for choosing Quick Shine! ✨`);
  }
  lines.push("", `*Job ${jobLabel(job)}* — ${bike?.bikeNumber || ""}`);
  for (const s of job.services) lines.push(`• ${serviceName(s)}: ${inr(s.price)}`);
  if (job.subtotal !== job.total) lines.push(`Discount: −${inr(job.subtotal - job.total)}`);
  lines.push(`*Total: ${inr(job.total)}*`);
  if (due > 0) lines.push(`Balance due: ${inr(due)}`);
  else lines.push("Paid in full ✅");
  lines.push("", "See you again! 🏍️");

  const phone = phoneDigits(bike?.phone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
