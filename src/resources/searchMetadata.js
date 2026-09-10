export function searchMetadata(title, description, path) {
  const socialTitle = `${title} | Pawline`;
  const image = { url: "/social-card.png", width: 1200, height: 630, alt: "Pawline pet adoption map and paw-print logo" };
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title: socialTitle, description, url: path, type: "website", siteName: "Pawline", locale: "en_US", images: [image] },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
