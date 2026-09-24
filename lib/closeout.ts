import type { Auction } from './auction';

export type Registration = { userId: string; name: string; email: string };
export type CloseoutStatus = { userId: string; pickupStatus: string; followupStatus: string };
export type ParticipantCloseout = {
  userId: string; name: string; email: string; bidderNumber: string;
  bidCount: number; itemsWon: string[]; winningBidTotal: number;
  donationTotal: number; buyNowTotal: number; totalCommitment: number;
  activity: string[]; paymentStatus: 'not_collected_test_mode';
  pickupStatus: string; followupStatus: string; lastActivity: number;
};

export function buildCloseout(auction: Auction, registrations: Registration[], statuses: CloseoutStatus[], now = Date.now()) {
  const registrationMap = new Map(registrations.map(r => [r.userId, r]));
  const statusMap = new Map(statuses.map(s => [s.userId, s]));
  const ids = new Set<string>();
  auction.items.forEach(item => item.bids.forEach(b => ids.add(b.user)));
  auction.donations.forEach(d => ids.add(d.user));
  auction.orders.forEach(o => ids.add(o.user));
  registrations.forEach(r => ids.add(r.userId));

  const participants: ParticipantCloseout[] = [...ids].map(userId => {
    const registration = registrationMap.get(userId);
    const status = statusMap.get(userId);
    const bids = auction.items.flatMap(item => item.bids.filter(b => b.user === userId));
    const won = auction.items.filter(item => item.leader === userId && (item.sold || item.ends <= now));
    const orders = auction.orders.filter(o => o.user === userId);
    const donations = auction.donations.filter(d => d.user === userId);
    const winningBidTotal = won.filter(item => !orders.some(o => o.item === item.title)).reduce((sum, item) => sum + item.price, 0);
    const buyNowTotal = orders.reduce((sum, order) => sum + order.amount, 0);
    const donationTotal = donations.reduce((sum, donation) => sum + donation.amount, 0);
    const activity = [won.length ? 'Winner' : '', donations.length ? 'Donor' : '', orders.length ? 'Buy now' : '', bids.length && !won.length ? 'Bidder only' : ''].filter(Boolean);
    const lastActivity = Math.max(0, ...bids.map(b => b.at), ...orders.map(o => o.at), ...donations.map(d => d.at));
    return { userId, name: registration?.name || `Bidder ${userId.slice(-6)}`, email: registration?.email || '', bidderNumber: userId.slice(-6).toUpperCase(), bidCount: bids.length, itemsWon: won.map(item => item.title), winningBidTotal, donationTotal, buyNowTotal, totalCommitment: winningBidTotal + donationTotal + buyNowTotal, activity, paymentStatus: 'not_collected_test_mode' as const, pickupStatus: won.length ? status?.pickupStatus || 'pending' : 'not_applicable', followupStatus: status?.followupStatus || 'not_sent', lastActivity };
  }).sort((a,b) => b.totalCommitment - a.totalCommitment || b.lastActivity - a.lastActivity);

  const auctionRaised = participants.reduce((sum,p)=>sum+p.winningBidTotal,0);
  const donations = participants.reduce((sum,p)=>sum+p.donationTotal,0);
  const buyNow = participants.reduce((sum,p)=>sum+p.buyNowTotal,0);
  return { participants, auctionRaised, donations, buyNow, totalCommitments: auctionRaised + donations + buyNow, winners: participants.filter(p=>p.itemsWon.length).length, donors: participants.filter(p=>p.donationTotal>0).length, outstanding: participants.filter(p=>(p.pickupStatus==='pending'||p.followupStatus==='not_sent')&&(p.itemsWon.length||p.donationTotal||p.bidCount)).length };
}

export function followupMessage(person: ParticipantCloseout, organization: string) {
  const intro = `Hi ${person.name}, thank you for supporting ${organization}.`;
  if (person.itemsWon.length && person.donationTotal) return `${intro} You won ${person.itemsWon.join(', ')} and also made a donation. This test closeout records ${format(person.totalCommitment)} in total commitments. We’ll follow up separately about payment and pickup.`;
  if (person.itemsWon.length) return `${intro} You won ${person.itemsWon.join(', ')}. This test closeout records ${format(person.totalCommitment)} in commitments. We’ll follow up separately about payment and pickup.`;
  if (person.donationTotal) return `${intro} We’re grateful for your ${format(person.donationTotal)} test donation commitment.`;
  return `${intro} We appreciate your participation in the auction.`;
}
const format=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100);
