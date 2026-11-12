import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { withAuthenticatedEmail } from '../lib/onboarding-draft.ts';

test('a newly registered organizer starts onboarding with the authenticated email', () => {
  const draft = withAuthenticatedEmail(
    { organization: '', contactName: '', email: '' },
    'new-organizer@example.org',
  );
  assert.equal(draft.email, 'new-organizer@example.org');
});

test('an existing saved draft cannot override the current authenticated email', () => {
  const draft = withAuthenticatedEmail(
    {
      organization: 'Community Foundation',
      contactName: 'Alex Morgan',
      email: 'stale-address@example.org',
    },
    'current-account@example.org',
  );
  assert.equal(draft.email, 'current-account@example.org');
  assert.equal(draft.organization, 'Community Foundation');
  assert.equal(draft.contactName, 'Alex Morgan');
});

test('onboarding presents account email as read-only and keeps contact email separate', () => {
  const source = readFileSync(
    new URL('../app/onboarding/onboarding-client.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, />Account email</);
  assert.match(source, /readOnly/);
  assert.match(source, /organization contact email, when needed, is managed separately/i);
  assert.doesNotMatch(source, /update\(\{ email:/);
});
