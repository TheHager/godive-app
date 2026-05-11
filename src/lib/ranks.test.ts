import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevelFromXp, getRankFromXp } from './ranks';

test('getLevelFromXp - Negative XP', () => {
  assert.strictEqual(getLevelFromXp(-10), 1);
});

test('getLevelFromXp - Zero XP', () => {
  assert.strictEqual(getLevelFromXp(0), 1);
});

test('getLevelFromXp - Less than 100 XP', () => {
  assert.strictEqual(getLevelFromXp(99), 1);
});

test('getLevelFromXp - Exactly 100 XP', () => {
  assert.strictEqual(getLevelFromXp(100), 2);
});

test('getLevelFromXp - Between 100 and 400 XP', () => {
  assert.strictEqual(getLevelFromXp(250), 2);
  assert.strictEqual(getLevelFromXp(399), 2);
});

test('getLevelFromXp - Exactly 400 XP', () => {
  assert.strictEqual(getLevelFromXp(400), 3);
});

test('getLevelFromXp - Large XP values', () => {
  assert.strictEqual(getLevelFromXp(900), 4);
  assert.strictEqual(getLevelFromXp(1600), 5);
  assert.strictEqual(getLevelFromXp(2500), 6);
  assert.strictEqual(getLevelFromXp(10000), 11);
});

test('getRankFromXp - Level 1 Rank', () => {
  const rank = getRankFromXp(0);
  assert.strictEqual(rank.title, "Coastal Wanderer");
  assert.strictEqual(rank.min, 0);
});

test('getRankFromXp - Exact thresholds', () => {
  // Rank threshold checks
  // Min 3 = Level 3 (needs 400 XP)
  const rank3 = getRankFromXp(400);
  assert.strictEqual(rank3.title, "Reef Guardian");
  assert.strictEqual(rank3.min, 3);

  // Min 6 = Level 6 (needs 2500 XP)
  const rank6 = getRankFromXp(2500);
  assert.strictEqual(rank6.title, "Island Hopper");
  assert.strictEqual(rank6.min, 6);
});
