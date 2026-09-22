import "mapbox-gl/dist/mapbox-gl.css";
import "../src/styles.css";
import { DM_Sans, DM_Serif_Display } from "next/font/google";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif", display: "swap" });

export const metadata = {
  metadataBase: new URL("https://www.pawlineadopt.com"),
  title: {
    default: "Pawline Adopt | Pet Adoption App for Dogs & Cats",
    template: "%s | Pawline Adopt",
  },
  description: "Pawline Adopt is a pet adoption app for browsing adoptable dogs and cats from shelters. Find shelter listings, compare fit with your home and routine, and start your adoption journey. Shelter dog finder — not a pet-health product.",
  alternates: { canonical: "/", types: { "text/plain": "https://www.pawlineadopt.com/llms.txt" } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/favicon.svg?v=2", apple: "/apple-touch-icon.png" },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "Pawline Adopt", statusBarStyle: "default" },
  other: { bingbot: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
  openGraph: {
    title: "Pawline Adopt | Pet Adoption App for Dogs & Cats",
    description: "Pet adoption app for browsing adoptable dogs and cats from shelters. Compare shelter listings with your home and routine. Not a pet health product.",
    url: "/",
    siteName: "Pawline Adopt",
    type: "website",
    locale: "en_US",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Pawline Adopt pet adoption map and paw-print logo" }],
  },
  twitter: { card: "summary_large_image", title: "Pawline Adopt | Pet Adoption App for Dogs & Cats", description: "Pet adoption app for browsing adoptable dogs and cats from shelters. Compare shelter listings with your home and routine. Not a pet health product.", images: [{ url: "/social-card.png", alt: "Pawline Adopt pet adoption map and paw-print logo" }] },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17382f",
};

export default function RootLayout({ children }) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable}`}>
    <body>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "https://www.pawlineadopt.com/#organization", name: "Pawline", url: "https://www.pawlineadopt.com/", logo: "https://www.pawlineadopt.com/favicon.svg", image: "https://www.pawlineadopt.com/social-card.png", description: "A pet adoption discovery service that helps people compare current shelter listings with their home, routine, household, and pet experience." },
          { "@type": "WebSite", "@id": "https://www.pawlineadopt.com/#website", url: "https://www.pawlineadopt.com/", name: "Pawline", publisher: { "@id": "https://www.pawlineadopt.com/#organization" }, inLanguage: "en-US" },
          { "@type": "WebApplication", "@id": "https://www.pawlineadopt.com/#app", name: "Pawline", url: "https://www.pawlineadopt.com/", applicationCategory: "LifestyleApplication", operatingSystem: "Any", isAccessibleForFree: true, browserRequirements: "Requires JavaScript and a modern web browser.", description: "Compare current adoptable pet listings with the adopter's home, routine, household, and pet experience using disclosed listing facts.", image: "https://www.pawlineadopt.com/social-card.png", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@id": "https://www.pawlineadopt.com/#organization" } },
        ],
      }).replace(/</g, "\\u003c") }} />
      {children}
      <div className="legal-footer" role="contentinfo" aria-label="Pawline legal information">
        <span>© {new Date().getFullYear()} Pawline</span>
        <a href="/guides">Adoption guides</a>
        <a href="/how-pawline-works">Our sources</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: "600px" }}>
          Looking for pet health? That's a different "Pawline." We're <strong>Pawline Adopt</strong> — a pet adoption app for shelter listings only.
        </p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init("phc_mjpdhXnAyQGkX9Q8mygn6eJJSuhq7m5SPW5KfBJtAsdN",{api_host:"https://us.i.posthog.com",person_profiles:"identified_only"})` }} />
    </body>
  </html>;
}
