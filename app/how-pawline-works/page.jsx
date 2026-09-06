import Content from "../../src/resources/Methodology";
import SearchPage from "../../src/resources/SearchPage";

export const metadata = {
  title: "How Pawline checks adoption listing sources",
  description: "Understand Pawline listing sources, approximate web leads, availability checks, and transparent pet matching before contacting a shelter or rescue.",
  alternates: { canonical: "/how-pawline-works" },
  openGraph: { title: "How Pawline checks adoption listing sources | Pawline", description: "Understand Pawline listing sources, approximate web leads, availability checks, and transparent pet matching before contacting a shelter or rescue.", url: "/how-pawline-works", type: "website", images: ["/social-card.png"] },
  twitter: { card: "summary_large_image", title: "How Pawline checks adoption listing sources | Pawline", description: "Understand Pawline listing sources, approximate web leads, availability checks, and transparent pet matching before contacting a shelter or rescue.", images: ["/social-card.png"] },
};

export default function Page() {
  return <SearchPage title="How Pawline checks adoption listing sources" path="/how-pawline-works"><Content standalone /></SearchPage>;
}
