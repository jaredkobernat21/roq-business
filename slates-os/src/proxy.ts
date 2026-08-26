import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Accessible without a session; redirected away from once signed in.
const SIGNED_OUT_ONLY_ROUTES = ["/login", "/signup", "/forgot-password"];
// Always accessible regardless of auth state: the callback route manages
// its own redirect logic as it establishes/exchanges the session.
const ALWAYS_ACCESSIBLE_ROUTES = ["/auth"];

/**
 * Runs on every request (see matcher below). Two jobs:
 *  1. Refresh the Supabase auth session cookie so it doesn't expire under a
 *     signed-in user mid-session (Supabase's session refresh has to happen
 *     on the server, and proxy is the only place that runs before every
 *     render).
 *  2. Gate access: bounce signed-out users away from the app, and bounce
 *     signed-in users away from the auth pages.
 *
 * This is a coarse, path-based check — it is NOT the security boundary for
 * data access. Every table read/write is independently protected by RLS
 * (see supabase/migrations and docs/RLS.md), so even if a route slipped
 * through here, the database itself would refuse to return or accept data
 * for an organization the user doesn't belong to.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isSignedOutOnlyRoute = SIGNED_OUT_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  const isAlwaysAccessible = ALWAYS_ACCESSIBLE_ROUTES.some((route) => pathname.startsWith(route));

  if (isAlwaysAccessible) {
    return response;
  }

  if (!user && !isSignedOutOnlyRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isSignedOutOnlyRoute) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimization, and
     * favicon — auth pages and app pages both need the session check.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
