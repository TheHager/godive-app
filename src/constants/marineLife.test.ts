import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpeciesXP } from './marineLife';

test('getSpeciesXP - Rare species returns 500 XP', () => {
  const result = getSpeciesXP('Coelacanth');
  assert.strictEqual(result, 500);
});

test('getSpeciesXP - Uncommon species returns 200 XP', () => {
  const result = getSpeciesXP('Manta Ray');
  assert.strictEqual(result, 200);
});

test('getSpeciesXP - Common species returns 50 XP', () => {
  const result = getSpeciesXP('Clownfish');
  assert.strictEqual(result, 50);
});

test('getSpeciesXP - Unknown species defaults to 50 XP', () => {
  const result = getSpeciesXP('Unknown Species');
  assert.strictEqual(result, 50);
});
