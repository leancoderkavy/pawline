import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const withClerk = clerkConfigured ? clerkMiddleware() : null;

export default function proxy(request, event) {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname;
  const requestedHost = forwardedHost.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
  if (requestedHost === "pawlineadopt.com") {
    const canonical = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, "https://www.pawlineadopt.com");
    return NextResponse.redirect(canonical, 308);
  }
  return withClerk ? withClerk(request, event) : NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
