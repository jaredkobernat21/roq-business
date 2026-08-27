"use server";

import { createClient } from "@/lib/supabase/server";
import { getFreeIntervals, getBookableSlots, type DayHours } from "@/lib/scheduling/availability";

export interface BookingOrganization {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  booking_welcome_text: string | null;
  timezone: string;
}

export interface BookableService {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  starting_price_cents: number | null;
}

export async function getBookingOrganization(slug: string): Promise<BookingOrganization | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_booking_organization", { org_slug: slug });
  return data?.[0] ?? null;
}

export async function getBookableServices(slug: string): Promise<BookableService[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_bookable_services", { org_slug: slug });
  return data ?? [];
}

/** Returns bookable start times on `dateStr` (yyyy-MM-dd) for a service of `durationMinutes`. */
export async function getAvailableSlots(
  slug: string,
  dateStr: string,
  durationMinutes: number
): Promise<Date[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_availability", { org_slug: slug, target_date: dateStr });
  if (!data) return [];

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const dayHours: DayHours = {
    day_of_week: date.getDay(),
    is_open: data.is_open,
    open_time: data.open_time,
    close_time: data.close_time,
  };

  const busy = (data.busy ?? []).map((span) => ({
    start: new Date(span.start),
    end: new Date(span.end),
  }));

  const free = getFreeIntervals([dayHours], date, busy);
  return getBookableSlots(free, durationMinutes);
}

export interface SubmitBookingInput {
  slug: string;
  serviceId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  startsAt: string;
  notes: string;
}

export async function submitBooking(
  input: SubmitBookingInput
): Promise<{ jobId: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_booking", {
    org_slug: input.slug,
    service_id: input.serviceId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    email: input.email,
    address_line1: input.addressLine1,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
    starts_at: input.startsAt,
    notes: input.notes,
  });

  if (error || !data) {
    return { error: error?.message ?? "Could not complete the booking." };
  }

  return { jobId: data };
}
