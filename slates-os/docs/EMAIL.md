# Email

Every email ROQ OS sends goes out through **Resend**, on the verified sending
domain `roqhome.com`. There are two independent paths, and it matters which one
a given email takes.

## The two paths

**1. Auth email — Supabase Auth sends it.**

Signup confirmation, password reset, email-change confirmation. These are
generated inside Supabase Auth, so the app never sees them; the only lever is
the SMTP server Auth is pointed at. That is configured in
`supabase/config.toml` under `[auth.email.smtp]`, pointing at Resend's SMTP
endpoint, sending as `no-reply@roqhome.com`.

Note that `config.toml` did not originally describe this: the live project had
already been pointed at Resend SMTP through the dashboard, sending as
`noreply@slatesweb.com` under the name "SLATES", while the checked-in config
still had the whole `[auth.email.smtp]` block commented out. The config file
now matches reality and carries the current ROQ OS sender identity. Treat
`config.toml` as the source of truth and push changes from it rather than
editing auth settings in the dashboard, or the two drift apart again.

**2. Product email — the app sends it.**

Team invites today (`supabase/functions/send-invite-email`), and anything added
later. These call the Resend HTTP API directly from an Edge Function, sending as
`notifications@roqhome.com`. They deliberately do *not* go through Auth: they
aren't authentication events, and routing them through Auth would put product
messaging under the auth rate limit.

The two paths share a provider and a domain but nothing else. Changing one does
not affect the other.

## The credential

Both paths authenticate to Resend with a Resend API key, held in two different
places because they are consumed by two different systems:

| Path | Consumer | Where the key lives |
| --- | --- | --- |
| Auth SMTP | Supabase Auth | Project auth config, set by `supabase config push` |
| Product email | Edge Function | Supabase function secret `RESEND_API_KEY` |

The key is **never** committed. `config.toml` refers to it as
`env(RESEND_SMTP_PASSWORD)`, which the CLI substitutes from the environment at
push time — the same pattern this file already uses for the Twilio and Apple
secrets.

## Pushing an SMTP config change

From `slates-os/`, with the Resend API key in the environment for the length of
one command:

```bash
RESEND_SMTP_PASSWORD='<resend-api-key>' supabase config push
```

**Run this from a real terminal, never from a script, pipe, or agent.** In an
interactive terminal the CLI prints a diff and asks "Do you want to push auth
config to remote?" before applying. When stdin is not a TTY that confirmation
step is skipped and the push applies immediately — piping input to it does not
answer the prompt, it removes it. There is no `--dry-run`, so there is no way to
preview the diff without risking applying it.

That distinction has already caused one production incident: a `config push`
piped a decline, expecting to preview the diff, and instead wrote a placeholder
SMTP password to the live project, breaking Auth email until a real key was
pushed.

There is no undo. The remote stores the SMTP password as a hash, so a bad push
cannot be rolled back to the previous key — Resend will not re-reveal an
existing key's value either, so recovery means minting a *new* key. Never run
this command with a placeholder or test value.

It also pushes *all* of `config.toml`, not just the email section, so anything
else that has drifted goes up in the same operation.

**Set `RESEND_SMTP_PASSWORD` on every push, even a template-only one.** The push
sends the whole file including `[auth.email.smtp]`, so a push with that variable
unset is a push of an empty SMTP password.

Rotating the key means running that command again with the new value, and
separately updating the Edge Function secret:

```bash
supabase secrets set RESEND_API_KEY='<resend-api-key>'
```

## Verifying it works

Auth mail can only really be verified by sending some. Trigger a password reset
for a real address on the deployed app and confirm the message arrives from
`no-reply@roqhome.com`. Resend's dashboard logs every send attempt with its
delivery status, which is the first place to look when a message doesn't land.

## Templates

Auth email bodies are templates, and they had the same drift problem the SMTP
block did: two of them were designed and branded entirely in the dashboard, with
nothing in the repo. Both still said SLATES and pulled a logo from
`slatesweb.com` long after the app itself became ROQ OS.

The two designed templates now live in `supabase/templates/` and are wired up
through `[auth.email.template.*]` in `config.toml`:

| Template | File | Sent when |
| --- | --- | --- |
| `confirmation` | `templates/confirmation.html` | a new account signs up |
| `recovery` | `templates/recovery.html` | a password reset is requested |

They render the ROQ OS wordmark as **styled text, not an image**, on purpose.
Most mail clients block remote images by default, so a hosted logo is invisible
to a large share of recipients — the SLATES version had been arriving logo-less
for those people. Text always renders, and it keeps Auth email off any
cross-site asset dependency.

The other six Auth emails — invite, magic link, email change, reauthentication,
and the password-changed / email-address-changed notifications — are still plain
unstyled HTML that exists only in the dashboard. They carry no stale branding,
which is why they weren't urgent, but they are unversioned and visually
inconsistent with the two above. Giving them the same shell and pulling them
into `supabase/templates/` is the obvious next step.

Note that the Auth `invite` template is **not** what team invites use — those go
through the Edge Function path described above and are styled in its own source.
