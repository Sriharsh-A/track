import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, getSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    if (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/tracker")) {
      return NextResponse.redirect(new URL("/login?setup=1", request.url));
    }
    return NextResponse.next();
  }

  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const route = path.startsWith("/dashboard") ? "dashboard" : path.startsWith("/tracker") ? "tracker" : path;
  const errorCode = typeof authError?.code === "string" && /^[a-zA-Z0-9_:-]{1,80}$/.test(authError.code) ? authError.code : "none";
  const cookieNames = request.cookies.getAll().map(({ name }) => name);
  const sessionCookiePresent = cookieNames.some((name) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
  const codeVerifierCookiePresent = cookieNames.some((name) => name.endsWith("-auth-token-code-verifier"));
  console.info(`[auth-flow] middleware route=${route}; user_present=${user ? "yes" : "no"}; session_cookie_present=${sessionCookiePresent ? "yes" : "no"}; code_verifier_cookie_present=${codeVerifierCookiePresent ? "yes" : "no"}; error_code=${errorCode}; error_status=${authError?.status ?? "none"}`);
  const privatePath = path.startsWith("/dashboard") || path.startsWith("/tracker");
  const authPath = path === "/login" || path === "/signup";

  if (privatePath && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (path === "/" && user) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (authPath && user) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/tracker/:path*", "/login", "/signup", "/auth/callback"],
};
