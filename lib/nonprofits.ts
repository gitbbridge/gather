import { env } from 'cloudflare:workers';
export type Nonprofit = {id:string;owner:string;slug:string;name:string;headline:string;mission:string;accent:string};
export type NonprofitPublic = Omit<Nonprofit,'owner'>;
export function database(){if(!env.DB)throw Error('Database unavailable');return env.DB;}
export function publicNonprofit(n:Nonprofit):NonprofitPublic {const {owner,...publicFields}=n;return publicFields;}
export const nonprofitBySlug=(slug:string)=>database().prepare('SELECT * FROM nonprofits WHERE slug=?').bind(slug).first<Nonprofit>();
export const nonprofitById=(id:string)=>database().prepare('SELECT * FROM nonprofits WHERE id=?').bind(id).first<Nonprofit>();
export async function isRegistered(nonprofitId:string,user:string){return !!await database().prepare('SELECT user_id FROM registrations WHERE nonprofit_id=? AND user_id=?').bind(nonprofitId,user).first();}
export function nonprofitSlug(name:string,id:string){return (name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'nonprofit')+'-'+id.slice(0,8);}
export function nonprofitInsert(id:string,owner:string,name:string,requestedSlug?:string){return database().prepare('INSERT INTO nonprofits (id,owner,slug,name,headline,mission,accent) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,owner,requestedSlug||nonprofitSlug(name,id),name,'Good things happen when we give together.',`Support ${name} by discovering something you love. Every bid helps make our work possible.`,'#175b47');}
