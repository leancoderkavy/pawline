# Production authentication proxy

Pawline's Clerk production instance has its Frontend API proxy registered at
`https://pawlineadopt.com/__clerk`. The application itself uses
`https://www.pawlineadopt.com`. Keep the proxy on its registered host: the `www`
proxy returns `host_invalid` because it is not the registered proxy URL.

Set `NEXT_PUBLIC_CLERK_PROXY_URL=https://pawlineadopt.com/__clerk` in Vercel's
Production environment and rebuild. `clerkBrowserOptions` passes this to each
ClerkProvider. The CSP allows the exact apex `/__clerk/` path for authentication
scripts, connections, frames, and form submissions. The proxy supplies Clerk's
credentialed CORS response for the canonical `www` origin.

When the instance has a proxy but the browser still uses the CNAME endpoint,
old `__client` cookies scoped to `.clerk.pawlineadopt.com` can coexist with a
new `.pawlineadopt.com` cookie. Production QA reproduced a successful signup
creation followed by `401 signed_out` when preparing email verification.
Routing through the apex avoids sending the narrower CNAME cookie; do not
disable verification or clear unrelated browser sessions as a workaround.

After deployment, confirm the loaded Clerk script and auth requests use the
proxy, complete email verification, reload the signed-in application, and
exercise an authenticated API. A rendered login dialog or successful build is
not proof of a working login. Existing failed signup attempts may be incomplete
Clerk signups, not verified user accounts.
