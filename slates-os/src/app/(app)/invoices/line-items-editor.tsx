"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";

export interface LineItemDraft {
  description: string;
  quantity: string;
  rate: string;
}

const EMPTY_ITEM: LineItemDraft = { description: "", quantity: "1", rate: "" };

export function LineItemsEditor({
  initialItems,
  initialTaxPercent,
}: {
  initialItems: LineItemDraft[];
  initialTaxPercent?: number;
}) {
  const [items, setItems] = useState<LineItemDraft[]>(initialItems.length > 0 ? initialItems : [{ ...EMPTY_ITEM }]);
  const [taxPercent, setTaxPercent] = useState(initialTaxPercent ? String(initialTaxPercent) : "");

  function updateItem(index: number, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotalCents = items.reduce((sum, item) => {
    const qty = Number.parseFloat(item.quantity) || 0;
    const rate = Number.parseFloat(item.rate) || 0;
    return sum + Math.round(qty * rate * 100);
  }, 0);
  const taxCents = Math.round(subtotalCents * ((Number.parseFloat(taxPercent) || 0) / 100));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              {index === 0 && <Label>Description</Label>}
              <Input
                name="item_description"
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                placeholder="Service or item"
              />
            </div>
            <div className="w-20">
              {index === 0 && <Label>Qty</Label>}
              <Input
                name="item_quantity"
                type="number"
                min={0}
                step="any"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
              />
            </div>
            <div className="w-28">
              {index === 0 && <Label>Rate</Label>}
              <Input
                name="item_rate"
                type="number"
                min={0}
                step="0.01"
                value={item.rate}
                onChange={(e) => updateItem(index, { rate: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              aria-label="Remove line"
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
          + Add line
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
        <div className="w-32">
          <Label htmlFor="tax_percent">Tax %</Label>
          <Input
            id="tax_percent"
            name="tax_percent"
            type="number"
            min={0}
            step="0.01"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        </div>
        <div className="space-y-0.5 text-right text-sm">
          <p className="text-foreground-muted">Subtotal: {formatCents(subtotalCents)}</p>
          <p className="text-foreground-muted">Tax: {formatCents(taxCents)}</p>
          <p className="font-semibold text-foreground">Total: {formatCents(subtotalCents + taxCents)}</p>
        </div>
      </div>
    </div>
  );
}
