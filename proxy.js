import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const withClerk = clerkConfigured ? clerkMiddleware() : null;
// Only the Frontend API path is proxied. Enabling it for every request would
// rewrite the auth handshake before the client and Clerk Dashboard use the proxy.
const withClerkProxy = clerkConfigured
  ? clerkMiddleware({
      frontendApiProxy: {
        enabled: (url) => url.pathname.startsWith("/__clerk"),
      },
    })
  : null;

function requestedHostname(request) {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname;
  return forwardedHost.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

export default function proxy(request, event) {
  const requestedHost = requestedHostname(request);
  if (requestedHost === "pawlineadopt.com") {
    const canonical = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, "https://www.pawlineadopt.com");
    return NextResponse.redirect(canonical, 308);
  }
  if (withClerkProxy && requestedHost === "www.pawlineadopt.com" && request.nextUrl.pathname.startsWith("/__clerk")) {
    return withClerkProxy(request, event);
  }
  return withClerk ? withClerk(request, event) : NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
