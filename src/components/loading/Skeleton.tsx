// A · Skeleton screens. Grey shapes of the real layout while a page's data loads,
// so the page looks ready at once and nothing jumps when the data arrives.
// Each page skeleton mirrors that page's own spacing and grid.

export function Bone({ className = '' }: { className?: string }) {
  return <div className={`of-bone ${className}`} aria-hidden="true" />;
}

function Status({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Same height and padding as the pages' sticky top bar. */
export function TopBarSkeleton() {
  return (
    <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border" aria-hidden="true">
      <div className="flex items-center justify-end h-14 gap-2 pl-14 pr-4 md:px-6">
        <Bone className="w-9 h-9 rounded-lg" />
        <Bone className="w-9 h-9 rounded-full" />
      </div>
    </div>
  );
}

function Heading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Bone className={`h-7 ${wide ? 'w-56' : 'w-40'}`} />
      <Bone className="h-4 w-64 max-w-full" />
    </div>
  );
}

/** One order-style card: badges, ID line, details line, and a row of buttons. */
export function CardBone({ actions = true }: { actions?: boolean }) {
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-3.5 space-y-2.5" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Bone className="h-4 w-16" />
          <Bone className="h-4 w-24" />
        </div>
        <Bone className="h-5 w-14" />
      </div>
      <Bone className="h-4 w-3/4" />
      <Bone className="h-3 w-1/2" />
      {actions && (
        <div className="grid grid-cols-[1fr_1fr_56px] gap-2 pt-1">
          <Bone className="h-8" />
          <Bone className="h-8" />
          <Bone className="h-8" />
        </div>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 3, actions = false, label = 'Loading' }: { rows?: number; actions?: boolean; label?: string }) {
  return (
    <Status label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <CardBone key={i} actions={actions} />
      ))}
    </Status>
  );
}

function Tiles({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-dashboard-border bg-dashboard-card p-4 space-y-2">
          <Bone className="h-3 w-16" />
          <Bone className="h-6 w-20" />
          <Bone className="h-2.5 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** Orders Dashboard: heading, 6 summary tiles, toolbar, order cards. */
export function DashboardSkeleton() {
  return (
    <Status label="Loading your orders" className="min-h-screen">
      <TopBarSkeleton />
      <div className="px-4 md:px-6 pt-5 space-y-4">
        <Heading wide />
        <Tiles count={6} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" />
        <div className="flex gap-2">
          <Bone className="h-10 flex-1" />
          <Bone className="h-10 w-24" />
        </div>
      </div>
      <div className="px-4 md:px-6 pb-8 pt-4 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <CardBone key={i} />
        ))}
      </div>
    </Status>
  );
}

/** Follow-ups: heading, money summary, view switches, search, order cards. */
export function FollowUpsSkeleton() {
  return (
    <Status label="Loading follow-ups" className="min-h-screen">
      <TopBarSkeleton />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-5 pb-16 space-y-4">
        <Heading />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Bone className="h-[88px]" />
          <Bone className="h-[88px]" />
          <Bone className="col-span-2 lg:col-span-1 h-12 lg:h-[88px]" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Bone className="h-11 sm:flex-1" />
          <Bone className="h-11 sm:w-72" />
        </div>
        <Bone className="h-10" />
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <CardBone key={i} />
          ))}
        </div>
      </div>
    </Status>
  );
}

/** Archive: heading, 4 stat tiles, search, paid order rows. */
export function ArchiveSkeleton() {
  return (
    <Status label="Loading archive" className="min-h-screen">
      <TopBarSkeleton />
      <div className="px-4 md:px-6 pt-5 space-y-4">
        <Heading />
        <Tiles count={4} className="grid grid-cols-2 md:grid-cols-4 gap-3" />
        <Bone className="h-10" />
      </div>
      <div className="px-4 md:px-6 pb-8 pt-4 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <CardBone key={i} actions={false} />
        ))}
      </div>
    </Status>
  );
}

/** Analytics: banner, 4 stat cards, two chart panels. */
export function AnalyticsSkeleton() {
  return (
    <Status label="Loading analytics" className="min-h-screen">
      <TopBarSkeleton />
      <div className="px-4 md:px-6 py-5 space-y-6">
        <Bone className="h-28 rounded-2xl" />
        <Tiles count={4} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Bone className="h-72" />
          <Bone className="h-72" />
        </div>
      </div>
    </Status>
  );
}

/** Feature Requests list area (the heading and explainer above it are already real). */
export function FeatureRequestsSkeleton() {
  return (
    <Status label="Loading feature requests" className="space-y-5">
      <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4 sm:p-5 space-y-3">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-72 max-w-full" />
        <Bone className="h-16" />
      </div>
      <div className="flex gap-4 border-b border-dashboard-border pb-2 overflow-hidden" aria-hidden="true">
        {[56, 72, 84, 72, 60].map((w, i) => (
          <div key={i} style={{ width: w }} className="flex-shrink-0">
            <Bone className="h-5" />
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-dashboard-border bg-dashboard-card p-3.5 flex gap-3" aria-hidden="true">
            <Bone className="w-[50px] h-12 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <Bone className="h-4 w-2/3" />
                <Bone className="h-4 w-16" />
              </div>
              <Bone className="h-3 w-5/6" />
              <Bone className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}
