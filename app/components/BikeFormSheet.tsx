"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import type { Bike } from "@/app/lib/types";
import { Sheet, useToast } from "./overlays";
import { Button, Field, Input, Textarea } from "./ui";

const EMPTY = { bikeNumber: "", ownerName: "", phone: "", model: "", notes: "" };

/** Add (bike = null) or edit a bike in a bottom sheet. */
export default function BikeFormSheet({
  open,
  bike,
  onClose,
  onSaved,
}: {
  open: boolean;
  bike: Bike | null;
  onClose: () => void;
  onSaved: (bike: Bike) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      bike
        ? {
            bikeNumber: bike.bikeNumber,
            ownerName: bike.ownerName || "",
            phone: bike.phone || "",
            model: bike.model || "",
            notes: bike.notes || "",
          }
        : EMPTY
    );
  }, [open, bike]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.bikeNumber.trim()) {
      toast("Bike number is required", "error");
      return;
    }
    const digits = form.phone.replace(/\D/g, "");
    if (digits && digits.length < 10) {
      toast("Phone number looks incomplete", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await api<Bike>(bike ? `/api/bikes/${bike._id}` : "/api/bikes", {
        method: bike ? "PUT" : "POST",
        body: form,
      });
      toast(bike ? "Bike updated" : "Bike added");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={bike ? "Edit bike" : "Add bike"}
      footer={
        <Button size="lg" className="w-full" loading={saving} onClick={save}>
          {bike ? "Save changes" : "Add bike"}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Bike number">
          <Input
            value={form.bikeNumber}
            onChange={(e) => setForm((f) => ({ ...f, bikeNumber: e.target.value.toUpperCase() }))}
            placeholder="WB 02 AB 1234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus={!bike}
            className="font-mono text-lg font-bold tracking-wider"
          />
        </Field>
        <Field label="Owner name">
          <Input value={form.ownerName} onChange={set("ownerName")} placeholder="Customer name" autoCapitalize="words" />
        </Field>
        <Field label="Mobile">
          <Input value={form.phone} onChange={set("phone")} placeholder="10-digit number" type="tel" inputMode="tel" maxLength={14} />
        </Field>
        <Field label="Bike model">
          <Input value={form.model} onChange={set("model")} placeholder="e.g. Honda Activa 6G" />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={set("notes")} placeholder="Preferences, existing damage…" className="min-h-20" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
