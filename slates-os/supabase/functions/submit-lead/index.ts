import { createClient } from "jsr:@supabase/supabase-js@2";

// Public endpoint for the marketing site's contact form (slatesweb.com).
// Deployed with --no-verify-jwt since the browser calls this anonymously —
// there's no signed-in user at the point someone fills out "contact us".
//
// Does both jobs in one request: inserts the lead record (service-role
// client, since slates_leads has no client-facing RLS policies at all —
// see the migration that created it) and sends the notification email via
// Resend. No database trigger/webhook involved, unlike the old roq-project
// setup this replaces.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const record = {
      name: String(body.name ?? "").trim(),
      business: String(body.business ?? "").trim(),
      what_you_do: String(body.what_you_do ?? "").trim(),
      current_website: String(body.current_website ?? "").trim() || null,
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim() || null,
      notes: String(body.notes ?? "").trim() || null,
    };

    if (!record.name || !record.business || !record.what_you_do || !record.email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: insertError } = await admin.from("slates_leads").insert(record);
    if (insertError) throw insertError;

    const emailBody = `
      <h2>New ROQ Business inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(record.name)}</p>
      <p><strong>Business:</strong> ${escapeHtml(record.business)}</p>
      <p><strong>What they do:</strong> ${escapeHtml(record.what_you_do)}</p>
      <p><strong>Current website:</strong> ${escapeHtml(record.current_website || "—")}</p>
      <p><strong>Email:</strong> ${escapeHtml(record.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(record.phone || "—")}</p>
      <p><strong>Notes:</strong> ${escapeHtml(record.notes || "—")}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("LEAD_EMAIL_FROM") ?? "ROQ Business <notifications@roqhome.com>",
        to: [Deno.env.get("LEAD_EMAIL_TO") ?? "hello@slatesweb.com"],
        subject: `New ROQ Business inquiry: ${record.business}`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      // The lead is already saved at this point — log the email failure but
      // don't fail the whole request over it; the visitor shouldn't see an
      // error for something that's really an internal notification issue.
      console.error("Resend send failed:", await res.text());
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-lead error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
