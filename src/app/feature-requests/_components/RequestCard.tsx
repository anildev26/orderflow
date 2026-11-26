'use client';

import { PRIORITY_LABEL, areaLabel, isOpenForVotes, timeAgo, type FeatureRequest, type Priority } from '@/lib/featureRequests';
import { findCatalogFeature } from '@/lib/featureCatalog';
import { StatusPill } from './ui';

export function MeTooButton({
  count,
  voted,
  pending,
  disabled,
  onClick,
  size = 'md',
}: {
  count: number;
  voted: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
  size?: 'md' | 'lg';
}) {
  const label = disabled ? `${count} people asked for this. Voting is closed.` : voted ? `Remove your Me too (${count})` : `Me too (${count})`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && !pending) onClick();
      }}
      aria-pressed={voted}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex flex-col items-center justify-center rounded-xl border font-bold leading-tight tabular-nums transition flex-shrink-0 ${
        size === 'lg' ? 'min-w-[60px] px-2 py-2 text-base' : 'min-w-[50px] px-1.5 py-1.5 text-sm'
      } ${
        voted
          ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
          : 'border-dashboard-border bg-dashboard-bg text-text-secondary hover:border-accent-blue/40 hover:text-accent-blue'
      } ${disabled ? 'opacity-60 cursor-default hover:border-dashboard-border hover:text-text-secondary' : 'cursor-pointer'} ${pending ? 'opacity-70' : ''}`}
    >
      <span>{count}</span>
      <span className={`text-[9px] font-medium uppercase tracking-wide ${voted ? 'text-accent-blue' : 'text-text-muted'}`}>me too</span>
    </button>
  );
}

export default function RequestCard({
  request,
  voted,
  pending,
  unread,
  commentCount,
  priority,
  isMine,
  onOpen,
  onVote,
}: {
  request: FeatureRequest;
  voted: boolean;
  pending: boolean;
  unread: boolean;
  commentCount: number;
  priority?: Priority;
  isMine: boolean;
  onOpen: (id: string) => void;
  onVote: (id: string) => void;
}) {
  const r = request;
  const area = areaLabel(r.area);
  const feature = r.status === 'already_exists' ? findCatalogFeature(r.existsFeature) : undefined;
  return (
    <div
      onClick={() => onOpen(r.id)}
      className={`bg-dashboard-card border rounded-xl p-3.5 flex gap-3 items-start cursor-pointer transition hover:border-accent-blue/40 focus-within:border-accent-blue/40 ${
        unread ? 'border-accent-blue/50' : 'border-dashboard-border'
      }`}
    >
      <MeTooButton
        count={r.likes}
        voted={voted}
        pending={pending}
        disabled={!isOpenForVotes(r.status)}
        onClick={() => onVote(r.id)}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary break-words min-w-0 flex items-center gap-2">
            {unread && <span className="w-2 h-2 rounded-full bg-accent-red flex-shrink-0" aria-label="New update" />}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(r.id);
              }}
              className="min-w-0 text-left break-words hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {r.title}
            </button>
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {priority && (
              <span className="hidden sm:inline px-1.5 py-0.5 rounded border border-dashed border-accent-orange/60 text-[10px] text-accent-orange" title="Private priority, only you see this">
                {PRIORITY_LABEL[priority]}
              </span>
            )}
            <StatusPill status={r.status} version={r.shippedVersion} />
          </div>
        </div>
        {r.details && <p className="text-xs text-text-secondary line-clamp-2 break-words">{r.details}</p>}
        {r.statusNote && (
          <div className="border-l-2 border-accent-blue bg-accent-blue/5 rounded-r-lg px-2.5 py-1.5">
            <p className="text-[10.5px] font-semibold text-accent-blue">Developer</p>
            <p className="text-xs text-text-secondary line-clamp-3 break-words">{r.statusNote}</p>
          </div>
        )}
        {feature && <p className="text-xs text-accent-blue">Find it: {feature.name} →</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
          {area && <span>{area}</span>}
          {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'reply' : 'replies'}</span>}
          <span>{isMine ? 'posted by you' : r.userEmailMasked}</span>
          <span>{timeAgo(r.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
