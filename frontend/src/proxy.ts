import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected route prefixes that require an authenticated session
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/datasets",
  "/query",
  "/analyst",
  "/versions",
  "/pipelines",
  "/integrations",
  "/workspace",
  "/billing",
  "/visualizer",
  "/dashboards",
  "/upload",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute) {
    const accessToken = request.cookies.get("strata_access_token")?.value;
    const refreshToken = request.cookies.get("strata_refresh_token")?.value;

    // If neither access nor refresh cookie is present, redirect to login page with return URL
    if (!accessToken && !refreshToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("return_to", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png, apple-icon.png (metadata files)
     * - shared, embed (public shared dataset embed routes)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|shared|embed).*)",
  ],
};
