import { notFound } from "next/navigation";
import { cache } from "react";
import { getDatabase } from "../../../api/_db.js";
import { catalogQuery, searchCatalog } from "../../../api/catalog.js";
import { petSourceLinkLabel } from "../../../src/petSourceLink.js";
export const dynamic = "force-dynamic";
const load = cache(async (id) => {
  let query;
  try {
    query = catalogQuery({ id });
  } catch {
    return null;
  }
  const database = getDatabase();
  if (!database) return null;
  return (await searchCatalog(database, query)).pets[0] || null;
});
export async function generateMetadata({ params }) {
  const { id } = await params;
  const pet = await load(id);
  return pet
    ? {
        title: `${pet.name} — ${pet.species} at ${pet.shelter}`,
        description: `Meet ${pet.name} in ${pet.city}. Confirm current availability with ${pet.shelter}.`,
        alternates: { canonical: `/pets/${id}` },
      }
    : {
        title: "Pet listing unavailable",
        robots: { index: false, follow: true },
      };
}
export default async function PetPage({ params }) {
  const { id } = await params;
  const pet = await load(id);
  if (!pet) notFound();
  return (
    <main className="methodology-page">
      <header className="methodology-header">
        <a className="methodology-brand" href="/">
          Pawline
        </a>
        <a href="/#network">Search pets</a>
      </header>
      <article className="methodology-content">
        <p>
          {pet.species} · {pet.city}
        </p>
        <h1>{pet.name}</h1>
        <h2>{pet.shelter}</h2>
        <p>
          {pet.breed} · {pet.age}
        </p>
        <p>
          Listed as available. Confirm current availability and adoption requirements
          with {pet.shelter} before visiting.
        </p>
        {pet.sourceUrl ? (
          <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            <a
              className="button"
              href={pet.sourceUrl}
              rel="noreferrer"
              target="_blank"
              style={{ display: "inline-block", marginBottom: "0.75rem" }}
            >
              Contact {pet.shelter} to inquire
            </a>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              <a href={pet.sourceUrl} rel="noreferrer" target="_blank">
                {petSourceLinkLabel(pet.sourceUrl, pet.externalId)}
              </a>
            </p>
          </div>
        ) : null}
        <a
          className="button"
          href={`/?pet=${encodeURIComponent(pet.id)}#network`}
          style={{ display: "inline-block" }}
        >
          Compare with your home and routine
        </a>
        {pet.lastObservedAt ? (
          <p style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Last listing observation:{" "}
            {new Date(pet.lastObservedAt).toLocaleDateString("en-US", {
              timeZone: "UTC",
            })}
          </p>
        ) : null}
      </article>
    </main>
  );
}
