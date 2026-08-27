export const IMPORT_TARGET_FIELDS = [
  { value: "skip", label: "Don't import" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "company_name", label: "Company" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "address_line1", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "postal_code", label: "ZIP" },
  { value: "notes", label: "Notes" },
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number]["value"];

const SYNONYMS: Partial<Record<ImportTargetField, string[]>> = {
  first_name: ["first name", "firstname", "first"],
  last_name: ["last name", "lastname", "last", "surname"],
  company_name: ["company", "business", "company name", "organization", "business name"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number", "mobile phone"],
  email: ["email", "email address", "e-mail"],
  address_line1: ["address", "service address", "street", "street address", "address line 1"],
  city: ["city"],
  state: ["state", "province"],
  postal_code: ["zip", "zip code", "postal code", "postcode"],
  notes: ["notes", "note", "comments", "customer notes"],
};

/** Best-effort guess at which ROQ OS field a CSV column header maps to. */
export function guessTargetField(header: string): ImportTargetField {
  const normalized = header.trim().toLowerCase();
  for (const field of IMPORT_TARGET_FIELDS) {
    if (SYNONYMS[field.value]?.includes(normalized)) return field.value;
  }
  return "skip";
}

export interface MappedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  email: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Client-side preview only — flags the same issue categories the server
 * will independently re-check during the actual import (missing names,
 * invalid emails, duplicate phone/email within the file). This is what
 * lets the preview step show counts before committing to anything.
 */
export function analyzeMappedRows(rows: MappedImportRow[]): {
  readyCount: number;
  issuesByRow: Map<number, string[]>;
} {
  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.email) {
      const key = row.email.toLowerCase();
      emailCounts.set(key, (emailCounts.get(key) ?? 0) + 1);
    }
    if (row.phone) {
      phoneCounts.set(row.phone, (phoneCounts.get(row.phone) ?? 0) + 1);
    }
  }

  const issuesByRow = new Map<number, string[]>();
  let readyCount = 0;

  for (const row of rows) {
    const issues: string[] = [];
    if (!row.first_name) issues.push("Missing first name");
    if (row.email && !EMAIL_RE.test(row.email)) issues.push("Invalid email");
    if (row.email && (emailCounts.get(row.email.toLowerCase()) ?? 0) > 1) {
      issues.push("Duplicate email in file");
    }
    if (row.phone && (phoneCounts.get(row.phone) ?? 0) > 1) {
      issues.push("Duplicate phone in file");
    }

    if (issues.length === 0) {
      readyCount += 1;
    } else {
      issuesByRow.set(row.rowNumber, issues);
    }
  }

  return { readyCount, issuesByRow };
}

/** Applies a header→field mapping to one parsed CSV row. */
export function applyMapping(
  raw: Record<string, string>,
  mapping: Record<string, ImportTargetField>,
  rowNumber: number
): MappedImportRow {
  const mapped: MappedImportRow = {
    rowNumber,
    raw,
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
    email: "",
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    notes: "",
  };

  for (const [header, value] of Object.entries(raw)) {
    const target = mapping[header];
    if (!target || target === "skip") continue;
    mapped[target] = (value ?? "").trim();
  }

  return mapped;
}
