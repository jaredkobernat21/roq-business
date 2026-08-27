// Hand-written types mirroring supabase/migrations/20260824235945_init_core_schema.sql.
//
// Every object type below is declared with `type X = {...}`, not
// `interface X {...}`. This matters: supabase-js's generic constraints
// (GenericTable, GenericSchema, ...) check assignability against
// `Record<string, unknown>`, and TypeScript only treats plain object *type
// literals* as satisfying an index signature that way — `interface`
// declarations don't, even though they look identical. Using `interface`
// here silently makes every table resolve to `never` throughout the app.
//
// If you have Docker (for `supabase start`) or a hosted project, regenerate
// this file with the real thing whenever the schema changes:
//   supabase gen types typescript --local > src/lib/database.types.ts
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type OrganizationRole = "owner" | "admin" | "scheduler" | "technician";
export type MemberStatus = "active" | "invited" | "disabled";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type BusinessMode = "service_business";
export type CustomerStatus = "lead" | "customer";
export type JobStatus =
  | "lead"
  | "estimate"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type ActivityEventType = "customer_created" | "job_created" | "job_status_changed";
export type ImportStatus = "processing" | "completed" | "failed";
export type ImportRowStatus = "imported" | "duplicate" | "error";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void";
export type PaymentProvider = "stripe" | "manual";

/** Only set on manual payments — see the payments migration. */
export type PaymentMethod = "cash" | "check" | "bank_transfer" | "other";
export type PaymentConnectionStatus = "pending" | "connected" | "disconnected" | "error";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  business_mode: BusinessMode;
  primary_color: string | null;
  secondary_color: string | null;
  booking_welcome_text: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerRow = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  status: CustomerStatus;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerAddressRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  is_primary: boolean;
  created_at: string;
};

type ServiceRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  starting_price_cents: number | null;
  is_active: boolean;
  bookable_online: boolean;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  service_id: string | null;
  address_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduled_at: string | null;
  duration_minutes: number | null;
  assigned_to: string | null;
  notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  job_id: string | null;
  invoice_number: number;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  organization_id: string;
  description: string;
  quantity: number;
  rate_cents: number;
  sort_order: number;
  created_at: string;
};

type ActivityEventRow = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  job_id: string | null;
  event_type: ActivityEventType;
  actor_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

type PaymentConnectionRow = {
  id: string;
  organization_id: string;
  provider: PaymentProvider;
  external_account_id: string;
  status: PaymentConnectionStatus;
  connected_by: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  provider: PaymentProvider;
  external_payment_id: string;
  amount_cents: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  reference: string | null;
  recorded_by: string | null;
  paid_at: string;
  created_at: string;
};

type BusinessHoursRow = {
  id: string;
  organization_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

type ScheduleBlockRow = {
  id: string;
  organization_id: string;
  member_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

type ImportJobRow = {
  id: string;
  organization_id: string;
  filename: string;
  column_mapping: Record<string, string>;
  status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  error_rows: number;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

type ImportRowRow = {
  id: string;
  import_job_id: string;
  organization_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: ImportRowStatus;
  error_message: string | null;
  customer_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  status: MemberStatus;
  created_at: string;
};

type OrganizationInvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  status: InvitationStatus;
  token: string;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Partial<OrganizationRow> & { name: string; slug: string };
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Partial<OrganizationMemberRow> & { organization_id: string; user_id: string };
        Update: Partial<OrganizationMemberRow>;
        Relationships: [];
      };
      organization_invitations: {
        Row: OrganizationInvitationRow;
        Insert: Partial<OrganizationInvitationRow> & {
          organization_id: string;
          email: string;
          invited_by: string;
        };
        Update: Partial<OrganizationInvitationRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Partial<CustomerRow> & { organization_id: string; first_name: string };
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      customer_addresses: {
        Row: CustomerAddressRow;
        Insert: Partial<CustomerAddressRow> & {
          organization_id: string;
          customer_id: string;
          line1: string;
        };
        Update: Partial<CustomerAddressRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: Partial<ServiceRow> & { organization_id: string; name: string };
        Update: Partial<ServiceRow>;
        Relationships: [];
      };
      jobs: {
        Row: JobRow;
        Insert: Partial<JobRow> & { organization_id: string; customer_id: string; title: string };
        Update: Partial<JobRow>;
        Relationships: [];
      };
      activity_events: {
        Row: ActivityEventRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      invoices: {
        Row: InvoiceRow;
        Insert: Partial<InvoiceRow> & { organization_id: string; customer_id: string };
        Update: Partial<InvoiceRow>;
        Relationships: [];
      };
      invoice_items: {
        Row: InvoiceItemRow;
        Insert: Partial<InvoiceItemRow> & {
          invoice_id: string;
          organization_id: string;
          description: string;
        };
        Update: Partial<InvoiceItemRow>;
        Relationships: [];
      };
      payment_connections: {
        Row: PaymentConnectionRow;
        Insert: Partial<PaymentConnectionRow> & {
          organization_id: string;
          provider: PaymentProvider;
          external_account_id: string;
        };
        Update: Partial<PaymentConnectionRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      import_jobs: {
        Row: ImportJobRow;
        Insert: Partial<ImportJobRow> & { organization_id: string; filename: string };
        Update: Partial<ImportJobRow>;
        Relationships: [];
      };
      import_rows: {
        Row: ImportRowRow;
        Insert: Partial<ImportRowRow> & {
          import_job_id: string;
          organization_id: string;
          row_number: number;
          raw_data: Record<string, unknown>;
          status: ImportRowStatus;
        };
        Update: Partial<ImportRowRow>;
        Relationships: [];
      };
      business_hours: {
        Row: BusinessHoursRow;
        Insert: Partial<BusinessHoursRow> & { organization_id: string; day_of_week: number };
        Update: Partial<BusinessHoursRow>;
        Relationships: [];
      };
      schedule_blocks: {
        Row: ScheduleBlockRow;
        Insert: Partial<ScheduleBlockRow> & {
          organization_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<ScheduleBlockRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { org_name: string; org_timezone?: string };
        Returns: OrganizationRow;
      };
      accept_invitation: {
        Args: { invite_token: string };
        Returns: OrganizationMemberRow;
      };
      list_organization_members: {
        Args: { target_org_id: string };
        Returns: {
          member_id: string;
          user_id: string;
          role: OrganizationRole;
          status: MemberStatus;
          created_at: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          email: string | null;
        }[];
      };
      get_booking_organization: {
        Args: { org_slug: string };
        Returns: {
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
        }[];
      };
      get_bookable_services: {
        Args: { org_slug: string };
        Returns: {
          id: string;
          name: string;
          description: string | null;
          duration_minutes: number | null;
          starting_price_cents: number | null;
        }[];
      };
      get_public_availability: {
        Args: { org_slug: string; target_date: string };
        Returns: {
          is_open: boolean;
          open_time: string | null;
          close_time: string | null;
          busy: { start: string; end: string }[];
        } | null;
      };
      submit_booking: {
        Args: {
          org_slug: string;
          service_id: string;
          first_name: string;
          last_name: string;
          phone: string;
          email: string;
          address_line1: string;
          city: string;
          state: string;
          postal_code: string;
          starts_at: string;
          notes: string;
        };
        Returns: string;
      };
      get_invoice_for_viewing: {
        Args: { target_invoice_id: string };
        Returns: {
          id: string;
          invoice_number: number;
          status: InvoiceStatus;
          subtotal_cents: number;
          tax_cents: number;
          total_cents: number;
          amount_paid_cents: number;
          due_date: string | null;
          notes: string | null;
          items: { description: string; quantity: number; rate_cents: number }[];
          organization: {
            name: string;
            logo_url: string | null;
            primary_color: string | null;
            secondary_color: string | null;
            phone: string | null;
            email: string | null;
            website: string | null;
            address: string | null;
          };
          customer: {
            first_name: string | null;
            last_name: string | null;
            company_name: string | null;
            email: string | null;
          };
        } | null;
      };
      get_invoice_stripe_account: {
        Args: { target_invoice_id: string };
        Returns: string | null;
      };
      record_stripe_payment: {
        Args: { target_invoice_id: string; stripe_payment_id: string; amount_cents: number };
        Returns: undefined;
      };
      record_manual_payment: {
        Args: {
          target_invoice_id: string;
          amount_cents: number;
          payment_method: PaymentMethod;
          payment_reference?: string | null;
          received_at?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      member_status: MemberStatus;
      invitation_status: InvitationStatus;
      business_mode: BusinessMode;
      customer_status: CustomerStatus;
      job_status: JobStatus;
      activity_event_type: ActivityEventType;
      import_status: ImportStatus;
      import_row_status: ImportRowStatus;
      invoice_status: InvoiceStatus;
      payment_provider: PaymentProvider;
      payment_connection_status: PaymentConnectionStatus;
      payment_status: PaymentStatus;
    };
  };
};
