import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute } from "./public-routes";

export { PUBLIC_ROUTES, isPublicRoute } from "./public-routes";

export async function updateSession(request: NextRequest) {
  // Public routes (marketing / SEO / auth / webhooks) need no auth gate, so skip
  // the Supabase `getUser()` network round-trip entirely. That round-trip ran on
  // EVERY request — including the homepage + all card/blog/pillar pages — and
  // added ~hundreds of ms to TTFB (measured as a large slice of the homepage
  // mobile-LCP; homepage-perf-and-a11y / hero-lcp TTFB lever). Anonymous visitors
  // (the vast majority on public pages) had nothing to refresh anyway, and a
  // logged-in user's session cookie still refreshes on their next GATED-route
  // request. Gated routes keep the full auth check below (fail-closed unchanged).
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
