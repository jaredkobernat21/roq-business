"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/profile/actions";
import type { FormActionState } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, HelpText } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function AccountForm({
  profile,
  email,
}: {
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Account updated.</Alert>}

      <div>
        <Label htmlFor="email-display">Email</Label>
        <Input id="email-display" value={email} disabled />
        <HelpText>Contact support to change your sign-in email.</HelpText>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={profile?.first_name ?? ""} required />
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={profile?.last_name ?? ""} required />
        </div>
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
