import "mapbox-gl/dist/mapbox-gl.css";
import "../src/styles.css";
import { DM_Sans, DM_Serif_Display } from "next/font/google";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif", display: "swap" });

export const metadata = {
  metadataBase: new URL("https://www.pawlineadopt.com"),
  title: {
    default: "Find Adoptable Dogs & Cats Near You | Pawline",
    template: "%s | Pawline",
  },
  description: "Find adoptable dogs and cats near you, then compare listed needs with your home, routine, household, and pet experience before you contact the shelter.",
  alternates: { canonical: "/", types: { "text/plain": "https://www.pawlineadopt.com/llms.txt" } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/favicon.svg?v=2", apple: "/apple-touch-icon.png" },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "Pawline", statusBarStyle: "default" },
  other: { bingbot: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
  openGraph: {
    title: "Find Adoptable Dogs & Cats Near You | Pawline",
    description: "Find current shelter listings and compare listed needs with your home, routine, household, and pet experience.",
    url: "/",
    siteName: "Pawline",
    type: "website",
    locale: "en_US",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Pawline pet adoption map and paw-print logo" }],
  },
  twitter: { card: "summary_large_image", title: "Find Adoptable Dogs & Cats Near You | Pawline", description: "Find current shelter listings and compare listed needs with your home, routine, household, and pet experience.", images: [{ url: "/social-card.png", alt: "Pawline pet adoption map and paw-print logo" }] },
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
    </body>
  </html>;
}
