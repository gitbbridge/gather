import { nonprofitBySlug,database } from '@/lib/nonprofits';
import { notFound } from 'next/navigation';
import AuctionApp from '@/app/auction-app-client';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string;auctionId:string}>}){const {slug,auctionId}=await params;const n=await nonprofitBySlug(slug);const row=n?await database().prepare('SELECT state FROM auctions WHERE id=? AND nonprofit_id=?').bind(auctionId,n.id).first<{state:string}>():null;const title=row?`${JSON.parse(row.state).name} | ${n!.name}`:'Auction not found';const description=n?`Browse auction items supporting ${n.name}. Register only when you are ready to bid.`:'';return {title,description,openGraph:{title,description,images:[]},twitter:{title,description,images:[]}};}
export default async function AuctionPage({params}:{params:Promise<{slug:string;auctionId:string}>}){const {slug,auctionId}=await params;const n=await nonprofitBySlug(slug);if(!n)notFound();const row=await database().prepare('SELECT id FROM auctions WHERE id=? AND nonprofit_id=?').bind(auctionId,n.id).first();if(!row)notFound();return <AuctionApp auctionId={auctionId} bidderMode/>;}
