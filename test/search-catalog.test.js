import test from "node:test";
import assert from "node:assert/strict";
import { searchBreadcrumbs, searchPageSchema, searchResources } from "../src/resources/searchCatalog.js";

test("guide breadcrumbs follow the visible hierarchy and link the page schema", () => {
  const path = "/guides/find-adoptable-pets-near-you";
  const crumbs = searchBreadcrumbs("Nearby pets", path);
  assert.deepEqual(crumbs.map(item => item.path), ["/", "/guides", path]);
  const [page, breadcrumb] = searchPageSchema("Nearby pets", path)["@graph"];
  assert.equal(page.breadcrumb["@id"], breadcrumb["@id"]);
  assert.deepEqual(breadcrumb.itemListElement.map(item => item.position), [1, 2, 3]);
  assert.equal(breadcrumb.itemListElement.at(-1).item, page.url);
});

test("resource URLs are unique and the guide index does not repeat itself", () => {
  assert.equal(new Set(searchResources.map(item => item.path)).size, searchResources.length);
  assert.deepEqual(searchBreadcrumbs("Adoption guides", "/guides").map(item => item.path), ["/", "/guides"]);
});
