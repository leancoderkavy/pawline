import test from "node:test";
import assert from "node:assert/strict";
import { parseStoredFavorites } from "../src/favoritesState.js";

test("stored favorites reject malformed containers and normalize duplicate IDs", () => {
  for (const raw of ['null', '{}', '"cat"', 'invalid']) assert.throws(() => parseStoredFavorites(raw));
  assert.deepEqual(parseStoredFavorites(null), []);
  assert.deepEqual(parseStoredFavorites('["cat","cat",42,null,{},true,""]'), ["cat", 42]);
});
