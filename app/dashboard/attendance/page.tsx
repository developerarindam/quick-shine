"use client";

import Link from "next/link";
import { CalendarCheck, Clock, IndianRupee, Users } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { PunchCard, ShiftRow, useMyAttendance } from "@/app/components/attendance";
import { PERIOD_LABEL, PeriodPicker, usePeriod } from "@/app/components/PeriodPicker";
import { Card, EmptyState, ErrorState, Page, SectionTitle, Stat, buttonClass } from "@/app/components/ui";
import { fmtHours, PAY_LABEL } from "@/app/lib/attendanceShared";
import { inr, rangeFor, rangeQuery } from "@/app/lib/format";
import { useMemo } from "react";
import { can } from "@/app/lib/roles";

export default function AttendancePage() {
  const user = useSession();
  const todayQuery = useMemo(() => rangeQuery(rangeFor("today")), []);
  const todayData = useMyAttendance(todayQuery);
  const period = usePeriod("month");
  const history = useMyAttendance(rangeQuery(period.range));
  const s = history.data?.summary;
  const pay = history.data?.pay;

  const refresh = () => {
    todayData.reload();
    history.reload();
  };

  return (
    <Page
      title="Attendance"
      subtitle="Sign in when you reach the shop, sign out when you leave"
      actions={
        can.manageStudio(user.role) && (
          <Link href="/dashboard/attendance/team" className={buttonClass("secondary", "sm")}>
            <Users className="size-4" /> Team
          </Link>
        )
      }
    >
      {todayData.error ? <ErrorState message={todayData.error} onRetry={todayData.reload} /> : <PunchCard data={todayData.data} onChange={refresh} />}

      <SectionTitle>My attendance</SectionTitle>
      <PeriodPicker period={period} />

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Days" value={s?.days ?? "–"} icon={<CalendarCheck className="size-4" />} />
        <Stat label="Hours" value={s ? fmtHours(s.hours) : "–"} icon={<Clock className="size-4" />} tone="blue" />
        <Stat
          label="Earned"
          value={pay ? inr(s?.earned) : "—"}
          sub={pay ? `${PAY_LABEL[pay.type]} ${inr(pay.rate)}` : "Pay not set"}
          icon={<IndianRupee className="size-4" />}
          tone="green"
        />
      </div>
      {!!s?.open && (
        <p className="mt-2 px-1 text-xs text-amber-700">
          {s.open} day(s) without a sign-out aren&apos;t counted in hours until the Super Admin corrects them.
        </p>
      )}

      <div className="mt-3">
        {history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : !history.data ? (
          <Card className="h-40 animate-pulse" />
        ) : history.data.records.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarCheck />} title={`No attendance ${PERIOD_LABEL[period.preset]}`} />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100">
            {history.data.records.map((r) => (
              <ShiftRow key={r._id} shift={r} />
            ))}
          </Card>
        )}
      </div>
    </Page>
  );
}
