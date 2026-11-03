import { getAppUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const json = (body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(){
  try{
    if(!await getAppUser())return json({error:'Sign in to browse Give Holidays experiences.'},401);
    const {data,error}=await createSupabaseAdminClient().from('give_holidays_catalog').select('*').order('destination');
    if(error)throw error;
    return json({packages:(data||[]).map(row=>({
      id:row.id,slug:row.slug,destination:row.destination,region:row.region,title:row.title,category:row.category,
      cardDescription:row.card_description,fullDescription:row.full_description,heroImageUrl:row.hero_image_url||'',galleryUrls:row.gallery_urls||[],
      included:row.included,notIncluded:row.not_included,fairMarketValueCents:row.fair_market_value_cents,
      suggestedStartingBidCents:row.suggested_starting_bid_cents,minimumStartingBidCents:row.minimum_sale_floor_cents,
      buyNowPriceCents:row.buy_now_price_cents||0,packagesAvailable:row.packages_available,stayLength:row.stay_length,
      occupancy:row.occupancy,roomType:row.room_type,blackoutDates:row.terms?.blackoutDates||'',restrictions:row.terms?.restrictions||'',
      expirationDate:row.expiration_date||'',bookingLeadTimeDays:row.booking_lead_time_days,
      cancellationTerms:row.cancellation_terms,refundTerms:row.refund_terms,redemptionInstructions:row.redemption_instructions,
    }))});
  }catch(error){console.error('Unable to load safe Give Holidays catalog:',error);return json({error:'Unable to load Give Holidays experiences.'},500);}
}
