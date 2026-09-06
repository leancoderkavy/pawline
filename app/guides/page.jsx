import Content from "../../src/resources/Guides";
import SearchPage from "../../src/resources/SearchPage";

export const metadata = {
  title: "Pet adoption guides",
  description: "Practical guides to finding adoptable dogs and cats, comparing listing facts with your household, and confirming details with the original shelter.",
  alternates: { canonical: "/guides" },
  openGraph: { title: "Pet adoption guides | Pawline", description: "Practical guides to finding adoptable dogs and cats, comparing listing facts with your household, and confirming details with the original shelter.", url: "/guides", type: "website", images: ["/social-card.png"] },
  twitter: { card: "summary_large_image", title: "Pet adoption guides | Pawline", description: "Practical guides to finding adoptable dogs and cats, comparing listing facts with your household, and confirming details with the original shelter.", images: ["/social-card.png"] },
};

export default function Page() {
  return <SearchPage title="Pet adoption guides" path="/guides"><Content standalone /></SearchPage>;
}
