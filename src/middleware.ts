export const runtime = "nodejs";

import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  const url = new URL(req.url);

  // Seiten, die ohne Login erlaubt sind:
  const publicPaths = ["/login", "/api/auth", "/favicon.ico", "/_next"];

  if (publicPaths.some((path) => url.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Wenn nicht eingeloggt → redirect zu /login
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
     "/((?!api/auth|api/cronjobs|_next/static|_next/image|favicon.ico).*)",
  ],
};