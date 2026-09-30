"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/app/components/AppShell";
import { useToast } from "@/app/components/overlays";
import { Avatar, Badge, Button, Card, Field, Input, Page, SectionTitle } from "@/app/components/ui";
import { api } from "@/app/lib/api";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/app/lib/roles";

export default function ProfilePage() {
  const user = useSession();
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState<"" | "profile" | "password">("");

  const saveProfile = async () => {
    setSaving("profile");
    try {
      await api("/api/profile", { method: "PUT", body: profile });
      toast("Profile saved");
      router.refresh(); // re-read the session so the name updates everywhere
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving("");
    }
  };

  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) return toast("New passwords don't match", "error");
    setSaving("password");
    try {
      await api("/api/profile", { method: "PUT", body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      toast("Password changed");
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving("");
    }
  };

  return (
    <Page title="My profile" back="/dashboard/more">
      <Card className="flex flex-col items-center p-6 text-center">
        <Avatar name={user.name} className="size-20 text-2xl" />
        <p className="mt-3 text-lg font-semibold text-slate-900">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
        <Badge tone="brand" className="mt-2">
          {ROLE_LABEL[user.role]}
        </Badge>
        <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTION[user.role]}</p>
      </Card>

      <SectionTitle>Details</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Name">
          <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <Input type="tel" inputMode="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </Field>
        <Button className="w-full" loading={saving === "profile"} onClick={saveProfile}>
          Save details
        </Button>
      </Card>

      <SectionTitle>Change password</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 6 characters">
          <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </Field>
        <Button
          variant="outline"
          className="w-full"
          loading={saving === "password"}
          disabled={!pw.currentPassword || !pw.newPassword}
          onClick={changePassword}
        >
          Change password
        </Button>
      </Card>
    </Page>
  );
}
