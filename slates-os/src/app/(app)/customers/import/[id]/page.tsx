import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ImportResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: importJob } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!importJob) {
    notFound();
  }

  const { data: problemRows } = await supabase
    .from("import_rows")
    .select("row_number, status, error_message, raw_data")
    .eq("import_job_id", id)
    .neq("status", "imported")
    .order("row_number", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Import complete</h1>
        <p className="mt-1 text-sm text-foreground-muted">{importJob.filename}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-semibold text-foreground">{importJob.imported_rows}</p>
          <p className="mt-1 text-xs text-foreground-muted">Imported</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-foreground">{importJob.duplicate_rows}</p>
          <p className="mt-1 text-xs text-foreground-muted">Duplicates skipped</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-foreground">{importJob.error_rows}</p>
          <p className="mt-1 text-xs text-foreground-muted">Errors</p>
        </Card>
      </div>

      {(problemRows ?? []).length > 0 && (
        <Card>
          <CardTitle>Rows that weren&apos;t imported</CardTitle>
          <ul className="mt-4 divide-y divide-border">
            {(problemRows ?? []).map((row) => (
              <li key={row.row_number} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground">Row {row.row_number}</p>
                  <Badge tone={row.status === "duplicate" ? "neutral" : "danger"}>
                    {row.status === "duplicate" ? "Duplicate" : "Error"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">{row.error_message}</p>
                <p className="mt-1 truncate text-xs text-foreground-faint">
                  {Object.values(row.raw_data as Record<string, string>).filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link href="/customers">
        <Button>Go to customers</Button>
      </Link>
    </div>
  );
}
