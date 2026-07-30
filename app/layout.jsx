import "mapbox-gl/dist/mapbox-gl.css";
import "../src/styles.css";
import { DM_Sans, DM_Serif_Display } from "next/font/google";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif", display: "swap" });

export const metadata = {
  metadataBase: new URL("https://www.pawlineadopt.com"),
  title: "Find Adoptable Dogs & Cats Near You | Pawline",
  description: "Find adoptable dogs and cats near you using current shelter listings, an interactive map, verified adoption events, and a moderated pet community.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/favicon.svg?v=2" },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Find Adoptable Dogs & Cats Near You | Pawline",
    description: "Explore current shelter listings, verified adoption events, and a moderated pet community on one interactive map.",
    url: "/",
    siteName: "Pawline",
    type: "website",
    images: [{ url: "/social-card.svg", alt: "Pawline pet adoption map and paw-print logo" }],
  },
  twitter: { card: "summary_large_image", title: "Find Adoptable Dogs & Cats Near You | Pawline", description: "Explore current shelter listings and a moderated pet community on one interactive map.", images: ["/social-card.svg"] },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17382f",
};

export default function RootLayout({ children }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable}`}>
    <body>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "https://www.pawlineadopt.com/#organization", name: "Pawline", url: "https://www.pawlineadopt.com/", logo: "https://www.pawlineadopt.com/favicon.svg", description: "A pet adoption discovery service combining current shelter listings, verified events, moderated community leads, and transparent matching tools." },
          { "@type": "WebSite", "@id": "https://www.pawlineadopt.com/#website", url: "https://www.pawlineadopt.com/", name: "Pawline", publisher: { "@id": "https://www.pawlineadopt.com/#organization" }, inLanguage: "en-US" },
          { "@type": "WebApplication", "@id": "https://www.pawlineadopt.com/#app", name: "Pawline", url: "https://www.pawlineadopt.com/", applicationCategory: "LifestyleApplication", operatingSystem: "Any", isAccessibleForFree: true, publisher: { "@id": "https://www.pawlineadopt.com/#organization" } },
        ],
      }).replace(/</g, "\\u003c") }} />
      {children}
    </body>
  </html>;
}
