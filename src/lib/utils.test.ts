import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from './utils';

test('formatDate - Falsy inputs', () => {
  assert.strictEqual(formatDate(null), "");
  assert.strictEqual(formatDate(undefined), "");
  assert.strictEqual(formatDate(""), "");
  assert.strictEqual(formatDate(0), ""); // 0 is falsy, so it triggers the !date check
});

test('formatDate - Valid Date object', () => {
  const date = new Date(2023, 9, 15); // October 15, 2023
  assert.strictEqual(formatDate(date), "15.10.2023");
});

test('formatDate - Valid string date', () => {
  assert.strictEqual(formatDate("2023-10-15T12:00:00Z"), "15.10.2023");
  // Test another format that parses correctly
  assert.strictEqual(formatDate("10/15/2023"), "15.10.2023");
});

test('formatDate - Valid numeric timestamp', () => {
  // Use a non-zero timestamp (e.g., specific date in milliseconds)
  const timestamp = new Date(2023, 9, 15).getTime();
  assert.strictEqual(formatDate(timestamp), "15.10.2023");
});

test('formatDate - Mock Firebase Timestamp object', () => {
  const mockTimestamp = {
    toDate: () => new Date(2023, 9, 15)
  };
  assert.strictEqual(formatDate(mockTimestamp), "15.10.2023");
});

test('formatDate - Invalid date strings', () => {
  assert.strictEqual(formatDate("not-a-date"), "");
  assert.strictEqual(formatDate("2023-13-45"), ""); // Invalid date values might parse as NaN
});

test('formatDate - Error cases', () => {
  const throwyObject = {
    toDate: () => { throw new Error("Boom"); }
  };
  assert.strictEqual(formatDate(throwyObject), "");
});
