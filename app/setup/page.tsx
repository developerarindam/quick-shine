"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/app/components/AuthLayout";
import { Button, Field, Input } from "@/app/components/ui";
import { api } from "@/app/lib/api";

/** First-run: create the owner account. Only works while there are no users. */
export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/register")
      .then((d) => !d.needsSetup && router.replace("/login"))
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/register", { method: "POST", body: form });
      await api("/api/login", { method: "POST", body: { email: form.email, password: form.password } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set up your studio" subtitle="Create the owner account">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <Field label="Your name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoCapitalize="words" required />
        </Field>
        <Field label="Email">
          <Input type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <Input type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Create owner account
        </Button>
      </form>
    </AuthLayout>
  );
}
