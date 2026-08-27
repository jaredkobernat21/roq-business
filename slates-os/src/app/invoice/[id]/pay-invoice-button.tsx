"use client";

import { useState, useTransition } from "react";
import { createInvoiceCheckoutSession } from "@/lib/payments/checkout";

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createInvoiceCheckoutSession(invoiceId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-center text-xs text-danger">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full rounded-[var(--radius-md)] bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Redirecting…" : "Pay invoice"}
      </button>
    </div>
  );
}
