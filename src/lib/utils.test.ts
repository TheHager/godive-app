import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from './utils';

test('formatDate - Valid Date object', () => {
  const date = new Date(2023, 9, 15); // Local time: 15 Oct 2023
  assert.strictEqual(formatDate(date), '15.10.2023');
});

test('formatDate - Valid string', () => {
  const date = new Date(2023, 9, 15);
  assert.strictEqual(formatDate(date.toString()), '15.10.2023');
});

test('formatDate - Valid number timestamp', () => {
  const date = new Date(2023, 9, 15);
  assert.strictEqual(formatDate(date.getTime()), '15.10.2023');
});

test('formatDate - Firebase Timestamp mock', () => {
  const mockTimestamp = {
    toDate: () => new Date(2023, 9, 15)
  };
  assert.strictEqual(formatDate(mockTimestamp), '15.10.2023');
});

test('formatDate - Invalid string', () => {
  assert.strictEqual(formatDate('not-a-date'), '');
});

test('formatDate - Falsy and empty values', () => {
  assert.strictEqual(formatDate(''), '');
  assert.strictEqual(formatDate(null as any), '');
  assert.strictEqual(formatDate(undefined as any), '');
  assert.strictEqual(formatDate(0), ''); // 0 timestamp is valid, but fails if(!date) wait!
});

test('formatDate - Error handling (throws)', () => {
  const throwingMock = {
    toDate: () => { throw new Error('Simulation error'); }
  };
  assert.strictEqual(formatDate(throwingMock), '');
});
