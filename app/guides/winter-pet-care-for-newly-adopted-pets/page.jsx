import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/WinterPetCareNewAdoptions";

const title = "Winter pet care for newly adopted dogs and cats";
const description = "Practical winter pet care for newly adopted dogs and cats: warm indoor routines, cold-weather walks, indoor cat safety, and seasonal toxin awareness confirmed with your shelter and veterinarian.";
const path = "/guides/winter-pet-care-for-newly-adopted-pets";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
