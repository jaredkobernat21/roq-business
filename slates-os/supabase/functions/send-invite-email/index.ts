import { createClient } from "jsr:@supabase/supabase-js@2";

// Called directly by inviteMemberAction (src/lib/organizations/members-actions.ts)
// right after an organization_invitations row is inserted — not a Postgres
// Database Webhook. (This project has neither the supabase_functions schema
// nor the pg_net extension enabled, so the usual trigger-based webhook
// mechanism isn't available here; calling the function from the server
// action is simpler and just as safe: the app never touches a service-role
// key or the Resend key, it only holds the public anon key, which is enough
// to pass this function's JWT verification.)
//
// Looks up the organization + inviter, then sends a plain notification
// email via Resend pointing the invitee at /signup. It intentionally does
// NOT use supabase.auth.admin.inviteUserByEmail() — that API creates the
// auth user immediately and sends Supabase's own confirmation-style email,
// which would bypass the accept flow already built (sign up normally, then
// accept the pending invitation shown on /onboarding/organization — see
// getPendingInvitations in src/lib/session.ts).

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://os.roqhome.com";

interface InviteRequest {
  organizationId: string;
  email: string;
  role: string;
  invitedBy: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  scheduler: "Scheduler",
  technician: "Technician",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: InviteRequest = await req.json();

    if (!body.organizationId || !body.email || !body.role || !body.invitedBy) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: organization }, { data: inviter }] = await Promise.all([
      admin.from("organizations").select("name").eq("id", body.organizationId).maybeSingle(),
      admin.from("profiles").select("first_name, last_name").eq("id", body.invitedBy).maybeSingle(),
    ]);

    const organizationName = organization?.name ?? "a business";
    const inviterName = [inviter?.first_name, inviter?.last_name].filter(Boolean).join(" ").trim();
    const roleLabel = ROLE_LABELS[body.role] ?? body.role;
    const signupUrl = `${SITE_URL}/signup`;

    const emailBody = `
      <p>${escapeHtml(inviterName || "Someone")} invited you to join <strong>${escapeHtml(organizationName)}</strong> on ROQ OS as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${signupUrl}" style="background:#232120;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          Create your account
        </a>
      </p>
      <p>Sign up with <strong>${escapeHtml(body.email)}</strong> — this exact email address — and the invitation will be waiting for you to accept.</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("INVITE_EMAIL_FROM") ?? "ROQ OS <notifications@roqhome.com>",
        to: [body.email],
        subject: `You've been invited to join ${organizationName} on ROQ OS`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      console.error("Resend send failed:", await res.text());
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("send-invite-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
