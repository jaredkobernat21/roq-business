"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type FormActionState } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
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

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      )}
    </form>
  );
}
