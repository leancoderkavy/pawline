import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_AREAS,
  normalizeTavilyResult,
} from "../api/_tavily-discovery.js";

test("normalizes a current adoption page as an approximate web lead", () => {
  const lead = normalizeTavilyResult({
    title: "Adoptable Animals - Example Humane Society",
    url: "https://example.org/adoptable-animals",
    content: "Meet available dogs and cats and confirm adoption status with our shelter.",
  }, DISCOVERY_AREAS[0]);
  assert.equal(lead.domain, "example.org");
  assert.equal(lead.city, "Los Angeles, California");
  assert.equal(lead.species, null);
  assert.equal(lead.latitude, DISCOVERY_AREAS[0].latitude);
});

test("rejects social pages and results without adoption evidence", () => {
  assert.equal(normalizeTavilyResult({
    title: "Shelter news",
    url: "https://facebook.com/example",
    content: "Meet our adoptable dogs.",
  }, DISCOVERY_AREAS[0]), null);
  assert.equal(normalizeTavilyResult({
    title: "Animal services",
    url: "https://example.org/services",
    content: "License information and community resources.",
  }, DISCOVERY_AREAS[0]), null);
});

test("infers a single species only when the evidence is unambiguous", () => {
  const dogLead = normalizeTavilyResult({
    title: "Adoptable dogs",
    url: "https://example.org/dogs",
    content: "Browse available dogs from the shelter.",
  }, DISCOVERY_AREAS[1]);
  assert.equal(dogLead.species, "Dog");
});
