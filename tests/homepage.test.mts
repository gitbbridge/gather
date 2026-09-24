import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuction } from '../lib/auction.ts';
import { defaultHomepage, homepageConfigSchema, homepageReadiness, safeLink } from '../lib/homepage.ts';

const nonprofit = { id: 'nonprofit-1', slug: 'community-fund-nonprofit', name: 'Community Fund', headline: 'Neighbors helping neighbors.', mission: 'We connect local families with practical support and lasting opportunity.', accent: '#175b47' };
const auctions = [{ id: 'auction-1', state: createAuction('Spring Benefit', nonprofit.name) }];

test('default homepage preserves nonprofit content and real auction references', () => {
  const config = defaultHomepage(nonprofit, auctions);
  assert.equal(homepageConfigSchema.safeParse(config).success, true);
  assert.ok(JSON.stringify(config).includes(nonprofit.headline));
  assert.ok(JSON.stringify(config).includes('auction-1'));
});

test('publish readiness flags missing organizer input and clears when supplied', () => {
  const config = defaultHomepage(nonprofit, auctions);
  assert.deepEqual(homepageReadiness(config, auctions), ['Contact & social: add at least one contact method.']);
  const contact = config.sections.find(section => section.type === 'contact');
  assert.ok(contact && contact.type === 'contact');
  contact.email = 'hello@example.org';
  assert.deepEqual(homepageReadiness(config, auctions), []);
});

test('homepage schema and renderer links reject unsafe destinations', () => {
  const config = defaultHomepage(nonprofit, auctions);
  const hero = config.sections.find(section => section.type === 'hero');
  assert.ok(hero && hero.type === 'hero');
  hero.primaryUrl = 'javascript:alert(1)';
  assert.equal(homepageConfigSchema.safeParse(config).success, false);
  assert.equal(safeLink('javascript:alert(1)'), '#');
  assert.equal(safeLink('/n/community-fund'), '/n/community-fund');
});
