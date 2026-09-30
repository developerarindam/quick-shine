"use client";

import { useState } from "react";
import { Check, Plus, Trash2, Users } from "lucide-react";
import { useSession } from "@/app/components/AppShell";
import { Sheet, useConfirm, useToast } from "@/app/components/overlays";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Fab,
  Field,
  Input,
  ListSkeleton,
  Page,
  Switch,
  cn,
} from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/app/lib/roles";
import type { User } from "@/app/lib/types";

const EMPTY = { name: "", email: "", phone: "", password: "", role: "USER" as Role, status: "Active" as User["status"] };
const ROLE_TONE = { ADMIN: "brand", MANAGER: "violet", USER: "gray" } as const;

export default function UsersClient() {
  const me = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi<User[]>("/api/users");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openForm = (u: User | null) => {
    setEditing(u);
    setForm(u ? { name: u.name, email: u.email, phone: u.phone || "", password: "", role: u.role, status: u.status } : EMPTY);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast("Name and email are required", "error");
    if (!editing && form.password.length < 6) return toast("Password must be at least 6 characters", "error");
    setSaving(true);
    try {
      await api(editing ? `/api/users/${editing._id}` : "/api/users", {
        method: editing ? "PUT" : "POST",
        body: form,
      });
      toast(editing ? "Team member updated" : `${form.name} can now sign in`);
      setOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: `Remove ${editing.name}?`,
      message: "If they have job history, their account will be disabled instead.",
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/users/${editing._id}`, { method: "DELETE" });
      toast("Team member removed");
      setOpen(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const isSelf = editing?._id === me.id;

  return (
    <Page
      title="Team"
      subtitle="Who can sign in and what they can do"
      back="/dashboard/more"
      actions={
        <Button size="sm" className="max-lg:hidden" icon={<Plus className="size-4" />} onClick={() => openForm(null)}>
          Add member
        </Button>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<Users />} title="No team members" />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {data.map((u) => (
            <button key={u._id} type="button" onClick={() => openForm(u)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
              <Avatar name={u.name} className={cn(u.status !== "Active" && "grayscale")} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-slate-800">
                  <span className="truncate">{u.name}</span>
                  {u._id === me.id && <span className="text-xs text-slate-400">(you)</span>}
                </p>
                <p className="truncate text-sm text-slate-500">{u.email}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                {u.status !== "Active" && <Badge tone="red">Disabled</Badge>}
              </div>
            </button>
          ))}
        </Card>
      )}

      <Fab label="Add member" icon={<Plus className="size-5" />} onClick={() => openForm(null)} />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit team member" : "Add team member"}
        footer={
          <div className="flex gap-2">
            {editing && !isSelf && (
              <Button variant="danger" size="lg" onClick={remove} aria-label="Remove member">
                <Trash2 className="size-5" />
              </Button>
            )}
            <Button size="lg" className="flex-1" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Create account"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoCapitalize="words" autoFocus={!editing} />
          </Field>
          <Field label="Email (used to sign in)">
            <Input type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Mobile">
            <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label={editing ? "Reset password" : "Password"} hint={editing ? "Leave empty to keep the current password" : "At least 6 characters"}>
            <Input type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>

          <Field label="Role">
            <div className="space-y-2">
              {ROLES.map((r) => {
                const disabled = isSelf && r !== "ADMIN";
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => setForm({ ...form, role: r })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-40",
                      form.role === r ? "border-brand-600 bg-brand-50" : "border-slate-200"
                    )}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{ROLE_LABEL[r]}</p>
                      <p className="text-xs text-slate-500">{ROLE_DESCRIPTION[r]}</p>
                    </div>
                    {form.role === r && <Check className="size-5 text-brand-600" />}
                  </button>
                );
              })}
            </div>
          </Field>

          {editing && !isSelf && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">Can sign in</p>
                <p className="text-xs text-slate-500">Turn off to block access without losing history</p>
              </div>
              <Switch
                checked={form.status === "Active"}
                onChange={(v) => setForm({ ...form, status: v ? "Active" : "Inactive" })}
                label="Account active"
              />
            </div>
          )}
        </div>
      </Sheet>
    </Page>
  );
}
