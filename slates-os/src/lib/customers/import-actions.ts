"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageCustomers } from "@/lib/permissions";
import type { MappedImportRow } from "@/lib/customers/import-fields";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function importCustomersAction(input: {
  filename: string;
  columnMapping: Record<string, string>;
  rows: MappedImportRow[];
}): Promise<{ importJobId: string } | { error: string }> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageCustomers(context.role)) {
    return { error: "You don't have permission to import customers." };
  }

  if (input.rows.length === 0) {
    return { error: "No rows to import." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: importJob, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      organization_id: context.organization.id,
      filename: input.filename,
      column_mapping: input.columnMapping,
      status: "processing",
      total_rows: input.rows.length,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (jobError || !importJob) {
    return { error: jobError?.message ?? "Could not start the import." };
  }

  // Loaded once up front rather than queried per row — cheap for the
  // hundreds-to-low-thousands of rows a small business CSV import means.
  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("phone, email")
    .eq("organization_id", context.organization.id);

  const existingPhones = new Set(
    (existingCustomers ?? []).map((c) => c.phone?.trim()).filter((v): v is string => !!v)
  );
  const existingEmails = new Set(
    (existingCustomers ?? []).map((c) => c.email?.trim().toLowerCase()).filter((v): v is string => !!v)
  );
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of input.rows) {
    const phone = row.phone || null;
    const email = row.email || null;
    const emailKey = email?.toLowerCase();

    if (!row.first_name) {
      errors += 1;
      await supabase.from("import_rows").insert({
        import_job_id: importJob.id,
        organization_id: context.organization.id,
        row_number: row.rowNumber,
        raw_data: row.raw,
        status: "error",
        error_message: "Missing first name.",
      });
      continue;
    }

    if (email && !EMAIL_RE.test(email)) {
      errors += 1;
      await supabase.from("import_rows").insert({
        import_job_id: importJob.id,
        organization_id: context.organization.id,
        row_number: row.rowNumber,
        raw_data: row.raw,
        status: "error",
        error_message: `Invalid email: ${email}`,
      });
      continue;
    }

    const isDuplicate = Boolean(
      (phone && (existingPhones.has(phone) || seenPhones.has(phone))) ||
        (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey)))
    );

    if (isDuplicate) {
      duplicates += 1;
      await supabase.from("import_rows").insert({
        import_job_id: importJob.id,
        organization_id: context.organization.id,
        row_number: row.rowNumber,
        raw_data: row.raw,
        status: "duplicate",
        error_message: "Matches an existing customer's phone or email.",
      });
      continue;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: context.organization.id,
        first_name: row.first_name,
        last_name: row.last_name || null,
        company_name: row.company_name || null,
        phone,
        email,
        notes: row.notes || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      errors += 1;
      await supabase.from("import_rows").insert({
        import_job_id: importJob.id,
        organization_id: context.organization.id,
        row_number: row.rowNumber,
        raw_data: row.raw,
        status: "error",
        error_message: customerError?.message ?? "Could not create customer.",
      });
      continue;
    }

    if (row.address_line1) {
      await supabase.from("customer_addresses").insert({
        organization_id: context.organization.id,
        customer_id: customer.id,
        line1: row.address_line1,
        city: row.city || null,
        state: row.state || null,
        postal_code: row.postal_code || null,
        is_primary: true,
      });
    }

    if (phone) seenPhones.add(phone);
    if (emailKey) seenEmails.add(emailKey);
    imported += 1;

    await supabase.from("import_rows").insert({
      import_job_id: importJob.id,
      organization_id: context.organization.id,
      row_number: row.rowNumber,
      raw_data: row.raw,
      status: "imported",
      customer_id: customer.id,
    });
  }

  await supabase
    .from("import_jobs")
    .update({
      status: "completed",
      imported_rows: imported,
      duplicate_rows: duplicates,
      error_rows: errors,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importJob.id);

  revalidatePath("/customers");

  return { importJobId: importJob.id };
}
