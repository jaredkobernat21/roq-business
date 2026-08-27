"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { getAvailableSlots, submitBooking, type BookableService, type BookingOrganization } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { cn, formatCents } from "@/lib/utils";

type Step = "service" | "datetime" | "details" | "confirmed";

const UPCOMING_DAYS = 14;

export function BookingWizard({
  slug,
  organization,
  services,
}: {
  slug: string;
  organization: BookingOrganization;
  services: BookableService[];
}) {
  const [step, setStep] = useState<Step>("service");
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(services.length === 1 ? services[0].id : null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[]>([]);
  const [loadingSlots, startSlotsTransition] = useTransition();
  const [isPending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const upcomingDays = useMemo(() => Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(new Date(), i)), []);

  useEffect(() => {
    if (!selectedDate || !service) return;
    startSlotsTransition(async () => {
      setSelectedSlot(null);
      const result = await getAvailableSlots(slug, format(selectedDate, "yyyy-MM-dd"), service.duration_minutes ?? 60);
      setSlots(result);
    });
  }, [selectedDate, service, slug]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  });

  function handleSubmit() {
    if (!service || !selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBooking({
        slug,
        serviceId: service.id,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        addressLine1: form.addressLine1,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        startsAt: selectedSlot.toISOString(),
        notes: form.notes,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStep("confirmed");
    });
  }

  if (step === "confirmed" && service && selectedSlot) {
    return (
      <Card className="text-center">
        <h2 className="text-lg font-semibold text-foreground">You&apos;re booked!</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {service.name} on {format(selectedSlot, "EEEE, MMMM d")} at {format(selectedSlot, "h:mm a")}
        </p>
        <p className="mt-4 text-sm text-foreground-muted">
          {organization.name} will be in touch
          {organization.phone ? ` — you can also reach them at ${organization.phone}` : ""}.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      {organization.booking_welcome_text && step === "service" && (
        <p className="text-center text-sm text-foreground-muted">{organization.booking_welcome_text}</p>
      )}

      {step === "service" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">What can we help you with?</h2>
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setStep("datetime");
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3.5 text-left transition-colors",
                  serviceId === s.id ? "border-accent" : "border-border-strong hover:bg-surface-hover"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {[s.duration_minutes ? `${s.duration_minutes} min` : null, formatCents(s.starting_price_cents)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "datetime" && service && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Choose a date</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {upcomingDays.map((day) => (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-[var(--radius-sm)] border px-3 py-2 text-xs",
                    selectedDate && isSameDay(selectedDate, day)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong text-foreground-muted hover:bg-surface-hover"
                  )}
                >
                  <span className="font-medium">{format(day, "EEE")}</span>
                  <span>{format(day, "MMM d")}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">Choose a time</h2>
              {loadingSlots ? (
                <p className="mt-3 text-sm text-foreground-muted">Loading times…</p>
              ) : slots.length === 0 ? (
                <p className="mt-3 text-sm text-foreground-muted">No times available that day.</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.toISOString()}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-[var(--radius-sm)] border px-2 py-2 text-sm",
                        selectedSlot && selectedSlot.getTime() === slot.getTime()
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border-strong text-foreground hover:bg-surface-hover"
                      )}
                    >
                      {format(slot, "h:mm a")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setStep("details")} disabled={!selectedSlot}>
              Continue
            </Button>
            <Button variant="ghost" onClick={() => setStep("service")}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === "details" && service && selectedSlot && (
        <div className="space-y-5">
          <Card className="text-sm text-foreground-muted">
            {service.name} — {format(selectedSlot, "EEEE, MMMM d")} at {format(selectedSlot, "h:mm a")}
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Your information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="addressLine1">Your address</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
              <Input
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
              <Input
                placeholder="ZIP"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="notes">Anything we should know?</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isPending || !form.firstName.trim()}>
              {isPending ? "Booking…" : `Book ${service.name}`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("datetime")} disabled={isPending}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
