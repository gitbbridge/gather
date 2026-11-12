export function SandboxIndicator() {
  return (
    <div
      role="status"
      aria-label="Gather sandbox test mode is active"
      className="sticky top-0 z-[100] flex min-h-9 items-center justify-center gap-2 border-b border-red-800 bg-red-950 px-4 py-2 text-center text-xs font-bold tracking-[0.16em] text-white shadow-sm sm:text-sm"
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)] motion-reduce:animate-none"
      />
      TEST MODE — SANDBOX DATA ONLY
      <a
        href="/testing#report-issue"
        className="ml-2 rounded-full border border-white/35 px-3 py-1 tracking-normal hover:bg-white/10 focus-visible:outline-white"
      >
        Report issue
      </a>
    </div>
  );
}
