import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/onboarding/onboarding-client.tsx', import.meta.url), 'utf8');

test('adaptive onboarding preserves exactly five steps', () => {
  assert.match(source, /\['Organization', 'Event Details', 'Add Items', 'Payments & Delivery', 'Review & Launch'\]/);
});

test('all approved event formats are selectable and live publishing is clearly separated', () => {
  for (const eventType of ['online_silent', 'live', 'hybrid']) assert.match(source, new RegExp(eventType));
  assert.match(source, /does not start live bidding/i);
  assert.match(source, /Ticketing, check-in, paddles, Fund-a-Need/i);
});

test('free platform language remains separate from processor costs', () => {
  assert.match(source, /No Gather platform fee/);
  assert.match(source, /Payment-processor costs are disclosed separately/);
});
