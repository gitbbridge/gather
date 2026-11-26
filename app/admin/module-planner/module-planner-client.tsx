"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, Archive, BarChart3, Blocks, Check, ChevronDown, Clipboard,
  Clock3, FileCheck2, History, LayoutDashboard, LoaderCircle, Menu, MessageSquare,
  Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, TestTube2, X, ExternalLink, GitCommitHorizontal, GitPullRequest, Link2, LogOut,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { implementationBrief, MODULE_PRIORITIES, MODULE_STATUSES, PROGRESS_STAGES, RISK_LEVELS, TASK_WEIGHTS } from "@/lib/module-planner";

type ModuleRecord = {
  id: string; moduleCode: string; name: string; description: string; purpose: string;
  functionalRequirements: string; acceptanceCriteria: string; status: string; priority: string;
  ownerId?: string | null; ownerName: string; targetRelease?: string | null; riskLevel: string;
  progress: number; approvalState: string; archivedAt?: number | null; createdAt: number; updatedAt: number;
};
type Feature = { id: string; moduleId: string; name: string; description: string; functionalSpecification: string; acceptanceCriteria: string; status: string; approvalState: string; archivedAt?: number | null; createdAt: number; updatedAt: number };
type Comment = { id: string; moduleId: string; authorId: string; authorName: string; body: string; editedAt?: number | null; removedAt?: number | null; createdAt: number };
type Proposal = { id: string; moduleId: string; featureId?: string | null; proposalType: string; fieldName?: string | null; previousValue?: string | null; proposedValue?: string | null; reason: string; status: string; createdByName: string; reviewedByName?: string | null; reviewedAt?: number | null; createdAt: number };
type Dependency = { moduleId: string; dependsOnModuleId: string };
type AuditEvent = { id: string; moduleId: string; featureId?: string | null; actorName: string; action: string; previousValue?: string | null; newValue?: string | null; createdAt: number };
type Goal = { id: string; name: string; description: string; approvedScope: string; completionCriteria: string; targetMilestones: string; baselineVersion: number; approvalState: string; overallCompletion?: number | null; lastAssessmentAt?: number | null; scoringVersion: string; updatedAt: number };
type Task = { id: string; goalId: string; moduleId: string; name: string; weight: number; stage: string; baselineIncluded?: number | boolean; weightApproved?: number | boolean; requirementsEvidence?: string | null; implementationEvidence?: string | null; testsEvidence?: string | null; sandboxEvidence?: string | null; productionEvidence?: string | null; blocker?: string | null; updatedAt: number };
type Snapshot = { id: string; previousPercentage: number; newPercentage: number; totalPoints: number; verifiedPoints: number; createdAt: number; baselineVersion: number };
type SandboxIssue = { id: string; title: string; priority: string; status: string; pageUrl: string; updatedAt: number };
type GithubConnection = { repositoryUrl: string; trackedBranch: string; authMode: string; status: string; latestSha?: string | null; latestMessage?: string | null; latestAuthor?: string | null; latestCommitAt?: number | null; openPullRequests: number; lastSyncedAt?: number | null; lastError?: string | null; rateLimitRemaining?: number | null };
type GithubActivity = { id: string; eventType: string; sha?: string | null; title: string; author: string; url: string; occurredAt: number; changedFiles: string; pullRequestNumber?: number | null; matchedModuleId?: string | null; matchMethod?: string | null; reviewState: string };
type CodeLink = { id: string; moduleId: string; linkType: string; label: string; reference: string; url: string; reviewState: string; archivedAt?: number | null };
type State = {
  modules: ModuleRecord[]; features: Feature[]; comments: Comment[]; proposals: Proposal[];
  dependencies: Dependency[]; auditEvents: AuditEvent[]; projectGoal: Goal | null; tasks: Task[];
  snapshots: Snapshot[]; sandboxIssues: SandboxIssue[]; githubConnection: GithubConnection | null; githubActivities: GithubActivity[]; codeLinks: CodeLink[];
  metrics: { total: number; inProgress: number; needsReview: number; recentlyUpdated: number };
  analyzer: { percentage: number | null; totalPoints: number; verifiedPoints: number; remainingPoints?: number | null; configured: boolean; readiness: { sandbox: number | null; production: number | null }; moduleProgress: Array<{moduleId:string; percentage:number}>; contradictions: Array<{message:string}>; recommendations: Array<{action:string;reason:string}>; blockers: Array<{text:string}>; outstandingCriticalBugs:number; aiAvailable: boolean; scoringVersion: string };
};
type Tab = "modules" | "board" | "decisions" | "github" | "analyzer" | "issues" | "history";
type DialogState =
  | { kind: "module"; module?: ModuleRecord }
  | { kind: "feature"; moduleId: string; feature?: Feature }
  | { kind: "featureProposal"; moduleId: string; feature: Feature }
  | { kind: "dependencies"; module: ModuleRecord }
  | { kind: "proposal"; module: ModuleRecord }
  | { kind: "goal"; goal?: Goal }
  | { kind: "task"; task?: Task }
  | { kind: "codeLink"; moduleId: string }
  | { kind: "activityReview"; activity: GithubActivity }
  | null;

const blankState: State = {
  modules: [], features: [], comments: [], proposals: [], dependencies: [], auditEvents: [], projectGoal: null,
  tasks: [], snapshots: [], sandboxIssues: [], githubConnection: null, githubActivities: [], codeLinks: [], metrics: { total: 0, inProgress: 0, needsReview: 0, recentlyUpdated: 0 },
  analyzer: { percentage: null, totalPoints: 0, verifiedPoints: 0, configured:false, readiness:{sandbox:null,production:null}, moduleProgress:[], contradictions:[], recommendations:[], blockers:[], outstandingCriticalBugs:0, aiAvailable: false, scoringVersion: "gather-evidence-v1" },
};

export default function ModulePlannerClient({ userName }: { userName: string }) {
  const [data, setData] = useState<State>(blankState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("modules");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [sort, setSort] = useState("Recently updated");
  const [selectedId, setSelectedId] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [audits, setAudits] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/admin/module-planner", { cache: "no-store" });
      const result = await response.json() as State & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load Module Planner.");
      setData(result);
      setSelectedId((current) => current || result.modules.find((item) => !item.archivedAt)?.id || "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Module Planner.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  const mutate = async (payload: Record<string, unknown>, success: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/module-planner", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; [key: string]: unknown };
      if (!response.ok) throw new Error(result.error || "Unable to save this change.");
      toast.success(success);
      await load();
      return result;
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to save this change.");
      return null;
    } finally { setSaving(false); }
  };

  const activeModules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = data.modules.filter((module) => !module.archivedAt)
      .filter((module) => status === "All statuses" || module.status === status)
      .filter((module) => !normalized || `${module.moduleCode} ${module.name} ${module.description} ${module.purpose}`.toLowerCase().includes(normalized));
    return [...list].sort((a, b) => sort === "Name" ? a.name.localeCompare(b.name) : sort === "Priority" ? priorityRank(b.priority) - priorityRank(a.priority) : b.updatedAt - a.updatedAt);
  }, [data.modules, query, status, sort]);
  const selected = data.modules.find((module) => module.id === selectedId) || activeModules[0];
  const pending = data.proposals.filter((proposal) => proposal.status === "Pending");

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#173e32]">
      <Toaster richColors />
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#d8e3dc] bg-white p-5 transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between">
            <a href="/" className="text-2xl font-bold tracking-tight text-[#175b47]">gather<span className="text-[#78a68b]">.</span></a>
            <button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
          </div>
          <p className="mt-8 text-[10px] font-bold uppercase tracking-[.17em] text-[#789084]">Product workspace</p>
          <nav className="mt-3 space-y-1">
            <NavButton icon={<Blocks size={16} />} label="Module feed" active={tab === "modules"} onClick={() => setTab("modules")} />
            <NavButton icon={<LayoutDashboard size={16} />} label="Board" active={tab === "board"} onClick={() => setTab("board")} />
            <NavButton icon={<FileCheck2 size={16} />} label="Needs my decision" badge={pending.length} active={tab === "decisions"} onClick={() => setTab("decisions")} />
            <NavButton icon={<GitCommitHorizontal size={16} />} label="GitHub Repository" active={tab === "github"} onClick={() => setTab("github")} />
            <NavButton icon={<BarChart3 size={16} />} label="Project Analyzer" active={tab === "analyzer"} onClick={() => setTab("analyzer")} />
            <NavButton icon={<TestTube2 size={16} />} label="Testing issues" badge={data.sandboxIssues.length} active={tab === "issues"} onClick={() => setTab("issues")} />
            <NavButton icon={<History size={16} />} label="Full history" active={tab === "history"} onClick={() => setTab("history")} />
          </nav>
          <div className="mt-8 border-t border-[#e0e8e3] pt-5 text-xs text-[#657a6f]">
            <p className="font-semibold text-[#173e32]">Signed in as</p><p className="mt-1 truncate">{userName}</p>
            <a href="/testing" className="mt-4 flex items-center gap-2 font-semibold text-[#175b47]"><TestTube2 size={14} /> Testing Center</a>
            <a href="/admin" className="mt-3 flex items-center gap-2 font-semibold text-[#175b47]"><LayoutDashboard size={14} /> Organizer dashboard</a>
            <a href="/auth/signout?return_to=%2F" className="mt-3 flex items-center gap-2 font-semibold text-[#8a4741]"><LogOut size={14} /> Sign out</a>
          </div>
        </aside>
        {mobileNav && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} />}
        <main className="min-w-0 flex-1 px-4 pb-16 sm:px-6 lg:px-8">
          <header className="mx-auto flex h-16 max-w-7xl items-center justify-between border-b border-[#dce5e0]">
            <div className="flex items-center gap-3"><button className="rounded-lg border bg-white p-2 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18} /></button><span className="text-sm text-[#6f8379]">Internal product planning</span></div>
            <span className="rounded-full border border-[#d6e3db] bg-white px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="mr-1 inline" size={13} /> Admin only</span>
          </header>
          <div className="mx-auto max-w-7xl">
            <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#d8e4dd] bg-gradient-to-br from-[#f4faf6] to-[#eaf4ed] p-6 sm:p-8">
              <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#668174]">Gather product system</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{tabTitle(tab)}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e7569]">Structured requirements, protected decisions, development evidence, and permanent product history in one trustworthy workspace.</p></div>
              <button onClick={() => setDialog({ kind: "module" })} className="inline-flex items-center gap-2 rounded-xl bg-[#175b47] px-4 py-3 text-sm font-semibold text-white shadow-sm"><Plus size={16} /> New Module</button>
            </section>

            {error ? <DatabaseError message={error} /> : loading ? <Loading /> : (
              <>
                {tab === "modules" && <ModuleFeed data={data} modules={activeModules} selected={selected} query={query} setQuery={setQuery} status={status} setStatus={setStatus} sort={sort} setSort={setSort} expanded={expanded} setExpanded={setExpanded} audits={audits} setAudits={setAudits} setSelectedId={setSelectedId} setDialog={setDialog} mutate={mutate} saving={saving} />}
                {tab === "board" && <Board modules={data.modules.filter((module) => !module.archivedAt)} onSelect={(id) => { setSelectedId(id); setTab("modules"); }} />}
                {tab === "decisions" && <Decisions proposals={pending} modules={data.modules} mutate={mutate} saving={saving} />}
                {tab === "github" && <GithubRepository data={data} mutate={mutate} saving={saving} setDialog={setDialog} />}
                {tab === "analyzer" && <Analyzer data={data} setDialog={setDialog} mutate={mutate} saving={saving} />}
                {tab === "issues" && <Issues issues={data.sandboxIssues} />}
                {tab === "history" && <HistoryView events={data.auditEvents} modules={data.modules} />}
              </>
            )}
          </div>
        </main>
      </div>
      {dialog && <PlannerDialog dialog={dialog} data={data} saving={saving} close={() => setDialog(null)} submit={async (payload, message) => { const result = await mutate(payload, message); if (result) setDialog(null); }} />}
    </div>
  );
}

function ModuleFeed(props: {
  data: State; modules: ModuleRecord[]; selected?: ModuleRecord; query: string; setQuery: (value: string) => void;
  status: string; setStatus: (value: string) => void; sort: string; setSort: (value: string) => void;
  expanded: Set<string>; setExpanded: (value: Set<string>) => void; audits: Set<string>; setAudits: (value: Set<string>) => void;
  setSelectedId: (id: string) => void; setDialog: (dialog: DialogState) => void;
  mutate: (payload: Record<string, unknown>, success: string) => Promise<Record<string, unknown> | null>; saving: boolean;
}) {
  const { data, modules, selected } = props;
  return <>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Total modules" value={data.metrics.total} icon={<Blocks size={16} />} />
      <Metric label="In progress" value={data.metrics.inProgress} icon={<Activity size={16} />} />
      <Metric label="Needs review" value={data.metrics.needsReview} icon={<AlertTriangle size={16} />} />
      <Metric label="Updated this week" value={data.metrics.recentlyUpdated} icon={<Clock3 size={16} />} />
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Module feed</h2>
      <div className="flex flex-1 flex-wrap justify-end gap-2">
        <label className="relative min-w-[15rem] flex-1 sm:max-w-xs"><Search className="absolute left-3 top-2.5 text-[#7b9085]" size={16} /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search modules and requirements" className="h-10 w-full rounded-xl border border-[#d6e1da] bg-white pl-9 pr-3 text-sm" /></label>
        <select value={props.status} onChange={(event) => props.setStatus(event.target.value)} className="h-10 rounded-xl border border-[#d6e1da] bg-white px-3 text-sm"><option>All statuses</option>{MODULE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={props.sort} onChange={(event) => props.setSort(event.target.value)} className="h-10 rounded-xl border border-[#d6e1da] bg-white px-3 text-sm"><option>Recently updated</option><option>Name</option><option>Priority</option></select>
      </div>
    </div>
    <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="space-y-4">
        {!modules.length && <Empty title="No modules match these filters" text="Create a module or clear the current search and status filters." />}
        {modules.map((module) => {
          const features = data.features.filter((feature) => feature.moduleId === module.id);
          const comments = data.comments.filter((comment) => comment.moduleId === module.id);
          const proposals = data.proposals.filter((proposal) => proposal.moduleId === module.id);
          const events = data.auditEvents.filter((event) => event.moduleId === module.id);
          const dependencies = data.dependencies.filter((edge) => edge.moduleId === module.id).map((edge) => data.modules.find((item) => item.id === edge.dependsOnModuleId)).filter(Boolean) as ModuleRecord[];
          const isExpanded = props.expanded.has(module.id);
          const auditOpen = props.audits.has(module.id);
          return <article key={module.id} onClick={() => props.setSelectedId(module.id)} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${selected?.id === module.id ? "border-[#7da692] ring-1 ring-[#aac3b5]" : "border-[#dae4de] hover:border-[#aac3b5]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#789084]">{module.moduleCode}</p><h3 className="mt-1 text-xl font-semibold tracking-tight">{module.name}</h3></div>
              <StatusBadge status={module.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#687d72]"><span>Owner: <strong className="text-[#284f42]">{module.ownerName}</strong></span><span>•</span><span>{module.priority} priority</span><span>•</span><span>{module.riskLevel} risk</span><ApprovalBadge state={module.approvalState} /></div>
            <p className="mt-4 text-sm leading-6 text-[#587064]">{module.description || module.purpose || "No module description has been recorded yet."}</p>
            <div className="mt-4 flex flex-wrap gap-2">{features.filter((feature) => !feature.archivedAt).slice(0, 8).map((feature) => <span key={feature.id} className="rounded-full border border-[#dce7e0] bg-[#fbfdfc] px-3 py-1 text-[11px] text-[#557064]">{feature.name}</span>)}{features.filter((feature) => !feature.archivedAt).length > 8 && <span className="px-2 py-1 text-[11px] text-[#71877b]">+{features.length - 8} more</span>}</div>
            <div className="mt-5 flex items-center gap-3 text-xs text-[#6b8176]"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e7efea]"><div className="h-full rounded-full bg-[#278060]" style={{ width: `${module.progress}%` }} /></div><strong>{module.progress}%</strong></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e9e5] pt-4">
              <div className="flex flex-wrap gap-2"><SmallButton onClick={() => props.setDialog({ kind: "feature", moduleId: module.id })}><Plus size={13} /> Feature</SmallButton><SmallButton onClick={() => props.setDialog(module.approvalState === "Approved" ? { kind: "proposal", module } : { kind: "module", module })}><Settings2 size={13} /> {module.approvalState === "Approved" ? "Propose change" : "Edit"}</SmallButton><SmallButton onClick={() => copyBrief(module, features, dependencies)}><Clipboard size={13} /> Copy brief</SmallButton></div>
              <button onClick={(event) => { event.stopPropagation(); toggleSet(props.expanded, props.setExpanded, module.id); }} className="flex items-center gap-1 text-xs font-semibold text-[#175b47]">{isExpanded ? "Hide details" : `Discussion (${comments.filter((comment) => !comment.removedAt).length})`} <ChevronDown className={isExpanded ? "rotate-180" : ""} size={14} /></button>
            </div>
            {isExpanded && <div className="mt-5 space-y-5 border-t border-[#e2e9e5] pt-5">
               <Specification module={module} features={features} proposals={proposals} mutate={props.mutate} saving={props.saving} setDialog={props.setDialog} />
              <Discussion moduleId={module.id} comments={comments} mutate={props.mutate} saving={props.saving} />
              <button onClick={() => toggleSet(props.audits, props.setAudits, module.id)} className="flex items-center gap-2 text-xs font-semibold text-[#175b47]"><History size={14} /> {auditOpen ? "Hide" : "View"} audit trail ({events.length})</button>
              {auditOpen && <AuditList events={events} />}
            </div>}
          </article>;
        })}
      </section>
      <aside className="space-y-4 xl:sticky xl:top-5">
         <DetailsPanel module={selected} data={data} mutate={props.mutate} saving={props.saving} setDialog={props.setDialog} />
        <section className="rounded-2xl border border-[#dae4de] bg-white p-5 shadow-sm"><h3 className="font-semibold">Recent activity</h3><div className="mt-4 space-y-4">{data.auditEvents.slice(0, 6).map((event) => <div key={event.id} className="flex gap-3 text-xs"><span className="mt-1 size-2 rounded-full bg-[#4e9274]" /><div><p className="font-semibold text-[#315548]">{readableAction(event.action)}</p><p className="mt-1 text-[#75897e]">{event.actorName} · {formatDate(event.createdAt)}</p></div></div>)}{!data.auditEvents.length && <p className="text-sm text-[#71877b]">Activity will appear as the team works.</p>}</div></section>
      </aside>
    </div>
  </>;
}

function Specification({ module, features, proposals, mutate, saving, setDialog }: { module: ModuleRecord; features: Feature[]; proposals: Proposal[]; mutate: (payload: Record<string, unknown>, success: string) => Promise<unknown>; saving: boolean; setDialog: (dialog: DialogState) => void }) {
  return <div className="grid gap-5 lg:grid-cols-2">
    <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#779084]">Functional requirements</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#587064]">{module.functionalRequirements || "No requirements recorded."}</p></div>
    <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#779084]">Acceptance criteria</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#587064]">{module.acceptanceCriteria || "No acceptance criteria recorded."}</p></div>
    <div className="lg:col-span-2"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#779084]">Feature records</p>{module.approvalState !== "Approved" && <button disabled={saving} onClick={() => mutate({ action: "module.approve", moduleId: module.id }, "Approved baseline protected")} className="text-xs font-semibold text-[#175b47]"><Check size={13} className="mr-1 inline" /> Approve module baseline</button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{features.map((feature) => <div key={feature.id} className={`rounded-xl border p-3 ${feature.archivedAt ? "bg-[#f4f5f4] opacity-70" : "bg-[#fbfdfc]"}`}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{feature.name}</strong><ApprovalBadge state={feature.approvalState} /></div><p className="mt-2 text-xs leading-5 text-[#667d71]">{feature.functionalSpecification || feature.description || "No specification recorded."}</p><div className="mt-3 flex gap-3"><button disabled={saving} onClick={() => setDialog(feature.approvalState === "Approved" ? { kind: "featureProposal", moduleId: module.id, feature } : { kind: "feature", moduleId: module.id, feature })} className="text-[11px] font-semibold text-[#175b47]">{feature.approvalState === "Approved" ? "Propose change" : "Edit"}</button><button disabled={saving} onClick={() => mutate({ action: "feature.archive", featureId: feature.id, restore: Boolean(feature.archivedAt), reason: feature.approvalState === "Approved" ? "Proposed through the Module Planner." : "" }, feature.archivedAt ? "Feature restored" : feature.approvalState === "Approved" ? "Feature removal proposed" : "Feature archived")} className="text-[11px] font-semibold text-[#8b554d]">{feature.archivedAt ? "Restore" : feature.approvalState === "Approved" ? "Propose removal" : "Archive"}</button></div></div>)}{!features.length && <p className="text-sm text-[#71877b]">No feature records yet.</p>}</div></div>
    {proposals.some((proposal) => proposal.status === "Pending") && <div className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>{proposals.filter((proposal) => proposal.status === "Pending").length} proposed change(s)</strong> are awaiting review. Approved content remains unchanged.</div>}
  </div>;
}

function Discussion({ moduleId, comments, mutate, saving }: { moduleId: string; comments: Comment[]; mutate: (payload: Record<string, unknown>, success: string) => Promise<unknown>; saving: boolean }) {
  const [text, setText] = useState("");
  return <div><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} /> Discussion</p><div className="space-y-3">{comments.filter((comment) => !comment.removedAt).map((comment) => <div key={comment.id} className="rounded-xl bg-[#f6f9f7] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{comment.authorName}</strong><time className="text-[11px] text-[#7d9086]">{formatDate(comment.createdAt)}{comment.editedAt ? " · edited" : ""}</time></div><p className="mt-2 whitespace-pre-wrap leading-6 text-[#587064]">{comment.body}</p></div>)}{!comments.filter((comment) => !comment.removedAt).length && <p className="text-sm text-[#71877b]">No discussion yet.</p>}</div><div className="mt-3 flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a recommendation or comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-[#d6e1da] px-3 text-sm" /><button disabled={saving || !text.trim()} onClick={async () => { await mutate({ action: "comment.create", moduleId, text }, "Comment added"); setText(""); }} className="rounded-xl bg-[#175b47] px-4 text-sm font-semibold text-white disabled:opacity-50">Post</button></div></div>;
}

function DetailsPanel({ module, data, mutate, saving, setDialog }: { module?: ModuleRecord; data: State; mutate: (payload: Record<string, unknown>, success: string) => Promise<unknown>; saving: boolean; setDialog: (dialog: DialogState) => void }) {
  const dependencies = module ? data.dependencies.filter((edge) => edge.moduleId === module.id).map((edge) => data.modules.find((item) => item.id === edge.dependsOnModuleId)).filter(Boolean) as ModuleRecord[] : [];
  const sourceLinks = module ? data.codeLinks.filter(link=>link.moduleId===module.id && !link.archivedAt) : [];
  if (!module) return <section className="rounded-2xl border border-[#dae4de] bg-white p-5"><p className="text-sm text-[#71877b]">Select a module to see its details.</p></section>;
  return <section className="rounded-2xl border border-[#dae4de] bg-white p-5 shadow-sm"><h3 className="font-semibold">Module details</h3><div className="mt-4 space-y-3 text-sm"><Detail label="Owner" value={module.ownerName} /><Detail label="Dependencies" value={dependencies.map((item) => item.moduleCode).join(", ") || "None"} /><Detail label="Target release" value={module.targetRelease || "Not assigned"} /><Detail label="Approval" value={module.approvalState} /><Detail label="Risk" value={module.riskLevel} /><Detail label="Last modified" value={formatDate(module.updatedAt)} /></div>{sourceLinks.length>0&&<div className="mt-4 space-y-2">{sourceLinks.map(link=><a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold text-[#175b47]"><Link2 size={13}/>{link.label}</a>)}</div>}<div className="mt-5 grid gap-2"><button onClick={() => setDialog({kind:"codeLink",moduleId:module.id})} className="rounded-xl border border-[#d7e2db] px-3 py-2 text-xs font-semibold text-[#175b47]">Link source code</button><button onClick={() => setDialog({ kind: "dependencies", module })} className="rounded-xl border border-[#d7e2db] px-3 py-2 text-xs font-semibold text-[#175b47]">Manage dependencies</button><a href={`/testing?module=${module.id}`} className="rounded-xl border border-[#d7e2db] px-3 py-2 text-center text-xs font-semibold text-[#175b47]">Open Testing Center</a><button disabled={saving} onClick={() => mutate({ action: "module.archive", moduleId: module.id, restore: false }, "Module archived")} className="rounded-xl border border-[#e1d8d6] px-3 py-2 text-xs font-semibold text-[#8d4943]"><Archive size={13} className="mr-1 inline" /> Archive module</button></div></section>;
}

function Decisions({ proposals, modules, mutate, saving }: { proposals: Proposal[]; modules: ModuleRecord[]; mutate: (payload: Record<string, unknown>, success: string) => Promise<unknown>; saving: boolean }) {
  return <section className="mt-6 space-y-4">{proposals.map((proposal) => <article key={proposal.id} className="rounded-2xl border border-[#dae4de] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#789084]">{modules.find((module) => module.id === proposal.moduleId)?.moduleCode || "Module"}</p><h2 className="mt-1 text-lg font-semibold">{proposal.proposalType === "feature.archive" ? "Feature removal proposal" : `Proposed ${proposal.fieldName || "change"}`}</h2></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Awaiting approval</span></div><p className="mt-4 text-sm leading-6 text-[#587064]">{proposal.reason}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><ValueBox label="Current approved value" value={parseValue(proposal.previousValue)} /><ValueBox label="Proposed value" value={parseValue(proposal.proposedValue)} /></div><p className="mt-3 text-xs text-[#75897e]">Proposed by {proposal.createdByName} · {formatDate(proposal.createdAt)}</p><div className="mt-5 flex gap-2"><button disabled={saving} onClick={() => mutate({ action: "proposal.review", proposalId: proposal.id, decision: "Approved" }, "Change approved and recorded")} className="rounded-xl bg-[#175b47] px-4 py-2 text-sm font-semibold text-white">Approve</button><button disabled={saving} onClick={() => mutate({ action: "proposal.review", proposalId: proposal.id, decision: "Rejected" }, "Change rejected; approved baseline preserved")} className="rounded-xl border border-[#d8e2dc] px-4 py-2 text-sm font-semibold">Reject</button></div></article>)}{!proposals.length && <Empty title="No decisions waiting" text="Approved baselines are protected. New proposals will appear here for explicit review." />}</section>;
}

function Board({ modules, onSelect }: { modules: ModuleRecord[]; onSelect: (id: string) => void }) {
  return <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{["Planned", "In progress", "Needs review", "Completed"].map((column) => <section key={column} className="rounded-2xl border border-[#dae4de] bg-[#eef4f0] p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{column}</h2><span className="rounded-full bg-white px-2 py-1 text-xs">{modules.filter((module) => module.status === column).length}</span></div><div className="mt-4 space-y-3">{modules.filter((module) => module.status === column).map((module) => <button key={module.id} onClick={() => onSelect(module.id)} className="w-full rounded-xl border border-[#d8e3dc] bg-white p-4 text-left shadow-sm"><span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8f84]">{module.moduleCode}</span><strong className="mt-1 block text-sm">{module.name}</strong><span className="mt-3 block text-xs text-[#6c8176]">{module.progress}% complete</span></button>)}</div></section>)}</div>;
}

function GithubRepository({ data, mutate, saving, setDialog }: { data: State; mutate: (payload: Record<string, unknown>, success: string) => Promise<unknown>; saving: boolean; setDialog: (dialog: DialogState) => void }) {
  const connection = data.githubConnection;
  return <div className="mt-6 space-y-5">
    <section className="rounded-2xl border border-[#dae4de] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#789084]">Official source repository</p><h2 className="mt-1 text-2xl font-semibold">gitbbridge/gather</h2><p className="mt-2 text-sm text-[#60776c]">Read-only repository activity. No GitHub write permission is requested or used.</p></div><button disabled={saving} onClick={() => mutate({ action:"github.sync", trackedBranch: connection?.trackedBranch || "main" }, "GitHub activity synchronized")} className="inline-flex items-center gap-2 rounded-xl bg-[#175b47] px-4 py-2.5 text-sm font-semibold text-white"><RefreshCw className={saving ? "animate-spin" : ""} size={15}/>Sync now</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><MetricLine label="Status" value={connection?.status || "Not synchronized"}/><MetricLine label="Tracked branch" value={connection?.trackedBranch || "main"}/><MetricLine label="Open pull requests" value={connection?.openPullRequests ?? 0}/><MetricLine label="Last sync" value={connection?.lastSyncedAt ? formatDate(connection.lastSyncedAt) : "Never"}/></div>
    {connection?.lastError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{connection.lastError}</p>}<a href={connection?.repositoryUrl || "https://github.com/gitbbridge/gather"} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#175b47]">Open repository <ExternalLink size={14}/></a></section>
    <section className="rounded-2xl border border-[#dae4de] bg-white p-6"><h2 className="font-semibold">Commits and pull requests</h2><p className="mt-1 text-sm text-[#657a6f]">Only exact task identifiers such as GR-008 create suggestions. Every suggestion still requires administrator review.</p><div className="mt-4 divide-y divide-[#e3eae6]">{data.githubActivities.map((activity) => <div key={activity.id} className="py-4"><div className="flex items-start gap-3">{activity.eventType === "commit" ? <GitCommitHorizontal size={17}/> : <GitPullRequest size={17}/>}<div className="min-w-0 flex-1"><a href={activity.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{activity.title}</a><p className="mt-1 text-xs text-[#75897e]">{activity.author} · {formatDate(activity.occurredAt)}{activity.sha ? ` · ${activity.sha.slice(0,7)}` : ""}</p>{parseJsonList(activity.changedFiles).length > 0 && <details className="mt-2 text-xs text-[#587064]"><summary className="cursor-pointer font-semibold">Changed files ({parseJsonList(activity.changedFiles).length})</summary><ul className="mt-2 space-y-1">{parseJsonList(activity.changedFiles).map((file) => <li key={file}>{file}</li>)}</ul></details>}</div><div className="text-right"><StatusBadge status={activity.reviewState}/>{activity.reviewState === "Suggested" && <button onClick={() => setDialog({kind:"activityReview",activity})} className="mt-2 block text-xs font-semibold text-[#175b47]">Review match</button>}</div></div></div>)}{!data.githubActivities.length && <p className="py-8 text-center text-sm text-[#71877b]">Sync GitHub to load repository activity.</p>}</div></section>
  </div>;
}

function Analyzer({ data, setDialog, mutate, saving }: { data: State; setDialog: (dialog: DialogState) => void; mutate: (payload: Record<string, unknown>, success: string) => Promise<Record<string, unknown> | null>; saving: boolean }) {
  const percent = data.analyzer.percentage;
  return <div className="mt-6 space-y-5">
    {!data.projectGoal ? <section className="rounded-2xl border border-[#dae4de] bg-white p-7 text-center"><Sparkles className="mx-auto text-[#175b47]" /><h2 className="mt-4 text-xl font-semibold">Create the project baseline</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#60776c]">The initial goal remains a draft until you review and approve its scope. The planner will not invent missing requirements.</p><button onClick={() => setDialog({ kind: "goal" })} className="mt-5 rounded-xl bg-[#175b47] px-4 py-2.5 text-sm font-semibold text-white">Create project goal</button></section> : <>
      <section className="rounded-2xl border border-[#dae4de] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#789084]">Baseline v{data.projectGoal.baselineVersion} · {data.projectGoal.approvalState}</p><h2 className="mt-1 text-2xl font-semibold">Gather Project Completion</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#60776c]">{data.projectGoal.description}</p></div><div className="flex gap-2"><button onClick={() => setDialog({kind:"goal",goal:data.projectGoal ?? undefined})} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Edit baseline</button><button disabled={saving} onClick={() => mutate({ action: "analyzer.refresh" }, "Project progress refreshed from verified evidence")} className="inline-flex items-center gap-2 rounded-xl bg-[#175b47] px-4 py-2.5 text-sm font-semibold text-white"><RefreshCw className={saving ? "animate-spin" : ""} size={15} /> Refresh Project Progress</button></div></div><div className="mt-7 flex items-end justify-between"><span className="text-sm font-semibold">Overall verified completion</span><strong className="text-4xl">{percent == null ? "Not configured" : `${percent}%`}</strong></div>{percent != null && <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#e4eee8]"><div className="h-full rounded-full bg-gradient-to-r from-[#175b47] to-[#51a37d]" style={{ width: `${percent}%` }} /></div>}<div className="mt-4 grid gap-3 text-sm sm:grid-cols-5"><MetricLine label="Total points" value={data.analyzer.totalPoints} /><MetricLine label="Earned" value={Math.round(data.analyzer.verifiedPoints * 100) / 100} /><MetricLine label="Remaining" value={data.analyzer.remainingPoints ?? "—"}/><MetricLine label="Sandbox readiness" value={data.analyzer.readiness.sandbox == null ? "—" : `${data.analyzer.readiness.sandbox}%`}/><MetricLine label="Production readiness" value={data.analyzer.readiness.production == null ? "—" : `${data.analyzer.readiness.production}%`}/></div><div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Deterministic analyzer active.</strong> No approved AI integration is configured; recommendations and scoring use verified planner, Testing Center, and GitHub evidence only.</div></section>
      <section className="rounded-2xl border border-[#dae4de] bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Approved baseline work</h2><button onClick={() => setDialog({ kind: "task" })} className="text-sm font-semibold text-[#175b47]"><Plus size={14} className="mr-1 inline" /> Add task</button></div><div className="mt-4 space-y-3">{data.tasks.map((task) => <button onClick={() => setDialog({kind:"task",task})} key={task.id} className="w-full rounded-xl border border-[#dce6e0] p-4 text-left"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">{task.name}</strong><p className="mt-1 text-xs text-[#74887d]">{data.modules.find((module) => module.id === task.moduleId)?.name || "Module"} · weight {task.weight} · {task.weightApproved ? "weight approved" : "weight pending"}</p></div><span className="rounded-full bg-[#eaf3ee] px-3 py-1 text-xs font-semibold text-[#176048]">{task.stage}</span></div>{task.blocker && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800"><AlertTriangle size={12} className="mr-1 inline" /> {task.blocker}</p>}</button>)}{!data.tasks.length && <p className="text-sm text-[#71877b]">No measurable tasks have been configured yet.</p>}</div></section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-[#dae4de] bg-white p-6"><h2 className="font-semibold">Progress history</h2><div className="mt-4 space-y-3">{data.snapshots.slice(0, 8).map((snapshot) => <div key={snapshot.id} className="flex items-center justify-between border-b border-[#e5ebe7] pb-3 text-sm"><span>{formatDate(snapshot.createdAt)}</span><strong>{snapshot.previousPercentage / 100}% → {snapshot.newPercentage / 100}%</strong></div>)}{!data.snapshots.length && <p className="text-sm text-[#71877b]">Refresh progress to create the first permanent snapshot.</p>}</div></div><div className="rounded-2xl border border-[#dae4de] bg-white p-6"><h2 className="font-semibold">Recommended next actions</h2><ol className="mt-4 space-y-3 text-sm text-[#587064]">{data.analyzer.recommendations.map((item,index)=><li key={index}>{index+1}. <strong>{item.action}</strong><br/><span className="text-xs">{item.reason}</span></li>)}{!data.analyzer.recommendations.length && <li>No evidence-based recommendations yet.</li>}</ol></div></section>
      {data.analyzer.contradictions.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-950">Needs Attention</h2><ul className="mt-3 space-y-2 text-sm text-amber-900">{data.analyzer.contradictions.map((item,index)=><li key={index}>• {item.message}</li>)}</ul></section>}
    </>}
  </div>;
}

function Issues({ issues }: { issues: SandboxIssue[] }) { return <section className="mt-6 rounded-2xl border border-[#dae4de] bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Linked Testing Center issues</h2><p className="mt-1 text-sm text-[#657a6f]">The Testing Center remains the source of truth; the planner references its findings.</p></div><a href="/testing" className="rounded-xl border border-[#d5e0d9] px-4 py-2 text-sm font-semibold text-[#175b47]">Open Testing Center</a></div><div className="mt-5 divide-y divide-[#e3eae6]">{issues.map((issue) => <a href={issue.pageUrl} key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">{issue.title}</strong><p className="mt-1 text-xs text-[#75897e]">{issue.priority} priority · updated {formatDate(issue.updatedAt)}</p></div><StatusBadge status={issue.status} /></a>)}{!issues.length && <p className="py-8 text-center text-sm text-[#71877b]">No open sandbox findings.</p>}</div></section>; }

function HistoryView({ events, modules }: { events: AuditEvent[]; modules: ModuleRecord[] }) { const [filter, setFilter] = useState(""); const shown = events.filter((event) => !filter || event.action.includes(filter)); return <section className="mt-6 rounded-2xl border border-[#dae4de] bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Permanent activity history</h2><p className="mt-1 text-sm text-[#657a6f]">Append-only changes across modules, features, decisions, dependencies, and discussions.</p></div><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter actions" className="h-10 rounded-xl border border-[#d6e1da] px-3 text-sm" /></div><div className="mt-5"><AuditList events={shown.map((event) => ({ ...event, action: `${modules.find((module) => module.id === event.moduleId)?.moduleCode || "Module"} · ${event.action}` }))} /></div></section>; }

function PlannerDialog({ dialog, data, saving, close, submit }: { dialog: NonNullable<DialogState>; data: State; saving: boolean; close: () => void; submit: (payload: Record<string, unknown>, message: string) => Promise<void> }) {
  const selectedModule = dialog.kind === "module" ? dialog.module : undefined;
  const selectedFeature = dialog.kind === "feature" ? dialog.feature : undefined;
  const [form, setForm] = useState<Record<string, string | number | boolean | null | undefined>>(() => selectedModule ? { ...selectedModule } : selectedFeature ? { ...selectedFeature } : dialog.kind === "featureProposal" ? { fieldName: "functionalSpecification", proposedValue: dialog.feature.functionalSpecification } : dialog.kind === "goal" && dialog.goal ? { ...dialog.goal, approvedScope: parseJsonList(dialog.goal.approvedScope).join(","), completionCriteria: parseJsonList(dialog.goal.completionCriteria).join("\n"), targetMilestones: parseJsonList(dialog.goal.targetMilestones).join("\n") } : dialog.kind === "task" ? dialog.task ? { ...dialog.task } : { moduleId: data.modules[0]?.id || "", weight: 3, stage: "Not started", baselineIncluded:true, approveWeight:false } : dialog.kind === "activityReview" ? { moduleId: dialog.activity.matchedModuleId || "", decision:"Confirmed", reason:"Verified by platform administrator." } : dialog.kind === "codeLink" ? { linkType:"directory" } : dialog.kind === "dependencies" ? { dependencyIds: data.dependencies.filter((edge) => edge.moduleId === dialog.module.id).map((edge) => edge.dependsOnModuleId).join(",") } : {});
  const update = (name: string, value: string | number | boolean) => setForm((current) => ({ ...current, [name]: value }));
  const save = async () => {
    if (dialog.kind === "module") await submit(selectedModule ? { action: "module.update", moduleId: selectedModule.id, changes: form } : { action: "module.create", ...form }, selectedModule ? "Module updated" : "Module created");
    if (dialog.kind === "feature") await submit(selectedFeature ? { action: "feature.update", featureId: selectedFeature.id, changes: form } : { action: "feature.create", moduleId: dialog.moduleId, ...form }, selectedFeature ? "Feature updated" : "Feature added");
    if (dialog.kind === "featureProposal") await submit({ action: "proposal.create", moduleId: dialog.moduleId, featureId: dialog.feature.id, proposalType: "feature.field", fieldName: form.fieldName, proposedValue: form.proposedValue, reason: form.reason }, "Feature change proposed");
    if (dialog.kind === "dependencies") await submit({ action: "dependencies.set", moduleId: dialog.module.id, dependencyIds: String(form.dependencyIds || "").split(",").filter(Boolean) }, "Dependencies updated");
    if (dialog.kind === "proposal") await submit({ action: "proposal.create", moduleId: dialog.module.id, proposalType: "module.field", fieldName: form.fieldName, proposedValue: form.proposedValue, reason: form.reason }, "Proposed change submitted");
    if (dialog.kind === "goal") await submit({ action: "goal.save", id:dialog.goal?.id, name: form.name || "Production-ready Gather platform", description: form.description || "", approvedScope: String(form.approvedScope || "").split(",").filter(Boolean), completionCriteria: lines(String(form.completionCriteria || "")), targetMilestones: lines(String(form.targetMilestones || "")), approve: Boolean(form.approve) }, Boolean(form.approve) ? "Project baseline approved" : "Draft project goal saved");
    if (dialog.kind === "task" && data.projectGoal) await submit({ action: "task.save", id:dialog.task?.id, goalId: data.projectGoal.id, moduleId: form.moduleId, name: form.name, weight: Number(form.weight || 3), stage: form.stage || "Not started", baselineIncluded:Boolean(form.baselineIncluded), approveWeight:Boolean(form.approveWeight), requirementsEvidence: form.requirementsEvidence || null, implementationEvidence: form.implementationEvidence || null, testsEvidence: form.testsEvidence || null, sandboxEvidence: form.sandboxEvidence || null, productionEvidence: form.productionEvidence || null, blocker: form.blocker || null }, "Analyzer task saved");
    if (dialog.kind === "codeLink") await submit({action:"codeLink.create",moduleId:dialog.moduleId,linkType:form.linkType,label:form.label,reference:form.reference},"Source code linked");
    if (dialog.kind === "activityReview") await submit({action:"github.activity.review",activityId:dialog.activity.id,moduleId:form.moduleId || null,decision:form.decision,reason:form.reason},"GitHub association reviewed");
  };
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#0c211a]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#789084]">Gather Module Planner</p><h2 className="mt-1 text-2xl font-semibold">{dialogTitle(dialog)}</h2></div><button onClick={close} aria-label="Close"><X size={20} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">
    {dialog.kind === "module" && <><Field label="Module ID"><input value={String(form.moduleCode || "")} onChange={(e) => update("moduleCode", e.target.value)} disabled={Boolean(selectedModule)} placeholder="GR-001" /></Field><Field label="Module name"><input value={String(form.name || "")} onChange={(e) => update("name", e.target.value)} /></Field><Field wide label="Description"><textarea value={String(form.description || "")} onChange={(e) => update("description", e.target.value)} /></Field><Field wide label="Purpose"><textarea value={String(form.purpose || "")} onChange={(e) => update("purpose", e.target.value)} /></Field><Field wide label="Functional requirements"><textarea className="min-h-32" value={String(form.functionalRequirements || "")} onChange={(e) => update("functionalRequirements", e.target.value)} /></Field><Field wide label="Acceptance criteria"><textarea className="min-h-32" value={String(form.acceptanceCriteria || "")} onChange={(e) => update("acceptanceCriteria", e.target.value)} /></Field><Field label="Status"><select value={String(form.status || "Planned")} onChange={(e) => update("status", e.target.value)}>{MODULE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Priority"><select value={String(form.priority || "Medium")} onChange={(e) => update("priority", e.target.value)}>{MODULE_PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Owner"><input value={String(form.ownerName || "Unassigned")} onChange={(e) => update("ownerName", e.target.value)} /></Field><Field label="Target release"><input value={String(form.targetRelease || "")} onChange={(e) => update("targetRelease", e.target.value)} /></Field><Field label="Risk"><select value={String(form.riskLevel || "Medium")} onChange={(e) => update("riskLevel", e.target.value)}>{RISK_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Development progress"><input type="number" min="0" max="100" value={Number(form.progress || 0)} onChange={(e) => update("progress", Number(e.target.value))} /></Field></>}
    {dialog.kind === "feature" && <><Field wide label="Feature name"><input value={String(form.name || "")} onChange={(e) => update("name", e.target.value)} /></Field><Field wide label="Description"><textarea value={String(form.description || "")} onChange={(e) => update("description", e.target.value)} /></Field><Field wide label="Functional specification"><textarea className="min-h-32" value={String(form.functionalSpecification || "")} onChange={(e) => update("functionalSpecification", e.target.value)} /></Field><Field wide label="Acceptance criteria"><textarea value={String(form.acceptanceCriteria || "")} onChange={(e) => update("acceptanceCriteria", e.target.value)} /></Field><Field label="Status"><select value={String(form.status || "Planned")} onChange={(e) => update("status", e.target.value)}>{MODULE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field></>}
    {dialog.kind === "featureProposal" && <><Field label="Protected field"><select value={String(form.fieldName || "functionalSpecification")} onChange={(e) => update("fieldName", e.target.value)}><option value="name">Feature name</option><option value="description">Description</option><option value="functionalSpecification">Functional specification</option><option value="acceptanceCriteria">Acceptance criteria</option><option value="status">Status</option></select></Field><Field wide label="Proposed replacement"><textarea className="min-h-36" value={String(form.proposedValue || "")} onChange={(e) => update("proposedValue", e.target.value)} /></Field><Field wide label="Reason"><textarea value={String(form.reason || "")} onChange={(e) => update("reason", e.target.value)} /></Field></>}
    {dialog.kind === "dependencies" && <div className="sm:col-span-2 space-y-2">{data.modules.filter((item) => item.id !== dialog.module.id && !item.archivedAt).map((item) => { const ids = String(form.dependencyIds || "").split(",").filter(Boolean); return <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[#d9e3dd] p-3 text-sm"><input type="checkbox" checked={ids.includes(item.id)} onChange={(event) => update("dependencyIds", event.target.checked ? [...ids, item.id].join(",") : ids.filter((id) => id !== item.id).join(","))} /><span><strong>{item.moduleCode}</strong> · {item.name}</span></label>; })}{data.modules.filter((item) => item.id !== dialog.module.id && !item.archivedAt).length === 0 && <p className="text-sm text-[#71877b]">Create another module before adding dependencies.</p>}</div>}
    {dialog.kind === "proposal" && <><Field label="Protected field"><select value={String(form.fieldName || "functionalRequirements")} onChange={(e) => update("fieldName", e.target.value)}><option value="functionalRequirements">Functional requirements</option><option value="acceptanceCriteria">Acceptance criteria</option><option value="purpose">Purpose</option><option value="description">Description</option><option value="name">Module name</option></select></Field><Field wide label="Proposed replacement"><textarea className="min-h-36" value={String(form.proposedValue || "")} onChange={(e) => update("proposedValue", e.target.value)} /></Field><Field wide label="Reason"><textarea value={String(form.reason || "")} onChange={(e) => update("reason", e.target.value)} /></Field></>}
    {dialog.kind === "goal" && <><Field wide label="Goal name"><input value={String(form.name || "Production-ready Gather platform")} onChange={(e) => update("name", e.target.value)} /></Field><Field wide label="Description"><textarea value={String(form.description || "")} onChange={(e) => update("description", e.target.value)} /></Field><div className="sm:col-span-2"><p className="text-sm font-medium">Modules included in approved baseline</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{data.modules.filter(m=>!m.archivedAt).map(module=>{const ids=String(form.approvedScope||"").split(",").filter(Boolean);return <label key={module.id} className="rounded-lg border p-2 text-sm"><input type="checkbox" className="mr-2" checked={ids.includes(module.id)} onChange={e=>update("approvedScope",e.target.checked?[...ids,module.id].join(","):ids.filter(id=>id!==module.id).join(","))}/>{module.moduleCode} · {module.name}</label>})}</div></div><Field wide label="Completion criteria (one per line)"><textarea value={String(form.completionCriteria || "")} onChange={(e) => update("completionCriteria", e.target.value)} /></Field><Field wide label="Target milestones (one per line)"><textarea value={String(form.targetMilestones || "")} onChange={(e) => update("targetMilestones", e.target.value)} /></Field><label className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" className="mr-2" checked={Boolean(form.approve)} onChange={e=>setForm(current=>({...current,approve:e.target.checked}))}/>Approve as a new immutable scoring baseline</label></>}
    {dialog.kind === "task" && <><Field wide label="Task name"><input value={String(form.name || "")} onChange={(e) => update("name", e.target.value)} /></Field><Field label="Module"><select value={String(form.moduleId || data.modules[0]?.id || "")} onChange={(e) => update("moduleId", e.target.value)}><option value="">Select module</option>{data.modules.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.moduleCode} · {item.name}</option>)}</select></Field><Field label="Complexity weight"><select value={Number(form.weight || 3)} onChange={(e) => update("weight", Number(e.target.value))}>{TASK_WEIGHTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field><Field label="Claimed stage"><select value={String(form.stage || "Not started")} onChange={(e) => update("stage", e.target.value)}>{Object.keys(PROGRESS_STAGES).map((item) => <option key={item}>{item}</option>)}</select></Field><div className="space-y-2"><label className="block text-sm"><input type="checkbox" className="mr-2" checked={Boolean(form.baselineIncluded)} onChange={e=>setForm(c=>({...c,baselineIncluded:e.target.checked}))}/>Include in current baseline</label><label className="block text-sm"><input type="checkbox" className="mr-2" checked={Boolean(form.approveWeight)} onChange={e=>setForm(c=>({...c,approveWeight:e.target.checked}))}/>Approve and lock this weight</label></div>{["requirementsEvidence", "implementationEvidence", "testsEvidence", "sandboxEvidence", "productionEvidence"].map((key) => <Field key={key} wide label={humanize(key)}><textarea value={String(form[key] || "")} onChange={(e) => update(key, e.target.value)} placeholder="Commit, test, URL, finding, or dated verification record" /></Field>)}<Field wide label="Known blocker"><textarea value={String(form.blocker || "")} onChange={(e) => update("blocker", e.target.value)} /></Field></>}
    {dialog.kind === "codeLink" && <><Field label="Link type"><select value={String(form.linkType||"directory")} onChange={e=>update("linkType",e.target.value)}>{["file","directory","commit","pull_request","issue","branch","release"].map(type=><option key={type}>{type}</option>)}</select></Field><Field label="Label"><input value={String(form.label||"")} onChange={e=>update("label",e.target.value)}/></Field><Field wide label="GitHub reference"><input value={String(form.reference||"")} onChange={e=>update("reference",e.target.value)} placeholder="app/admin/module-planner or commit SHA"/></Field></>}
    {dialog.kind === "activityReview" && <><Field label="Decision"><select value={String(form.decision||"Confirmed")} onChange={e=>update("decision",e.target.value)}><option>Confirmed</option><option>Rejected</option></select></Field><Field label="Related module"><select value={String(form.moduleId||"")} onChange={e=>update("moduleId",e.target.value)}><option value="">Select module</option>{data.modules.filter(m=>!m.archivedAt).map(m=><option key={m.id} value={m.id}>{m.moduleCode} · {m.name}</option>)}</select></Field><Field wide label="Review reason"><textarea value={String(form.reason||"")} onChange={e=>update("reason",e.target.value)}/></Field></>}
  </div><div className="mt-6 flex justify-end gap-2"><button onClick={close} className="rounded-xl border border-[#d6e1da] px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-[#175b47] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle className="animate-spin" size={15} />} Save</button></div></section></div>;
}

function NavButton({ icon, label, active, badge, onClick }: { icon: ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${active ? "bg-[#e8f2ec] text-[#175b47]" : "text-[#547064] hover:bg-[#f4f7f5]"}`}>{icon}<span className="flex-1">{label}</span>{Boolean(badge) && <span className="rounded-full bg-[#175b47] px-2 py-0.5 text-[10px] text-white">{badge}</span>}</button>; }
function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-2xl border border-[#dae4de] bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs text-[#6c8176]"><span>{label}</span>{icon}</div><strong className="mt-2 block text-3xl">{value}</strong></div>; }
function MetricLine({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-xl bg-[#f4f8f6] p-3"><span className="block text-xs text-[#71857a]">{label}</span><strong className="mt-1 block">{value}</strong></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 border-b border-[#e4eae7] pb-2"><span className="text-[#71857a]">{label}</span><strong className="text-right text-[#315447]">{value}</strong></div>; }
function ValueBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f5f8f6] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#788d82]">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value || "Not recorded"}</p></div>; }
function StatusBadge({ status }: { status: string }) { const tone = status === "Completed" || status === "Approved" || status === "Resolved" ? "bg-emerald-100 text-emerald-800" : status === "Blocked" || status === "Critical" ? "bg-red-100 text-red-800" : status === "Needs review" || status === "Open" || status === "In Review" ? "bg-amber-100 text-amber-800" : "bg-[#eaf3ee] text-[#176048]"; return <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone}`}>{status}</span>; }
function ApprovalBadge({ state }: { state: string }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${state === "Approved" ? "bg-violet-100 text-violet-800" : state === "Pending" ? "bg-amber-100 text-amber-800" : "bg-[#eef2ef] text-[#667b70]"}`}>{state}</span>; }
function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={(event) => { event.stopPropagation(); onClick(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9e3dd] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#175b47] hover:bg-[#f1f6f3]">{children}</button>; }
function AuditList({ events }: { events: AuditEvent[] }) { return <div className="space-y-2">{events.map((event) => <div key={event.id} className="flex gap-3 rounded-xl bg-[#f6f9f7] p-3 text-xs"><History className="mt-0.5 shrink-0 text-[#5b806f]" size={14} /><div><strong>{readableAction(event.action)}</strong><p className="mt-1 text-[#75897e]">{event.actorName} · {formatDate(event.createdAt)}</p></div></div>)}{!events.length && <p className="text-sm text-[#71877b]">No history recorded.</p>}</div>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactElement }) { return <label className={`block text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="mt-2 block [&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:bg-white [&>select]:px-3 [&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:p-3">{children}</span></label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-[#cbdad1] bg-white p-10 text-center"><Blocks className="mx-auto text-[#6f9381]" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm text-[#71877b]">{text}</p></div>; }
function Loading() { return <div className="grid min-h-[22rem] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#175b47]" /><p className="mt-3 text-sm text-[#6d8277]">Loading the product record…</p></div></div>; }
function DatabaseError({ message }: { message: string }) { return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><AlertTriangle /><h2 className="mt-3 font-semibold">Module Planner setup required</h2><p className="mt-2 text-sm">{message}</p><p className="mt-3 text-sm">Apply the new D1 migration to this environment, then refresh.</p></div>; }

function tabTitle(tab: Tab) { return ({ modules: "Gather Module Planner", board: "Development board", decisions: "Needs my decision", github:"GitHub Repository", analyzer: "Project Analyzer", issues: "Sandbox findings", history: "Activity and audit trail" })[tab]; }
function dialogTitle(dialog: NonNullable<DialogState>) { if (dialog.kind === "module") return dialog.module ? "Edit module" : "Create module"; if (dialog.kind === "feature") return dialog.feature ? "Edit feature" : "Add feature"; if (dialog.kind === "featureProposal") return "Propose a feature change"; if (dialog.kind === "dependencies") return "Manage dependencies"; if (dialog.kind === "proposal") return "Propose a protected change"; if (dialog.kind === "goal") return dialog.goal ? "Edit project baseline" : "Create project goal"; if(dialog.kind==="codeLink")return "Link module to source code";if(dialog.kind==="activityReview")return "Review GitHub association"; return dialog.task ? "Edit measurable task" : "Add measurable task"; }
function priorityRank(priority: string) { return ({ Low: 1, Medium: 2, High: 3, Critical: 4 } as Record<string, number>)[priority] || 0; }
function formatDate(value: number) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function readableAction(action: string) { return action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function parseValue(value?: string | null) { if (!value) return ""; try { const parsed = JSON.parse(value); return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2); } catch { return value; } }
function toggleSet(current: Set<string>, setter: (value: Set<string>) => void, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); setter(next); }
function lines(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
function parseJsonList(value?: string | null) { if(!value)return [];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):[]}catch{return []} }
async function copyBrief(module: ModuleRecord, features: Feature[], dependencies: ModuleRecord[]) { const text = implementationBrief({ ...module, features, dependencies, blockers: [] }); await navigator.clipboard.writeText(text); toast.success("Approved implementation brief copied"); }
