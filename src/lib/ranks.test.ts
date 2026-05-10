import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevelFromXp } from './ranks';

test('getLevelFromXp - negative XP returns level 1', () => {
  assert.strictEqual(getLevelFromXp(-50), 1);
});

test('getLevelFromXp - 0 XP returns level 1', () => {
  assert.strictEqual(getLevelFromXp(0), 1);
});

test('getLevelFromXp - XP under 100 stays at level 1', () => {
  assert.strictEqual(getLevelFromXp(50), 1);
  assert.strictEqual(getLevelFromXp(99), 1);
});

test('getLevelFromXp - exact boundaries increment level', () => {
  assert.strictEqual(getLevelFromXp(100), 2);
  assert.strictEqual(getLevelFromXp(400), 3);
  assert.strictEqual(getLevelFromXp(900), 4);
});

test('getLevelFromXp - values between boundaries return lower level', () => {
  assert.strictEqual(getLevelFromXp(101), 2);
  assert.strictEqual(getLevelFromXp(399), 2);
  assert.strictEqual(getLevelFromXp(401), 3);
  assert.strictEqual(getLevelFromXp(899), 3);
});
