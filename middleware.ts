import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protected routes
const protectedRoutes = ["/dashboard"];

// Auth routes
const authRoutes = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  console.log("========== MIDDLEWARE ==========");
  console.log("Path:", request.nextUrl.pathname);
  console.log("Token:", token);
  console.log("================================");

  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If user is NOT logged in and accessing dashboard
  if (isProtectedRoute && !token) {
    console.log("Redirecting to login...");

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    return NextResponse.redirect(loginUrl);
  }

  // If user IS logged in and opens login/signup
  if (isAuthRoute && token) {
    console.log("Already logged in. Redirecting to dashboard...");
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};