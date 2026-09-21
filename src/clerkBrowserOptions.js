export function clerkBrowserOptions(publishableKey) {
  const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.replace(/\/$/, "");
  return proxyUrl ? { publishableKey, proxyUrl } : { publishableKey };
}
