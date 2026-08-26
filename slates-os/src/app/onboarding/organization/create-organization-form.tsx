"use client";

import { useActionState } from "react";
import { createOrganizationAction, type FormActionState } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { TIMEZONES } from "@/lib/timezones";

const initialState: FormActionState = {};

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div>
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" placeholder="e.g. Duct Wrangler" required />
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" name="timezone" defaultValue="America/New_York">
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create business & enter SLATES OS"}
      </Button>
    </form>
  );
}
