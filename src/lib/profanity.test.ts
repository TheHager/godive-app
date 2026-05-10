import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterProfanity, hasProfanity } from './profanity';

test('filterProfanity - returns clean text as-is', () => {
  assert.strictEqual(filterProfanity('This is a clean sentence.'), 'This is a clean sentence.');
});

test('filterProfanity - replaces profanity with asterisks', () => {
  assert.strictEqual(filterProfanity('What the fuck is this'), 'What the **** is this');
});

test('filterProfanity - handles empty string', () => {
  assert.strictEqual(filterProfanity(''), '');
});

test('hasProfanity - returns false for clean text', () => {
  assert.strictEqual(hasProfanity('This is a clean sentence.'), false);
});

test('hasProfanity - returns true for text with profanity', () => {
  assert.strictEqual(hasProfanity('What the fuck is this'), true);
});

test('hasProfanity - handles empty string', () => {
  assert.strictEqual(hasProfanity(''), false);
});
