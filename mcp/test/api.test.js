import assert from 'node:assert/strict';
import test from 'node:test';
import { apiBase, compactPet, filterPets } from '../src/api.js';

test('apiBase defaults to the canonical Pawline domain', () => {
  assert.equal(apiBase('').href, 'https://www.pawlineadopt.com/');
});

test('apiBase rejects non-http protocols', () => {
  assert.throws(() => apiBase('file:///tmp/pawline'), /http or https/);
});

test('filterPets searches listing fields case-insensitively', () => {
  const pets = [
    { name: 'Maggie', breed: 'Boxer', city: 'Derwood' },
    { name: 'Nova', breed: 'Tabby', city: 'Seattle' },
  ];
  assert.deepEqual(filterPets(pets, 'box'), [pets[0]]);
  assert.deepEqual(filterPets(pets, 'SEATTLE'), [pets[1]]);
});

test('compactPet excludes internal and map fields', () => {
  const result = compactPet({
    id: 'pet-1', name: 'Nova', species: 'Cat', breed: 'Tabby', age: 'Adult',
    sex: 'Female', size: 'Medium', city: 'Seattle', shelter: 'City Shelter',
    source: 'Official', sourceUrl: 'https://example.com/pet-1', image: null,
    latitude: 47.6, longitude: -122.3, x: 4, y: 5,
  });
  assert.equal(result.id, 'pet-1');
  assert.equal('latitude' in result, false);
  assert.equal('x' in result, false);
});
