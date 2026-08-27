"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type FormActionState } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { TIMEZONES } from "@/lib/timezones";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function BusinessInfoForm({
  organization,
  readOnly,
}: {
  organization: Database["public"]["Tables"]["organizations"]["Row"];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Business information updated.</Alert>}

      <div>
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" defaultValue={organization.name} disabled={readOnly} required />
      </div>

      <div>
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input
          id="logo_url"
          name="logo_url"
          placeholder="https://…"
          defaultValue={organization.logo_url ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={organization.phone ?? ""} disabled={readOnly} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={organization.email ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={organization.website ?? ""} disabled={readOnly} />
        </div>
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Select id="timezone" name="timezone" defaultValue={organization.timezone} disabled={readOnly}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          placeholder="123 Main St, Springfield, IL"
          defaultValue={organization.address ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Booking page branding</p>
        <p className="mt-1 text-xs text-foreground-muted">
          What customers see on your branded booking page — never ROQ OS branding.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="primary_color">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                id="primary_color"
                name="primary_color"
                type="color"
                defaultValue={organization.primary_color ?? "#232120"}
                disabled={readOnly}
                className="h-10 w-14 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-xs text-foreground-muted">Buttons and accents</span>
            </div>
          </div>
          <div>
            <Label htmlFor="secondary_color">Secondary color</Label>
            <div className="flex items-center gap-2">
              <input
                id="secondary_color"
                name="secondary_color"
                type="color"
                defaultValue={organization.secondary_color ?? "#f7f5f0"}
                disabled={readOnly}
                className="h-10 w-14 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-xs text-foreground-muted">Optional accent</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="booking_welcome_text">Booking page welcome text</Label>
          <Textarea
            id="booking_welcome_text"
            name="booking_welcome_text"
            rows={2}
            placeholder="What can we help you with?"
            defaultValue={organization.booking_welcome_text ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      )}
    </form>
  );
}
