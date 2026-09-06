import Content from "../../../src/resources/MatchingGuide";
import SearchPage from "../../../src/resources/SearchPage";

export const metadata = {
  title: "Find a pet that fits your home and routine",
  description: "Compare adoptable pet listing facts with your home, daily routine, household, and experience. Learn which questions to confirm with a shelter or rescue.",
  alternates: { canonical: "/guides/find-a-pet-that-fits-your-home-and-routine" },
  openGraph: { title: "Find a pet that fits your home and routine | Pawline", description: "Compare adoptable pet listing facts with your home, daily routine, household, and experience. Learn which questions to confirm with a shelter or rescue.", url: "/guides/find-a-pet-that-fits-your-home-and-routine", type: "website", images: ["/social-card.png"] },
  twitter: { card: "summary_large_image", title: "Find a pet that fits your home and routine | Pawline", description: "Compare adoptable pet listing facts with your home, daily routine, household, and experience. Learn which questions to confirm with a shelter or rescue.", images: ["/social-card.png"] },
};

export default function Page() {
  return <SearchPage title="Find a pet that fits your home and routine" path="/guides/find-a-pet-that-fits-your-home-and-routine"><Content standalone /></SearchPage>;
}
