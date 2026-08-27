import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getBookingOrganization, getBookableServices } from "@/lib/booking/actions";
import { getContrastForeground } from "@/lib/branding/color";
import { BookingWizard } from "./booking-wizard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const organization = await getBookingOrganization(slug);
  if (!organization) return { title: "Book an appointment" };
  return {
    title: `Book with ${organization.name}`,
    description: organization.booking_welcome_text ?? `Schedule a service with ${organization.name}.`,
  };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getBookingOrganization(slug);

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-foreground-muted">This booking page isn&apos;t available.</p>
      </div>
    );
  }

  const services = await getBookableServices(slug);
  const primaryColor = organization.primary_color ?? "#232120";
  const accentForeground = getContrastForeground(primaryColor);

  return (
    <div
      className="min-h-screen bg-background"
      style={
        {
          "--accent": primaryColor,
          "--accent-foreground": accentForeground,
        } as CSSProperties
      }
    >
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          {organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="mb-4 h-14 w-14 rounded-[var(--radius-md)] object-cover"
            />
          ) : (
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] text-lg font-semibold"
              style={{ backgroundColor: primaryColor, color: accentForeground }}
            >
              {organization.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{organization.name}</h1>
          {organization.address && <p className="mt-1 text-sm text-foreground-muted">{organization.address}</p>}
        </div>

        {services.length === 0 ? (
          <p className="text-center text-sm text-foreground-muted">
            Online booking isn&apos;t available right now — please contact us directly
            {organization.phone ? ` at ${organization.phone}` : ""}.
          </p>
        ) : (
          <BookingWizard slug={slug} organization={organization} services={services} />
        )}
      </div>
    </div>
  );
}
