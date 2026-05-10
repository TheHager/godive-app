import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBadgeProgress } from './badges';

test('getBadgeProgress - Locked state', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(2, thresholds);
  assert.strictEqual(result.earned, false);
  assert.strictEqual(result.tier, "Locked");
  assert.strictEqual(result.nextTierName, "Bronze");
  assert.strictEqual(result.progressRatio, 0.4); // 2 / 5
});

test('getBadgeProgress - First tier earned', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(5, thresholds);
  assert.strictEqual(result.earned, true);
  assert.strictEqual(result.tier, "Bronze");
  assert.strictEqual(result.nextTierName, "Silver");
  assert.strictEqual(result.progressRatio, 0); // (5-5) / (10-5)
});

test('getBadgeProgress - Partial progress in Silver', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(7.5, thresholds);
  assert.strictEqual(result.earned, true);
  assert.strictEqual(result.tier, "Bronze");
  assert.strictEqual(result.nextTierName, "Silver");
  assert.strictEqual(result.progressRatio, 0.5); // (7.5-5) / (10-5)
});

test('getBadgeProgress - Exactly Silver', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(10, thresholds);
  assert.strictEqual(result.earned, true);
  assert.strictEqual(result.tier, "Silver");
  assert.strictEqual(result.nextTierName, "Gold");
  assert.strictEqual(result.progressRatio, 0); // (10-10) / (20-10)
});

test('getBadgeProgress - Maximum tier', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(20, thresholds);
  assert.strictEqual(result.earned, true);
  assert.strictEqual(result.tier, "Gold");
  assert.strictEqual(result.isMaxed, true);
  assert.strictEqual(result.nextTierName, "Maxed");
  assert.strictEqual(result.progressRatio, 1);
});

test('getBadgeProgress - Beyond maximum', () => {
  const thresholds = [5, 10, 20];
  const result = getBadgeProgress(25, thresholds);
  assert.strictEqual(result.earned, true);
  assert.strictEqual(result.tier, "Gold");
  assert.strictEqual(result.isMaxed, true);
  assert.strictEqual(result.progressRatio, 1);
});
