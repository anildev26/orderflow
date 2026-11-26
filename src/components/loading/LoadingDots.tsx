// E · Bouncing dots. For short waits inside a page that is already on screen:
// a panel filling in, a sheet or modal opening for the first time.

export function LoadingDots({ size = 8, label = 'Loading', showLabel = false, className = '' }: {
  size?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="of-dots" style={{ fontSize: size }} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {showLabel ? <span className="text-xs text-text-muted">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Centred dots for a panel or tab area. */
export function DotsBlock({ label = 'Loading', className = 'py-10' }: { label?: string; className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <LoadingDots size={9} label={label} showLabel />
    </div>
  );
}

/** Dimmed overlay with dots, shown while a modal or sheet opens for the first time. */
export function DotsOverlay() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
      <span className="rounded-2xl bg-dashboard-card border border-dashboard-border px-5 py-4 shadow-2xl">
        <LoadingDots size={9} label="Opening" />
      </span>
    </div>
  );
}
