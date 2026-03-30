import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// 🔐 Token validation
function isValidToken(token: string): boolean {
  try {
    jwt.verify(token, process.env.JWT_SECRET as string);
    return true;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith("/login");
  const isProtectedRoute = pathname.startsWith("/dashboard");

  const isAuthenticated = token && isValidToken(token);

  // 🔒 Block login if already logged in
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 🔒 Protect dashboard routes
  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// 🎯 Route targeting
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};