import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevelFromXp, getRankFromXp, RANKS } from './ranks';

test('getLevelFromXp - should return level 1 for negative XP', () => {
  assert.strictEqual(getLevelFromXp(-50), 1);
});

test('getLevelFromXp - should return level 1 for 0 XP', () => {
  assert.strictEqual(getLevelFromXp(0), 1);
});

test('getLevelFromXp - should correctly calculate levels for positive XP', () => {
  // xp = 100 -> level 2
  assert.strictEqual(getLevelFromXp(100), 2);
  // xp = 400 -> level 3
  assert.strictEqual(getLevelFromXp(400), 3);
  // xp = 900 -> level 4
  assert.strictEqual(getLevelFromXp(900), 4);
});

test('getRankFromXp - should return Coastal Wanderer for 0 XP', () => {
  const rank = getRankFromXp(0);
  assert.strictEqual(rank.title, "Coastal Wanderer");
  assert.strictEqual(rank.min, 0);
});

test('getRankFromXp - should return Reef Guardian (min level 3) for 400 XP (level 3)', () => {
  const rank = getRankFromXp(400);
  assert.strictEqual(rank.title, "Reef Guardian");
  assert.strictEqual(rank.min, 3);
});

test('getRankFromXp - should return Island Hopper (min level 6) for 2500 XP (level 6)', () => {
  const rank = getRankFromXp(2500);
  assert.strictEqual(rank.title, "Island Hopper");
  assert.strictEqual(rank.min, 6);
});

test("getRankFromXp - should return Poseidon's Kin (min level 40) for very large XP (e.g., 200000 XP)", () => {
  // 200000 / 100 = 2000, sqrt = ~44.7 -> level 45
  const rank = getRankFromXp(200000);
  assert.strictEqual(rank.title, "Poseidon's Kin");
  assert.strictEqual(rank.min, 40);
});