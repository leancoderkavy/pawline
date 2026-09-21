export function clerkBrowserOptions(publishableKey) {
  const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
  return proxyUrl ? { publishableKey, proxyUrl } : { publishableKey };
}
