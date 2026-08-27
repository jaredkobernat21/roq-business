"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IMPORT_TARGET_FIELDS,
  guessTargetField,
  applyMapping,
  analyzeMappedRows,
  type ImportTargetField,
  type MappedImportRow,
} from "@/lib/customers/import-fields";
import { importCustomersAction } from "@/lib/customers/import-actions";

type Step = "upload" | "map" | "preview";

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportTargetField>>({});
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        if (fields.length === 0 || result.data.length === 0) {
          setError("Couldn't find any rows in that file.");
          return;
        }
        setFilename(file.name);
        setHeaders(fields);
        setRawRows(result.data);
        setMapping(Object.fromEntries(fields.map((header) => [header, guessTargetField(header)])));
        setStep("map");
      },
      error: (err) => setError(err.message),
    });
  }

  const mappedRows = useMemo<MappedImportRow[]>(
    () => rawRows.map((row, i) => applyMapping(row, mapping, i + 1)),
    [rawRows, mapping]
  );

  const analysis = useMemo(() => analyzeMappedRows(mappedRows), [mappedRows]);

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await importCustomersAction({
        filename,
        columnMapping: mapping,
        rows: mappedRows,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/customers/import/${result.importJobId}`);
    });
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      {step === "upload" && (
        <Card>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-border-strong px-6 py-12 text-center hover:bg-surface-hover">
            <span className="text-sm font-medium text-foreground">Choose a CSV file</span>
            <span className="text-xs text-foreground-muted">First row should be column headers.</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </Card>
      )}

      {step === "map" && (
        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Match your columns</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {filename} — {rawRows.length} row{rawRows.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="divide-y divide-border">
            {headers.map((header) => (
              <div key={header} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{header}</p>
                  <p className="truncate text-xs text-foreground-muted">
                    e.g. {rawRows[0]?.[header] || "—"}
                  </p>
                </div>
                <Select
                  className="w-44 shrink-0"
                  value={mapping[header] ?? "skip"}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [header]: e.target.value as ImportTargetField }))
                  }
                >
                  {IMPORT_TARGET_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep("preview")}>Continue</Button>
            <Button variant="ghost" onClick={() => setStep("upload")}>
              Back
            </Button>
          </div>
        </Card>
      )}

      {step === "preview" && (
        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Review before importing</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {analysis.readyCount} of {mappedRows.length} rows are ready to import.
              {analysis.issuesByRow.size > 0 &&
                ` ${analysis.issuesByRow.size} have an issue and will be skipped.`}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-[var(--radius-sm)] border border-border">
            <ul className="divide-y divide-border">
              {mappedRows.slice(0, 50).map((row) => {
                const issues = analysis.issuesByRow.get(row.rowNumber);
                return (
                  <li key={row.rowNumber} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="truncate text-xs text-foreground-muted">
                        {[row.phone, row.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {issues ? (
                      <Badge tone="warning" className="shrink-0">
                        {issues[0]}
                      </Badge>
                    ) : (
                      <Badge tone="success" className="shrink-0">
                        Ready
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
            {mappedRows.length > 50 && (
              <p className="px-3.5 py-2.5 text-xs text-foreground-faint">
                +{mappedRows.length - 50} more row{mappedRows.length - 50 === 1 ? "" : "s"} not shown.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={isPending || analysis.readyCount === 0}>
              {isPending ? "Importing…" : `Import ${analysis.readyCount} customers`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("map")} disabled={isPending}>
              Back
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
