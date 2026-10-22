"use client";

import { useState } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { useConfirm, useToast } from "@/app/components/overlays";
import { Button, Card, ErrorState, ListSkeleton, Page, Switch, cn } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { PERMISSIONS, ROLE_LABEL, type PermKey, type PermMatrix, type PermRole } from "@/app/lib/roles";

type Data = { matrix: PermMatrix; defaults: PermMatrix };
const ROLES: PermRole[] = ["MANAGER", "USER"];

export default function PermissionsClient() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, error, reload } = useApi<Data>("/api/permissions");
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (body: unknown, key: string) => {
    setSaving(key);
    try {
      setData(await api<Data>("/api/permissions", { method: "PUT", body }));
    } catch (e) {
      toast((e as Error).message, "error");
      reload();
    } finally {
      setSaving(null);
    }
  };

  const toggle = (role: PermRole, key: PermKey, value: boolean) => {
    if (!data) return;
    const matrix = { ...data.matrix, [role]: { ...data.matrix[role], [key]: value } };
    setData({ ...data, matrix }); // show it straight away
    save({ matrix }, `${role}.${key}`);
  };

  const reset = async () => {
    const ok = await confirm({ title: "Reset permissions?", message: "Admins and Staff go back to the standard permissions.", confirmText: "Reset" });
    if (ok) {
      await save({ reset: true }, "reset");
      toast("Permissions reset");
    }
  };

  return (
    <Page
      title="Permissions"
      subtitle="What Admins and Staff are allowed to do"
      back="/dashboard/more"
      actions={
        <Button size="sm" variant="outline" icon={<RotateCcw className="size-4" />} onClick={reset} loading={saving === "reset"}>
          Reset
        </Button>
      }
    >
      <p className="mb-3 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          The Super Admin can always do everything. Changes apply to the next thing a person does — their menus update when they reopen the app.
        </span>
      </p>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <ListSkeleton rows={6} />
      ) : (
        <Card className="divide-y divide-slate-100">
          <div className="hidden items-center gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:flex">
            <span className="flex-1">Permission</span>
            {ROLES.map((r) => (
              <span key={r} className="w-16 text-center">
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
          {PERMISSIONS.map((p) => (
            <div key={p.key} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-500">{p.hint}</p>
              </div>
              <div className="flex gap-6 sm:gap-4">
                {ROLES.map((r) => {
                  const on = data.matrix[r][p.key];
                  const changed = on !== data.defaults[r][p.key];
                  return (
                    <label key={r} className="flex items-center gap-2 sm:w-16 sm:justify-center">
                      <span className={cn("text-sm text-slate-600 sm:hidden", changed && "font-semibold text-brand-700")}>{ROLE_LABEL[r]}</span>
                      <Switch checked={on} onChange={(v) => toggle(r, p.key, v)} label={`${ROLE_LABEL[r]}: ${p.label}`} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
