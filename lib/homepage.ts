import { z } from 'zod';
import type { NonprofitPublic } from './nonprofits';
import type { Auction } from './auction';

const id = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().max(max);
const destination = text(500).refine(value => !value || value.startsWith('/') || value.startsWith('#') || /^https:\/\//i.test(value) || /^(mailto|tel):/i.test(value), 'Use a secure URL or a Gather path.');
const imageUrl = text(1000).refine(value => !value || value.startsWith('/') || /^https:\/\//i.test(value), 'Use an HTTPS image URL or a Gather image path.');
const focal = z.number().min(0).max(100);
const common = { id, hidden: z.boolean(), layout: z.enum(['split', 'stacked', 'cards']), alignment: z.enum(['left', 'center']), spacing: z.enum(['compact', 'comfortable', 'generous']) };
const image = { imageUrl, imageAlt: text(240), focalX: focal, focalY: focal };

const header = z.object({ ...common, type: z.literal('header'), logoUrl: imageUrl, logoAlt: text(240), showNavigation: z.boolean(), buttonLabel: text(40), buttonUrl: destination });
const hero = z.object({ ...common, ...image, type: z.literal('hero'), eyebrow: text(80), heading: text(160), description: text(1200), primaryLabel: text(40), primaryUrl: destination, secondaryLabel: text(40), secondaryUrl: destination });
const mission = z.object({ ...common, ...image, type: z.literal('mission'), heading: text(120), body: text(2400) });
const impact = z.object({ ...common, type: z.literal('impact'), heading: text(120), stats: z.array(z.object({ id, value: text(40), label: text(100) })).max(6) });
const featuredAuctions = z.object({ ...common, type: z.literal('featuredAuctions'), heading: text(120), auctionIds: z.array(id).max(8) });
const featuredItems = z.object({ ...common, type: z.literal('featuredItems'), heading: text(120), items: z.array(z.object({ auctionId: id, itemId: id })).max(12) });
const gallery = z.object({ ...common, type: z.literal('gallery'), heading: text(120), images: z.array(z.object({ id, url: imageUrl, alt: text(240), focalX: focal, focalY: focal })).max(12) });
const sponsors = z.object({ ...common, type: z.literal('sponsors'), heading: text(120), sponsors: z.array(z.object({ id, name: text(100), logoUrl: imageUrl, alt: text(240), url: destination })).max(20) });
const faq = z.object({ ...common, type: z.literal('faq'), heading: text(120), items: z.array(z.object({ id, question: text(240), answer: text(2000) })).max(20) });
const contact = z.object({ ...common, type: z.literal('contact'), heading: text(120), email: text(200), phone: text(60), address: text(500), facebook: destination, instagram: destination, linkedin: destination });
const footer = z.object({ ...common, type: z.literal('footer'), tagline: text(240), showGatherCredit: z.boolean() });

export const homepageSectionSchema = z.discriminatedUnion('type', [header, hero, mission, impact, featuredAuctions, featuredItems, gallery, sponsors, faq, contact, footer]);
export const homepageConfigSchema = z.object({
  schemaVersion: z.literal(1),
  theme: z.object({ primary: z.enum(['#175b47', '#264d7e', '#763e62', '#8b431e', '#5b4b8a']), background: z.enum(['#ffffff', '#f8faf9', '#fffaf5']), font: z.enum(['modern', 'classic', 'friendly']) }),
  sections: z.array(homepageSectionSchema).min(1).max(30),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  value.sections.forEach((section, index) => { if (ids.has(section.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['sections', index, 'id'], message: 'Section IDs must be unique.' }); ids.add(section.id); });
});

export type HomepageConfig = z.infer<typeof homepageConfigSchema>;
export type HomepageSection = z.infer<typeof homepageSectionSchema>;
export type SectionType = HomepageSection['type'];
export type HomepageAuction = { id: string; state: Auction };

const base = <T extends SectionType>(type: T, layout: HomepageSection['layout'] = 'stacked', alignment: HomepageSection['alignment'] = 'left', spacing: HomepageSection['spacing'] = 'comfortable') => ({ id: `${type}-${crypto.randomUUID()}`, type, hidden: false, layout, alignment, spacing });

export function createSection(type: SectionType, nonprofit?: NonprofitPublic): HomepageSection {
  const n = nonprofit?.name || 'Our nonprofit';
  switch (type) {
    case 'header': return { ...base(type), logoUrl: '', logoAlt: `${n} logo`, showNavigation: true, buttonLabel: 'Browse auctions', buttonUrl: '#auctions' };
    case 'hero': return { ...base(type, 'split'), imageUrl: '', imageAlt: '', focalX: 50, focalY: 50, eyebrow: 'Together, we make a difference', heading: nonprofit?.headline || 'Good things happen when we give together.', description: nonprofit?.mission || `Support ${n} and help our community thrive.`, primaryLabel: 'Explore our auctions', primaryUrl: '#auctions', secondaryLabel: '', secondaryUrl: '' };
    case 'mission': return { ...base(type, 'split'), imageUrl: '', imageAlt: '', focalX: 50, focalY: 50, heading: 'Our mission', body: nonprofit?.mission || `Tell visitors how ${n} serves the community.` };
    case 'impact': return { ...base(type, 'cards', 'center'), heading: 'Our impact', stats: [{ id: crypto.randomUUID(), value: '100%', label: 'Organizer supplied impact statistic' }] };
    case 'featuredAuctions': return { ...base(type, 'cards'), heading: 'Our auctions', auctionIds: [] };
    case 'featuredItems': return { ...base(type, 'cards'), heading: 'Featured auction items', items: [] };
    case 'gallery': return { ...base(type, 'cards'), heading: 'Our community', images: [] };
    case 'sponsors': return { ...base(type, 'cards', 'center'), heading: 'Sponsors and supporters', sponsors: [] };
    case 'faq': return { ...base(type), heading: 'Frequently asked questions', items: [{ id: crypto.randomUUID(), question: 'How does the auction work?', answer: 'Browse freely. You will be asked to register when you are ready to bid.' }] };
    case 'contact': return { ...base(type), heading: 'Contact us', email: '', phone: '', address: '', facebook: '', instagram: '', linkedin: '' };
    case 'footer': return { ...base(type), tagline: `Supporting ${n}.`, showGatherCredit: true };
  }
}

export function defaultHomepage(nonprofit: NonprofitPublic, auctions: HomepageAuction[]): HomepageConfig {
  const headerSection = createSection('header', nonprofit);
  const heroSection = createSection('hero', nonprofit);
  const missionSection = createSection('mission', nonprofit);
  const auctionSection = createSection('featuredAuctions', nonprofit);
  if (auctionSection.type === 'featuredAuctions') auctionSection.auctionIds = auctions.map(a => a.id).slice(0, 4);
  const contactSection = createSection('contact', nonprofit);
  const footerSection = createSection('footer', nonprofit);
  return { schemaVersion: 1, theme: { primary: ['#175b47', '#264d7e', '#763e62', '#8b431e', '#5b4b8a'].includes(nonprofit.accent) ? nonprofit.accent as HomepageConfig['theme']['primary'] : '#175b47', background: '#f8faf9', font: 'modern' }, sections: [headerSection, heroSection, missionSection, auctionSection, contactSection, footerSection] };
}

export function parseHomepage(raw: string | null | undefined) { if (!raw) return null; try { return homepageConfigSchema.parse(JSON.parse(raw)); } catch { return null; } }
export function safeLink(value: string) { return value && (value.startsWith('/') || value.startsWith('#') || /^https:\/\//i.test(value) || /^(mailto|tel):/i.test(value)) ? value : '#'; }
export function spacingClass(value: HomepageSection['spacing']) { return value === 'compact' ? 'py-10 md:py-14' : value === 'generous' ? 'py-20 md:py-28' : 'py-14 md:py-20'; }
export const sectionLabels: Record<SectionType, string> = { header: 'Header', hero: 'Hero', mission: 'Mission / about', impact: 'Impact statistics', featuredAuctions: 'Featured auctions', featuredItems: 'Featured items', gallery: 'Photo gallery', sponsors: 'Sponsors', faq: 'FAQ', contact: 'Contact & social', footer: 'Footer' };

export function homepageReadiness(config: HomepageConfig, auctions: HomepageAuction[]) {
  const issues: string[] = [];
  const auctionIds = new Set(auctions.map(auction => auction.id));
  const itemIds = new Set(auctions.flatMap(auction => auction.state.items.map(item => `${auction.id}:${item.id}`)));
  for (const section of config.sections.filter(item => !item.hidden)) {
    const label = sectionLabels[section.type];
    if ('heading' in section && !section.heading.trim()) issues.push(`${label}: add a heading.`);
    if (section.type === 'header' && section.logoUrl && !section.logoAlt) issues.push('Header: add logo alt text.');
    if (section.type === 'header' && Boolean(section.buttonLabel) !== Boolean(section.buttonUrl)) issues.push('Header: complete both the button label and destination.');
    if (section.type === 'hero') {
      if (!section.heading || !section.description) issues.push('Hero: add a heading and description.');
      if (section.imageUrl && !section.imageAlt) issues.push('Hero: add image alt text.');
      if (Boolean(section.primaryLabel) !== Boolean(section.primaryUrl)) issues.push('Hero: complete the primary button label and destination.');
      if (Boolean(section.secondaryLabel) !== Boolean(section.secondaryUrl)) issues.push('Hero: complete the secondary button label and destination.');
    }
    if (section.type === 'mission') { if (!section.body) issues.push('Mission / about: add the organization story.'); if (section.imageUrl && !section.imageAlt) issues.push('Mission / about: add image alt text.'); }
    if (section.type === 'impact' && (!section.stats.length || section.stats.some(stat => !stat.value || !stat.label))) issues.push('Impact statistics: complete every value and label.');
    if (section.type === 'featuredAuctions') { if (!section.auctionIds.length) issues.push('Featured auctions: choose at least one auction.'); if (section.auctionIds.some(id => !auctionIds.has(id))) issues.push('Featured auctions: remove unavailable auctions.'); }
    if (section.type === 'featuredItems') { if (!section.items.length) issues.push('Featured items: choose at least one item.'); if (section.items.some(item => !itemIds.has(`${item.auctionId}:${item.itemId}`))) issues.push('Featured items: remove unavailable items.'); }
    if (section.type === 'gallery' && (!section.images.length || section.images.some(image => !image.url || !image.alt))) issues.push('Photo gallery: add an image and alt text for every photo.');
    if (section.type === 'sponsors' && (!section.sponsors.length || section.sponsors.some(sponsor => !sponsor.name))) issues.push('Sponsors: add a name for every sponsor.');
    if (section.type === 'faq' && (!section.items.length || section.items.some(item => !item.question || !item.answer))) issues.push('FAQ: complete every question and answer.');
    if (section.type === 'contact' && !section.email && !section.phone && !section.address && !section.facebook && !section.instagram && !section.linkedin) issues.push('Contact & social: add at least one contact method.');
    if (section.type === 'footer' && !section.tagline) issues.push('Footer: add a tagline.');
  }
  return [...new Set(issues)];
}
