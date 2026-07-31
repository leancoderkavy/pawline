import { clerkFrontendApiProxy } from "@clerk/backend/proxy";

function proxy(request) {
  return clerkFrontendApiProxy(request, {
    proxyPath: "/__clerk",
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
