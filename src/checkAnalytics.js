// Build-time analytics configuration check
// Logs a clear warning when NEXT_PUBLIC_POSTHOG_KEY is missing in production builds.
// Does not fail the build, allowing deployment to proceed while making the gap visible.

export function checkAnalyticsConfig() {
  // Only check during production builds
  const isProductionBuild = 
    process.env.VERCEL_ENV === 'production' || 
    process.env.NODE_ENV === 'production';
  
  if (!isProductionBuild) {
    return; // Development and preview builds can run without analytics
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const isValid = key && /^phc_[a-zA-Z0-9]+$/.test(key);

  if (!isValid) {
    console.warn('');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️  ANALYTICS DARK: Production build has no PostHog key');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('');
    console.warn('NEXT_PUBLIC_POSTHOG_KEY is missing or invalid in this production build.');
    console.warn('No analytics will be collected. Conversion funnels cannot be measured.');
    console.warn('');
    console.warn('To fix:');
    console.warn('  1. Set NEXT_PUBLIC_POSTHOG_KEY in your Vercel Production environment');
    console.warn('  2. Set NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com (if not set)');
    console.warn('  3. Redeploy to rebuild with the key inlined');
    console.warn('');
    console.warn('Expected format: NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx');
    console.warn('Check /api/health after deploy: analyticsConfigured should be true');
    console.warn('');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('');
  }
}
