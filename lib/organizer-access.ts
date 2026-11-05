import { getAppUser } from './auth';
import { isPlatformAdmin } from './platform-admin';
import { database, nonprofitById } from './nonprofits';
import type { Auction } from './auction';

export async function managedAuction(auctionId: string) {
  const user = await getAppUser();
  if (!user) return null;
  const row = await database().prepare('SELECT id,owner,state,nonprofit_id FROM auctions WHERE id=?').bind(auctionId)
    .first<{ id: string; owner: string; state: string; nonprofit_id: string | null }>();
  if (!row || (row.owner !== user.userId && !isPlatformAdmin(user))) return null;
  const nonprofit = row.nonprofit_id ? await nonprofitById(row.nonprofit_id) : null;
  return { user, row, nonprofit, auction: JSON.parse(row.state) as Auction };
}

export async function managedOrganization(organizationId: string) {
  const user = await getAppUser();
  if (!user) return null;
  const nonprofit = await nonprofitById(organizationId);
  if (!nonprofit || (nonprofit.owner !== user.userId && !isPlatformAdmin(user))) return null;
  return { user, nonprofit };
}
