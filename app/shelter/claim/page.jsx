import ClaimOrganizationClient from "./ClaimOrganizationClient";

export const metadata = {
  title: "Shelter claim",
  description: "Use your invitation link to connect a verified shelter organization to Pawline and manage applications and listing workflows.",
  openGraph: {
    title: "Shelter claim | Pawline",
    description: "Connect a verified shelter organization to Pawline and manage listings safely.",
    images: [{ url: "/social-card.png", alt: "Pawline shelter claiming and verification workflow" }],
  },
  twitter: { card: "summary_large_image", title: "Shelter claim | Pawline", description: "Connect a verified shelter organization to Pawline and manage listings safely.", images: [{ url: "/social-card.png", alt: "Pawline shelter claiming and verification workflow" }] },
};

export default function ClaimOrganizationPage() {
  return <ClaimOrganizationClient />;
}
