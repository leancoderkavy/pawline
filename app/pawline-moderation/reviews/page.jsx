import ReviewModerationClient from "./ReviewModerationClient";

export const metadata = {
  title: "Review moderation",
  description: "Pawline staff review queue for submitted, verified adopter feedback before publication.",
  openGraph: {
    title: "Review moderation | Pawline",
    description: "Pawline staff review queue for verified adopter feedback before publication.",
    images: [{ url: "/social-card.png", alt: "Pawline staff review moderation workflow" }],
  },
  twitter: { card: "summary_large_image", title: "Review moderation | Pawline", description: "Pawline staff review queue for verified adopter feedback before publication.", images: [{ url: "/social-card.png", alt: "Pawline staff review moderation workflow" }] },
};

export default function ReviewModerationPage() {
  return <ReviewModerationClient />;
}
