import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('help navigation includes every supplied page', () => {
  const layout = read('components/help-policy-layout.tsx');
  for (const route of ['/help','/help/organizers','/help/bidders','/help/fees','/help/travel','/legal/privacy','/legal/terms','/legal/cookies','/legal/refunds','/support']) {
    assert.match(layout, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(layout, /label: 'Guides'/);
  assert.match(layout, /label: 'Policies'/);
  assert.match(layout, /<a key=\{href\} href=\{href\}/);
  assert.match(layout, /w-full items-center justify-between/);
  assert.doesNotMatch(layout, /<Link key=\{href\}/);
});

test('draft legal content is review-gated until explicitly published', () => {
  const gate = read('components/draft-policy-page.tsx');
  assert.match(gate, /PUBLISH_DRAFT_LEGAL_PAGES/);
  assert.match(gate, /ReviewNotice/);
  for (const path of ['app/legal/privacy/page.tsx','app/legal/terms/page.tsx','app/legal/cookies/page.tsx','app/legal/refunds/page.tsx']) {
    assert.match(read(path), /DraftPolicyPage/);
  }
});

test('public footer links to help, support, privacy, and terms', () => {
  const landing = read('app/landing-page.tsx');
  for (const route of ['/help','/support','/legal/privacy','/legal/terms']) assert.match(landing, new RegExp(`href="${route}"`));
});
