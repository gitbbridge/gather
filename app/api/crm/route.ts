import { z } from "zod";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertSupporter } from "@/lib/supabase/supporters";
import { contactFinancialSummary, derivedRoles, donorLifecycle, retentionMetrics, type CrmActivity, type CrmContactInput } from "@/lib/crm";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const role = z.enum(["donor","bidder","sponsor","volunteer","event_attendee","auction_item_donor"]);
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("contact.save"), organizationId: uuid, supporterId: uuid.optional(), fullName: z.string().trim().min(1).max(120), email: z.string().email(), secondaryEmail: z.union([z.literal(""),z.string().email()]).optional(), phone: z.string().trim().max(40).optional(), companyName: z.string().trim().max(160).optional(), status: z.enum(["active","lapsed","inactive","deceased","do_not_contact"]).default("active"), roles: z.array(role).max(6).default([]), tags: z.array(z.string().trim().min(1).max(40)).max(40).default([]), mailingAddress: z.record(z.string(),z.string()).default({}) }),
  z.object({ action: z.literal("note.save"), organizationId: uuid, supporterId: uuid, body: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("task.save"), organizationId: uuid, id: uuid.optional(), supporterId: uuid.nullable().optional(), opportunityId: uuid.nullable().optional(), title: z.string().trim().min(2).max(180), description: z.string().trim().max(4000).default(""), dueAt: z.string().datetime().nullable().optional() }),
  z.object({ action: z.literal("task.status"), organizationId: uuid, id: uuid, status: z.enum(["open","completed","cancelled"]) }),
  z.object({ action: z.literal("household.save"), organizationId: uuid, id: uuid.optional(), name: z.string().trim().min(2).max(140), supporterIds: z.array(uuid).min(1).max(20), primarySupporterId: uuid }),
  z.object({ action: z.literal("opportunity.save"), organizationId: uuid, id: uuid.optional(), supporterId: uuid.nullable().optional(), companyName: z.string().trim().max(160).optional(), opportunityType: z.enum(["major_gift","corporate_sponsorship","auction_item_donation"]), name: z.string().trim().min(2).max(180), stage: z.enum(["prospect","contacted","committed","fulfilled","thanked"]), amountCents: z.number().int().min(0).nullable().optional(), notes: z.string().trim().max(4000).default(""), nextTaskAt: z.string().datetime().nullable().optional() }),
  z.object({ action: z.literal("opportunity.stage"), organizationId: uuid, id: uuid, stage: z.enum(["prospect","contacted","committed","fulfilled","thanked"]) }),
  z.object({ action: z.literal("pledge.save"), organizationId: uuid, supporterId: uuid.nullable().optional(), opportunityId: uuid.nullable().optional(), pledgeType: z.enum(["donation","sponsorship","auction_purchase"]), amountCents: z.number().int().positive(), dueAt: z.string().datetime().nullable().optional() }),
  z.object({ action: z.literal("preference.save"), organizationId: uuid, supporterId: uuid, emailStatus: z.enum(["unknown","subscribed","unsubscribed"]), smsStatus: z.enum(["unknown","subscribed","unsubscribed"]), consentSource: z.string().trim().max(160).optional() }),
  z.object({ action: z.literal("segment.save"), organizationId: uuid, name: z.string().trim().min(2).max(100), filters: z.record(z.string(),z.unknown()) }),
  z.object({ action: z.literal("merge"), organizationId: uuid, targetId: uuid, duplicateId: uuid }),
]);

type Activity = CrmActivity & { id: string; metadata?: Record<string,unknown>; auctions?: { name:string } | { name:string }[]; auction_items?: { title:string } | { title:string }[] };
type ContactRow = CrmContactInput & { id:string;full_name:string;email:string;secondary_email?:string|null;phone?:string|null;company_name?:string|null;status?:string;mailing_address?:Record<string,string>;tags?:string[];roles?:string[];created_at:string;last_activity_at:string;supporter_activities?:Activity[];supporter_notes?:Array<{id:string;body:string;created_at:string}> };

function setupError(error: unknown) { return /relation .* does not exist|column .* does not exist|schema cache/i.test(error instanceof Error ? error.message : String(error)); }
const audit = async (organizationId:string,supporterId:string|null,actorId:string,actionName:string,previousState:unknown,newState:unknown) => {
  const { error } = await createSupabaseAdminClient().from("crm_audit_events").insert({ organization_id:organizationId,supporter_id:supporterId,actor_id:actorId,action:actionName,previous_state:previousState,new_state:newState });
  if (error) throw error;
};

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organization") || "";
  if (!uuid.safeParse(organizationId).success) return Response.json({ error:"Choose a nonprofit workspace." },{ status:400 });
  const access = await managedOrganization(organizationId);
  if (!access) return Response.json({ error:"Access denied." },{ status:403 });
  try {
    const client = createSupabaseAdminClient();
    const [contactsResult,householdsResult,tasksResult,opportunitiesResult,pledgesResult,attachmentsResult,preferencesResult,segmentsResult,settingsResult,emailEventsResult,sponsorsResult] = await Promise.all([
      client.from("supporters").select("*,supporter_activities(*,auctions(name),auction_items(title)),supporter_notes(*)").eq("organization_id",organizationId).order("last_activity_at",{ascending:false}),
      client.from("crm_households").select("*,crm_household_members(*)").eq("organization_id",organizationId).order("name"),
      client.from("crm_tasks").select("*").eq("organization_id",organizationId).order("due_at",{ascending:true}),
      client.from("crm_opportunities").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
      client.from("crm_pledges").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
      client.from("crm_attachments").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
      client.from("marketing_contact_preferences").select("*").eq("organization_id",organizationId),
      client.from("supporter_segments").select("*").eq("organization_id",organizationId).order("name"),
      client.from("crm_settings").select("*").eq("organization_id",organizationId).maybeSingle(),
      client.from("email_campaign_events").select("id,supporter_id,campaign_id,event_type,occurred_at,metadata").eq("organization_id",organizationId).order("occurred_at",{ascending:false}).limit(1000),
      client.from("event_sponsors").select("commitment_cents,amount_received_cents,status").eq("organization_id",organizationId),
    ]);
    for (const result of [contactsResult,householdsResult,tasksResult,opportunitiesResult,pledgesResult,attachmentsResult,preferencesResult,segmentsResult,settingsResult,emailEventsResult,sponsorsResult]) if (result.error) throw result.error;
    const settings = settingsResult.data || { significant_donation_threshold_cents:100000,lapsed_after_months:12 };
    const contacts = ((contactsResult.data || []) as unknown as ContactRow[]).map((contact) => {
      const activities = contact.supporter_activities || [];
      return { ...contact,activities,notes:contact.supporter_notes || [],financial:contactFinancialSummary(activities),derivedRoles:derivedRoles(contact),lifecycle:donorLifecycle(activities,settings.lapsed_after_months) };
    });
    const householdBySupporter = new Map<string,unknown>();
    for (const household of householdsResult.data || []) for (const member of household.crm_household_members || []) householdBySupporter.set(member.supporter_id,{ id:household.id,name:household.name,relationship:member.relationship,isPrimary:member.is_primary,members:household.crm_household_members });
    const preferences = new Map((preferencesResult.data || []).map((item) => [item.supporter_id,item]));
    const communications = new Map<string,unknown[]>();
    for (const event of emailEventsResult.data || []) if (event.supporter_id) communications.set(event.supporter_id,[...(communications.get(event.supporter_id) || []),event]);
    const enriched = contacts.map((contact) => ({ ...contact,household:householdBySupporter.get(contact.id) || null,preference:preferences.get(contact.id) || null,communications:communications.get(contact.id) || [] }));
    const duplicates: string[][] = [];
    const candidateKeys = new Map<string,string[]>();
    for (const contact of enriched) for (const key of [`name:${contact.full_name.trim().toLowerCase()}`,contact.phone ? `phone:${contact.phone.replace(/\D/g,"")}` : ""]) if (key && !key.endsWith(":")) candidateKeys.set(key,[...(candidateKeys.get(key) || []),contact.id]);
    for (const ids of candidateKeys.values()) if (ids.length > 1 && !duplicates.some((group) => group.join() === ids.join())) duplicates.push(ids);
    const financial = enriched.map((contact) => contact.financial);
    const retention = retentionMetrics(enriched);
    const outstandingPledges = (pledgesResult.data || []).filter((item) => !["paid","cancelled","refunded"].includes(item.status));
    const sponsorRows = sponsorsResult.data || [];
    return Response.json({
      organization:{id:access.nonprofit.id,name:access.nonprofit.name},contacts:enriched,households:householdsResult.data || [],tasks:tasksResult.data || [],opportunities:opportunitiesResult.data || [],pledges:pledgesResult.data || [],attachments:attachmentsResult.data || [],segments:segmentsResult.data || [],settings,duplicates,
      reporting:{ totalContacts:enriched.length,households:(householdsResult.data || []).length,lifetimeGivingCents:financial.reduce((sum,item)=>sum+item.lifetimeGivingCents,0),activeDonors:enriched.filter((item)=>item.lifecycle==="active").length,eventSponsors:sponsorRows.filter((item)=>item.status==="active").length,uniqueDonors:enriched.filter((item)=>item.financial.lifetimeGivingCents>0).length,newDonors:enriched.filter((item)=>item.financial.lastGiftAt && new Date(item.financial.lastGiftAt).getUTCFullYear()===new Date().getUTCFullYear() && item.activities.filter((activity)=>["payment_completed","historical_contribution"].includes(activity.activity_type)).length===1).length,repeatDonors:enriched.filter((item)=>item.activities.filter((activity)=>["payment_completed","historical_contribution"].includes(activity.activity_type)).length>1).length,lapsedDonors:enriched.filter((item)=>item.lifecycle==="lapsed").length,retentionRate:retention.retentionRate,eventAttendance:enriched.reduce((sum,item)=>sum+item.activities.filter((activity)=>activity.activity_type==="event_attended").length,0),sponsorshipCommittedCents:sponsorRows.reduce((sum,item)=>sum+Number(item.commitment_cents || 0),0),sponsorshipReceivedCents:sponsorRows.reduce((sum,item)=>sum+Number(item.amount_received_cents || 0),0),outstandingBalanceCents:outstandingPledges.reduce((sum,item)=>sum+Math.max(0,Number(item.amount_cents)-Number(item.paid_cents)),0) },
      definitions:{ activeDonor:`At least one recorded gift in the last ${settings.lapsed_after_months} months.`,lapsedDonor:`A prior recorded gift but none in the last ${settings.lapsed_after_months} months.`,retention:"Prior-calendar-year donors who also gave in the current calendar year.",lifetimeGiving:"Confirmed Gather payment and imported historical contribution activity, less recorded refunds. Auction bids alone are excluded." }
    },{ headers:{"cache-control":"no-store"} });
  } catch (error) {
    console.error("Unable to load donor CRM:",error);
    if (setupError(error)) return Response.json({ error:"Donor CRM database setup is required.",setupRequired:true },{ status:503 });
    return Response.json({ error:"Unable to load donor CRM." },{ status:500 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({error:"Invalid request origin."},{status:403});
    const parsed = action.safeParse(await request.json());
    if (!parsed.success) return Response.json({error:"Check the CRM information and try again.",issues:parsed.error.issues.map((issue)=>({field:issue.path.join("."),message:issue.message}))},{status:400});
    const input = parsed.data;
    const access = await managedOrganization(input.organizationId);
    if (!access) return Response.json({error:"Access denied."},{status:403});
    const client = createSupabaseAdminClient();
    if (input.action === "contact.save") {
      const supporter = input.supporterId ? (await client.from("supporters").select("*").eq("id",input.supporterId).eq("organization_id",input.organizationId).single()).data : await upsertSupporter({organizationId:input.organizationId,email:input.email,fullName:input.fullName,phone:input.phone,tags:input.tags,mailingAddress:input.mailingAddress,source:"manual"});
      if (!supporter) return Response.json({error:"Contact not found."},{status:404});
      const {data,error} = await client.from("supporters").update({email:input.email.toLowerCase(),normalized_email:input.email.toLowerCase(),full_name:input.fullName,secondary_email:input.secondaryEmail || null,phone:input.phone || null,company_name:input.companyName || null,status:input.status,roles:input.roles,tags:input.tags,mailing_address:input.mailingAddress}).eq("id",supporter.id).eq("organization_id",input.organizationId).select("*").single();
      if (error) throw error;
      await audit(input.organizationId,supporter.id,access.user.userId,input.supporterId?"contact.updated":"contact.created",supporter,data);
      return Response.json({contact:data});
    }
    if (input.action === "note.save") {
      const {data,error}=await client.from("supporter_notes").insert({organization_id:input.organizationId,supporter_id:input.supporterId,author_id:access.user.userId,body:input.body}).select("*").single(); if(error)throw error; await audit(input.organizationId,input.supporterId,access.user.userId,"note.created",null,data); return Response.json({note:data});
    }
    if (input.action === "task.save") {
      const id=input.id || crypto.randomUUID(); const {data,error}=await client.from("crm_tasks").upsert({id,organization_id:input.organizationId,supporter_id:input.supporterId || null,opportunity_id:input.opportunityId || null,title:input.title,description:input.description,due_at:input.dueAt || null,status:"open",source:"manual",created_by:access.user.userId},{onConflict:"id"}).select("*").single(); if(error)throw error; await audit(input.organizationId,input.supporterId || null,access.user.userId,input.id?"task.updated":"task.created",null,data); return Response.json({task:data});
    }
    if (input.action === "task.status") {
      const {data:before}=await client.from("crm_tasks").select("*").eq("id",input.id).eq("organization_id",input.organizationId).single(); const {data,error}=await client.from("crm_tasks").update({status:input.status,completed_at:input.status==="completed"?new Date().toISOString():null}).eq("id",input.id).eq("organization_id",input.organizationId).select("*").single(); if(error)throw error; await audit(input.organizationId,data.supporter_id,access.user.userId,"task.status_changed",before,data); return Response.json({task:data});
    }
    if (input.action === "household.save") {
      const id=input.id || crypto.randomUUID(); const {data,error}=await client.from("crm_households").upsert({id,organization_id:input.organizationId,name:input.name,created_by:access.user.userId},{onConflict:"id"}).select("*").single(); if(error)throw error; await client.from("crm_household_members").delete().eq("household_id",id).eq("organization_id",input.organizationId); const {error:memberError}=await client.from("crm_household_members").insert(input.supporterIds.map((supporterId)=>({household_id:id,organization_id:input.organizationId,supporter_id:supporterId,relationship:supporterId===input.primarySupporterId?"primary":"member",is_primary:supporterId===input.primarySupporterId}))); if(memberError)throw memberError; await audit(input.organizationId,input.primarySupporterId,access.user.userId,input.id?"household.updated":"household.created",null,data); return Response.json({household:data});
    }
    if (input.action === "opportunity.save") {
      const id=input.id || crypto.randomUUID(); const {data,error}=await client.from("crm_opportunities").upsert({id,organization_id:input.organizationId,supporter_id:input.supporterId || null,company_name:input.companyName || null,opportunity_type:input.opportunityType,name:input.name,stage:input.stage,amount_cents:input.amountCents ?? null,notes:input.notes,next_task_at:input.nextTaskAt || null,created_by:access.user.userId},{onConflict:"id"}).select("*").single(); if(error)throw error; await audit(input.organizationId,input.supporterId || null,access.user.userId,input.id?"opportunity.updated":"opportunity.created",null,data); return Response.json({opportunity:data});
    }
    if (input.action === "opportunity.stage") {
      const {data:before}=await client.from("crm_opportunities").select("*").eq("id",input.id).eq("organization_id",input.organizationId).single(); const {data,error}=await client.from("crm_opportunities").update({stage:input.stage}).eq("id",input.id).eq("organization_id",input.organizationId).select("*").single(); if(error)throw error; await audit(input.organizationId,data.supporter_id,access.user.userId,"opportunity.stage_changed",before,data); return Response.json({opportunity:data});
    }
    if (input.action === "pledge.save") {
      const {data,error}=await client.from("crm_pledges").insert({organization_id:input.organizationId,supporter_id:input.supporterId || null,opportunity_id:input.opportunityId || null,pledge_type:input.pledgeType,amount_cents:input.amountCents,due_at:input.dueAt || null,status:"pledged",authoritative_source:"crm_pledge",created_by:access.user.userId}).select("*").single(); if(error)throw error; await audit(input.organizationId,input.supporterId || null,access.user.userId,"pledge.created",null,data); return Response.json({pledge:data});
    }
    if (input.action === "preference.save") {
      const {data:existing}=await client.from("marketing_contact_preferences").select("*").eq("organization_id",input.organizationId).eq("supporter_id",input.supporterId).maybeSingle(); if(["unsubscribed","complained"].includes(existing?.marketing_status) && input.emailStatus==="subscribed") return Response.json({error:"A staff edit cannot override an unsubscribe or complaint suppression."},{status:409}); const now=new Date().toISOString(); const {data,error}=await client.from("marketing_contact_preferences").upsert({organization_id:input.organizationId,supporter_id:input.supporterId,marketing_status:input.emailStatus,sms_marketing_status:input.smsStatus,consent_source:input.consentSource || "organizer_recorded",consent_recorded_at:input.emailStatus==="subscribed"?now:existing?.consent_recorded_at,sms_consent_source:input.consentSource || "organizer_recorded",sms_consent_recorded_at:input.smsStatus==="subscribed"?now:existing?.sms_consent_recorded_at,suppressed_at:input.emailStatus==="unsubscribed"?now:existing?.suppressed_at,suppression_reason:input.emailStatus==="unsubscribed"?"organizer_recorded":existing?.suppression_reason},{onConflict:"organization_id,supporter_id"}).select("*").single(); if(error)throw error; await audit(input.organizationId,input.supporterId,access.user.userId,"preferences.updated",existing,data); return Response.json({preference:data});
    }
    if (input.action === "segment.save") { const {data,error}=await client.from("supporter_segments").upsert({organization_id:input.organizationId,name:input.name,filters:input.filters,created_by:access.user.userId},{onConflict:"organization_id,name"}).select("*").single(); if(error)throw error; return Response.json({segment:data}); }
    if (input.targetId===input.duplicateId) return Response.json({error:"Choose two different contacts."},{status:400});
    const {data:records,error:recordError}=await client.from("supporters").select("*").eq("organization_id",input.organizationId).in("id",[input.targetId,input.duplicateId]); if(recordError || records?.length!==2)return Response.json({error:"Both contacts are required."},{status:404}); const target=records.find((item)=>item.id===input.targetId)!; const duplicate=records.find((item)=>item.id===input.duplicateId)!;
    for (const table of ["supporter_activities","supporter_notes","crm_tasks","crm_opportunities","crm_pledges","crm_attachments","email_campaign_events"]) await client.from(table).update({supporter_id:target.id}).eq("organization_id",input.organizationId).eq("supporter_id",duplicate.id);
    const {data:targetPreference}=await client.from("marketing_contact_preferences").select("*").eq("organization_id",input.organizationId).eq("supporter_id",target.id).maybeSingle(); if(!targetPreference)await client.from("marketing_contact_preferences").update({supporter_id:target.id}).eq("organization_id",input.organizationId).eq("supporter_id",duplicate.id);
    await client.from("crm_household_members").delete().eq("organization_id",input.organizationId).eq("supporter_id",duplicate.id);
    await client.from("supporters").update({tags:[...new Set([...(target.tags || []),...(duplicate.tags || [])])],roles:[...new Set([...(target.roles || []),...(duplicate.roles || [])])],phone:target.phone || duplicate.phone,secondary_email:target.secondary_email || duplicate.secondary_email,company_name:target.company_name || duplicate.company_name,mailing_address:Object.keys(target.mailing_address || {}).length?target.mailing_address:duplicate.mailing_address}).eq("id",target.id).eq("organization_id",input.organizationId);
    await audit(input.organizationId,target.id,access.user.userId,"contacts.merged",{target,duplicate},{targetId:target.id}); const {error:deleteError}=await client.from("supporters").delete().eq("id",duplicate.id).eq("organization_id",input.organizationId); if(deleteError)throw deleteError; return Response.json({supporterId:target.id});
  } catch (error) {
    console.error("Unable to update donor CRM:",error);
    if (setupError(error)) return Response.json({error:"Donor CRM database setup is required.",setupRequired:true},{status:503});
    return Response.json({error:error instanceof Error?error.message:"Unable to save the donor CRM record."},{status:500});
  }
}
