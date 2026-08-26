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

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
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
    };
    Enums: {
      organization_role: OrganizationRole;
      member_status: MemberStatus;
      invitation_status: InvitationStatus;
    };
  };
};
