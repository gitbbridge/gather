"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Bug,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Gavel,
  HeartHandshake,
  LayoutGrid,
  Plane,
  ShieldCheck,
  Users,
} from "lucide-react";
import { sandboxPageGroups } from "@/lib/sandbox-page-directory";

const roles = [
  "Nonprofit Organizer",
  "Donor / Bidder",
  "Gather Platform Administrator",
  "Give Holidays Fulfillment Manager",
] as const;
const issueTypes = ["Bug", "Requested Change", "Missing Functionality", "Observation"] as const;
const priorities = ["Low", "Medium", "High", "Critical"] as const;
const statuses = ["Open", "In Review", "Resolved", "Retest Required"] as const;

type Role = typeof roles[number];
type Issue = {
  id: string;
  title: string;
  userRole: Role;
  workflowArea: string;
  issueType: typeof issueTypes[number];
  priority: typeof priorities[number];
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  pageUrl: string;
  status: typeof statuses[number];
  createdAt: number;
};

type IssueForm = Pick<Issue, "userRole" | "workflowArea" | "issueType" | "priority" | "description" | "expectedBehavior" | "actualBehavior" | "pageUrl"> & {
  title: string;
};

type Workflow = { label: string; href?: string; note?: string };
type RoleSection = {
  role: Role;
  summary: string;
  icon: typeof BriefcaseBusiness;
  workflows: Workflow[];
};

const sections: RoleSection[] = [
  {
    role: "Nonprofit Organizer",
    summary: "Create and manage a nonprofit auction from setup through closeout.",
    icon: BriefcaseBusiness,
    workflows: [
      { label: "Registration and login", href: "/auth?return_to=%2Fonboarding" },
      { label: "Five-step onboarding", href: "/onboarding" },
      { label: "Organization dashboard", href: "/admin" },
      { label: "Auction and item management", href: "/admin" },
      { label: "Give Holidays catalog", href: "/admin/give-holidays" },
      { label: "Homepage builder", href: "/homepage" },
      { label: "Financial settings", href: "/admin/settings/email-receipts" },
      { label: "Winner management, closeout and reports", note: "Select the seeded auction first." },
    ],
  },
  {
    role: "Donor / Bidder",
    summary: "Register, browse, bid, watch items, and complete winner checkout.",
    icon: Gavel,
    workflows: [
      { label: "Registration and login", href: "/auth?return_to=%2Faccount" },
      { label: "Bidder account and My Bids", href: "/account" },
      { label: "My Wins", href: "/my-wins" },
      { label: "Public auction catalog and item details", note: "Available after the sample auction is seeded." },
      { label: "Bid, max bid, and watchlist", note: "Open an item in the seeded auction." },
      { label: "Winner checkout", note: "Available after a test auction produces a winner." },
      { label: "Donation flow", note: "Not currently implemented." },
    ],
  },
  {
    role: "Gather Platform Administrator",
    summary: "Review platform operations, security, fees, email, and audit records.",
    icon: ShieldCheck,
    workflows: [
      { label: "Platform administration", href: "/admin" },
      { label: "Give Holidays administration", href: "/admin/give-holidays" },
      { label: "Email administration", href: "/admin/email-templates" },
      { label: "Security controls", href: "/admin/security" },
      { label: "Auction oversight and financial reports", note: "Use the seeded organization dashboard." },
      { label: "Nonprofit management", note: "No separate platform-wide module is available yet." },
      { label: "Audit log viewer", note: "Audit storage exists; a dedicated viewer is not available yet." },
    ],
  },
  {
    role: "Give Holidays Fulfillment Manager",
    summary: "Manage travel packages and paid-package fulfillment records.",
    icon: Plane,
    workflows: [
      { label: "Travel package catalog", href: "/admin/give-holidays" },
      { label: "Package creation and editing", href: "/admin/give-holidays" },
      { label: "Package publication", href: "/admin/give-holidays" },
      { label: "Paid-package fulfillment", href: "/admin/give-holidays/fulfillments" },
      { label: "Direct-offer fulfillment", href: "/admin/give-holidays/direct-fulfillments" },
      { label: "Winner and fulfillment status", href: "/admin/give-holidays/fulfillments" },
    ],
  },
];

const blankForm: IssueForm = {
  title: "",
  userRole: roles[0] as Role,
  workflowArea: "Onboarding",
  issueType: issueTypes[0],
  priority: priorities[1],
  description: "",
  expectedBehavior: "",
  actualBehavior: "",
  pageUrl: "",
};

export default function TestingCenterClient() {
  const [form, setForm] = useState(blankForm);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ status: "", priority: "", role: "" });
  const { status: statusFilter, priority: priorityFilter, role: roleFilter } = filters;

  const loadIssues = async () => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const response = await fetch(`/api/testing/issues?${query}`, { cache: "no-store" });
    if (response.ok) setIssues(((await response.json()) as { issues: Issue[] }).issues);
  };

  useEffect(() => {
    const query = new URLSearchParams(Object.entries({ status: statusFilter, priority: priorityFilter, role: roleFilter }).filter(([, value]) => value));
    const controller = new AbortController();
    fetch(`/api/testing/issues?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load issues.");
        return await response.json() as { issues: Issue[] };
      })
      .then((data) => setIssues(data.issues))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error(error);
      });
    return () => controller.abort();
  }, [statusFilter, priorityFilter, roleFilter]);

  const openCount = useMemo(
    () => issues.filter((issue) => issue.status !== "Resolved").length,
    [issues],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage("");
    const referringPage = document.referrer.startsWith(window.location.origin) && !document.referrer.includes("/testing")
      ? document.referrer
      : window.location.href;
    const response = await fetch("/api/testing/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, pageUrl: referringPage }),
    });
    const result = (await response.json()) as { error?: string; duplicate?: boolean };
    setSaving(false);
    if (!response.ok) { setMessage(result.error || "Unable to save issue."); return; }
    setMessage(result.duplicate ? "This issue was already recorded; no duplicate was created." : "Issue recorded in the sandbox review queue.");
    setForm((current) => ({ ...blankForm, userRole: current.userRole }));
    await loadIssues();
  };

  const updateStatus = async (id: string, status: Issue["status"]) => {
    const response = await fetch("/api/testing/issues", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok) await loadIssues();
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-[#dce5df] bg-white shadow-sm">
        <div className="border-b border-[#e4ebe6] bg-gradient-to-br from-white to-[#edf5f0] px-6 py-8 sm:px-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#56806d]">Protected staging workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173d31]">Sandbox Testing Center</h1>
              <p className="mt-2 max-w-3xl text-[#60736a]">Walk through Gather’s real application using isolated test accounts and data. No role switching or authorization shortcuts are provided.</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />
              TEST MODE
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.role} className="rounded-2xl border border-[#dce5df] bg-[#fbfcfb] p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[#e4f0e9] p-2.5 text-[#175b47]"><Icon className="h-5 w-5" /></div>
                  <div><h2 className="font-semibold text-[#173d31]">{section.role}</h2><p className="mt-1 text-sm text-[#66786f]">{section.summary}</p></div>
                </div>
                <ul className="mt-5 space-y-2">
                  {section.workflows.map((workflow) => (
                    <li key={workflow.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#e4ebe6] bg-white px-3 py-2.5 text-sm">
                      <span>{workflow.label}</span>
                      {workflow.href ? (
                        <a href={workflow.href} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-[#175b47] px-3 font-semibold text-white hover:bg-[#104737]">Open <ExternalLink className="h-3.5 w-3.5" /></a>
                      ) : (
                        <span title={workflow.note} className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Pending setup</span>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section id="page-directory" className="scroll-mt-16 rounded-3xl border border-[#dce5df] bg-white p-6 shadow-sm sm:p-9">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#e4f0e9] p-2.5 text-[#175b47]">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#56806d]">URL cheat sheet</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#173d31]">Gather page directory</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66786f]">Open every major sandbox area from one place. Pages still enforce the permissions of the account currently signed in.</p>
          </div>
        </div>
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {sandboxPageGroups.map((group) => (
            <article key={group.title} className="rounded-2xl border border-[#dce5df] bg-[#fbfcfb] p-5">
              <h3 className="font-semibold text-[#173d31]">{group.title}</h3>
              <p className="mt-1 text-sm leading-5 text-[#66786f]">{group.description}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {group.links.map((link) => (
                  <a key={`${link.label}-${link.href}`} href={link.href} className="group rounded-xl border border-[#e0e8e3] bg-white px-3 py-3 text-sm transition hover:border-[#9db9aa] hover:shadow-sm">
                    <span className="flex items-center justify-between gap-2 font-semibold text-[#244c3e]">
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#6f8a7c] transition group-hover:text-[#175b47]" />
                    </span>
                    <code className="mt-1 block truncate text-[10px] text-[#718078]">{link.href}</code>
                    {link.note ? <span className="mt-1 block text-[11px] leading-4 text-amber-800">{link.note}</span> : null}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-[#edf5f0] px-4 py-3 text-xs leading-5 text-[#315a49]">This directory is maintained in one sandbox route registry. Add or remove entries there whenever a feature is introduced, renamed, or retired.</p>
      </section>

      <section id="report-issue" className="scroll-mt-16 rounded-3xl border border-[#dce5df] bg-white p-6 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[#175b47]"><Bug className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Testing notes</span></div><h2 className="mt-2 text-2xl font-semibold text-[#173d31]">Report a sandbox issue</h2><p className="mt-1 text-sm text-[#66786f]">Record what you found without changing the application or production data.</p></div>
          <div className="rounded-xl bg-[#edf5f0] px-4 py-3 text-sm text-[#315a49]"><strong>{openCount}</strong> active findings</div>
        </div>
        <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field label="Issue title" wide><input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Short description of the finding" /></Field>
          <Field label="Testing role"><Select value={form.userRole} values={roles} onChange={(value) => setForm({ ...form, userRole: value as Role })} /></Field>
          <Field label="Workflow or area"><input required maxLength={120} value={form.workflowArea} onChange={(e) => setForm({ ...form, workflowArea: e.target.value })} className="input" /></Field>
          <Field label="Type"><Select value={form.issueType} values={issueTypes} onChange={(value) => setForm({ ...form, issueType: value as typeof issueTypes[number] })} /></Field>
          <Field label="Priority"><Select value={form.priority} values={priorities} onChange={(value) => setForm({ ...form, priority: value as typeof priorities[number] })} /></Field>
          <Field label="Description" wide><textarea required maxLength={5000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-y" placeholder="What happened or needs to change?" /></Field>
          <Field label="Expected behavior"><textarea maxLength={3000} rows={3} value={form.expectedBehavior} onChange={(e) => setForm({ ...form, expectedBehavior: e.target.value })} className="input resize-y" /></Field>
          <Field label="Actual behavior"><textarea maxLength={3000} rows={3} value={form.actualBehavior} onChange={(e) => setForm({ ...form, actualBehavior: e.target.value })} className="input resize-y" /></Field>
          <Field label="Page URL" wide><div className="rounded-xl border border-[#dce5df] bg-[#f7f9f8] px-3 py-3 text-sm text-[#66786f]">Captured automatically from the page that opened the testing center.</div></Field>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button disabled={saving} className="min-h-11 rounded-full bg-[#175b47] px-6 font-semibold text-white hover:bg-[#104737] disabled:opacity-60">{saving ? "Saving…" : "Record issue"}</button>
            {message && <p role="status" className="text-sm font-medium text-[#315a49]">{message}</p>}
          </div>
        </form>
        <p className="mt-4 text-xs text-[#718078]">Screenshot attachments are disabled until isolated staging object storage is configured.</p>
      </section>

      <section className="rounded-3xl border border-[#dce5df] bg-white p-6 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[#175b47]"><ClipboardList className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Review queue</span></div><h2 className="mt-2 text-2xl font-semibold text-[#173d31]">Sandbox findings</h2></div><div className="flex flex-wrap gap-2"><Filter value={filters.status} label="All statuses" values={statuses} onChange={(status) => setFilters({ ...filters, status })} /><Filter value={filters.priority} label="All priorities" values={priorities} onChange={(priority) => setFilters({ ...filters, priority })} /><Filter value={filters.role} label="All roles" values={roles} onChange={(role) => setFilters({ ...filters, role })} /></div></div>
        <div className="mt-6 space-y-3">
          {!issues.length && <div className="rounded-2xl border border-dashed border-[#cfdad3] p-8 text-center text-[#66786f]">No findings match these filters.</div>}
          {issues.map((issue) => (
            <article key={issue.id} className="rounded-2xl border border-[#dce5df] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#173d31]">{issue.title}</h3><span className="rounded-full bg-[#edf5f0] px-2.5 py-1 text-xs font-semibold text-[#315a49]">{issue.priority}</span><span className="rounded-full bg-[#f4f4f4] px-2.5 py-1 text-xs">{issue.issueType}</span></div><p className="mt-2 text-sm text-[#66786f]">{issue.userRole} · {issue.workflowArea} · {new Date(issue.createdAt).toLocaleString()}</p></div><select aria-label={`Status for ${issue.title}`} value={issue.status} onChange={(e) => void updateStatus(issue.id, e.target.value as Issue["status"])} className="min-h-10 rounded-xl border border-[#cfdad3] bg-white px-3 text-sm font-semibold">{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#30483e]">{issue.description}</p>
              <a href={issue.pageUrl} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#175b47] hover:underline">Recorded page <ExternalLink className="h-3.5 w-3.5" /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatusCard icon={CheckCircle2} title="Production protected" text="Sandbox controls are server-side and remain hidden in production." />
        <StatusCard icon={BadgeDollarSign} title="Stripe test mode" text="Live keys and live webhook events are rejected by staging guards." />
        <StatusCard icon={HeartHandshake} title="No real fulfillment" text="Travel workflows remain test records until staging resources are connected." />
      </section>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-semibold text-[#30483e]">{label}</span>{children}</label>;
}
function Select({ value, values, onChange }: { value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="input">{values.map((item) => <option key={item}>{item}</option>)}</select>;
}
function Filter({ value, values, label, onChange }: { value: string; values: readonly string[]; label: string; onChange: (value: string) => void }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 rounded-xl border border-[#cfdad3] bg-white px-3 text-sm"><option value="">{label}</option>{values.map((item) => <option key={item}>{item}</option>)}</select>;
}
function StatusCard({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <div className="rounded-2xl border border-[#dce5df] bg-white p-5"><Icon className="h-5 w-5 text-[#175b47]" /><h3 className="mt-3 font-semibold text-[#173d31]">{title}</h3><p className="mt-1 text-sm leading-5 text-[#66786f]">{text}</p></div>;
}
