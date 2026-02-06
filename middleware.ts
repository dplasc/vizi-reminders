import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/dashboard")) {
    const session = request.cookies.get(SESSION_COOKIE_NAME);
    if (!session?.value) {
      return NextResponse.redirect(new URL("/sso", request.url));
    }
  }

  return NextResponse.next();
}
