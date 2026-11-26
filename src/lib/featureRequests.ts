// Shared rules for the Feature Requests page: statuses, areas, validation, sorting,
// "unread update" tracking, and turning server errors into plain messages.
// Pure functions only (no React, no Supabase), so they are unit tested.

export type RequestStatus =
  | 'new'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'already_exists'
  | 'not_planned';

export type AreaId = 'orders' | 'follow_ups' | 'refunds' | 'archive' | 'analytics' | 'settings' | 'other';
export type Priority = 'nice' | 'important' | 'must';
export type BoardTab = 'open' | 'planned' | 'in_progress' | 'shipped' | 'closed';
export type PageTab = BoardTab | 'mine' | 'triage' | 'messages' | 'settings';
export type SortKey = 'trending' | 'top' | 'newest' | 'updated';
export type Availability = 'available' | 'busy' | 'away';

export interface FeatureRequest {
  id: string;
  userId: string;
  userEmailMasked: string;
  title: string;
  content: string;
  details: string | null;
  area: AreaId | null;
  status: RequestStatus;
  statusNote: string | null;
  shippedVersion: string | null;
  existsFeature: string | null;
  mergedInto: string | null;
  likes: number;
  createdAt: string;
  lastUpdateAt: string | null;
}

export interface RequestComment {
  id: string;
  requestId: string;
  userId: string;
  authorLabel: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface StatusEvent {
  id: string;
  requestId: string;
  status: RequestStatus;
  note: string | null;
  createdAt: string;
}

export interface DevMessage {
  id: string;
  threadUserId: string;
  fromAdmin: boolean;
  threadLabel: string;
  body: string;
  page: string | null;
  requestId: string | null;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

export interface BoardSettings {
  availability: Availability;
  awayNote: string | null;
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  inappEnabled: boolean;
  callUrl: string | null;
}

export interface RequestPerson {
  userId: string;
  label: string;
  email: string | null;
  role: 'requester' | 'me_too';
  reason: string | null;
  active: boolean;
  joinedAt: string;
}

export interface AdminThread {
  threadUserId: string;
  label: string;
  email: string | null;
  lastBody: string;
  lastAt: string;
  lastFromAdmin: boolean;
  unread: number;
  total: number;
}

export const DEFAULT_SETTINGS: BoardSettings = {
  availability: 'available',
  awayNote: null,
  whatsappEnabled: true,
  telegramEnabled: true,
  inappEnabled: true,
  callUrl: null,
};

// ───────── Labels ─────────

export const STATUS_META: Record<RequestStatus, { label: string; hint: string; pill: string }> = {
  new: { label: 'New', hint: 'Posted, not reviewed yet', pill: 'bg-dashboard-bg text-text-secondary border border-dashboard-border' },
  under_review: { label: 'Under review', hint: 'The developer has read it and is considering it', pill: 'bg-accent-yellow/15 text-accent-yellow' },
  planned: { label: 'Planned', hint: 'Will be built', pill: 'bg-violet-500/15 text-violet-500' },
  in_progress: { label: 'In progress', hint: 'Being built now', pill: 'bg-accent-orange/15 text-accent-orange' },
  shipped: { label: 'Shipped', hint: 'Live in OrderFlow', pill: 'bg-accent-green/15 text-accent-green' },
  already_exists: { label: 'Already exists', hint: 'OrderFlow already does this', pill: 'bg-accent-blue/15 text-accent-blue' },
  not_planned: { label: 'Not planned', hint: 'Will not be built', pill: 'bg-dashboard-bg text-text-muted border border-dashboard-border' },
};

export const STATUS_ORDER: RequestStatus[] = [
  'new', 'under_review', 'planned', 'in_progress', 'shipped', 'already_exists', 'not_planned',
];

export const AREAS: { id: AreaId; label: string }[] = [
  { id: 'orders', label: 'Orders' },
  { id: 'follow_ups', label: 'Follow-ups' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'archive', label: 'Archive' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
  { id: 'other', label: 'Other' },
];

export function areaLabel(area: AreaId | null | undefined): string | null {
  if (!area) return null;
  return AREAS.find((a) => a.id === area)?.label ?? null;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  nice: 'Nice to have',
  important: 'Important',
  must: 'Must have',
};

export const BOARD_TABS: { id: BoardTab; label: string; statuses: RequestStatus[]; defaultSort: SortKey }[] = [
  { id: 'open', label: 'Open', statuses: ['new', 'under_review'], defaultSort: 'trending' },
  { id: 'planned', label: 'Planned', statuses: ['planned'], defaultSort: 'top' },
  { id: 'in_progress', label: 'In progress', statuses: ['in_progress'], defaultSort: 'updated' },
  { id: 'shipped', label: 'Shipped', statuses: ['shipped'], defaultSort: 'updated' },
  { id: 'closed', label: 'Closed', statuses: ['already_exists', 'not_planned'], defaultSort: 'updated' },
];

export const SORT_LABEL: Record<SortKey, string> = {
  trending: 'Trending',
  top: 'Most requested',
  newest: 'Newest',
  updated: 'Recently updated',
};

export function isOpenForVotes(status: RequestStatus): boolean {
  return status === 'new' || status === 'under_review' || status === 'planned' || status === 'in_progress';
}

export function boardTabFor(status: RequestStatus): BoardTab {
  return BOARD_TABS.find((t) => t.statuses.includes(status))?.id ?? 'open';
}

// ───────── Limits and validation (mirror the database) ─────────

export const LIMITS = {
  requestMin: 6,
  requestMax: 500,
  detailsMax: 1000,
  commentMax: 2000,
  messageMax: 4000,
  reasonMax: 500,
  noteMax: 1000,
  awayNoteMax: 120,
} as const;

/** Remove invisible control characters (keeps newlines and tabs). */
export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function validateRequestText(text: string): string | null {
  const t = cleanText(text);
  if (t.length < LIMITS.requestMin) return 'Describe what you want to do in a few more words.';
  if (t.length > LIMITS.requestMax) return `Keep it under ${LIMITS.requestMax} characters. Add more in the details box.`;
  return null;
}

export function validateLength(text: string, max: number, emptyMessage: string): string | null {
  const t = cleanText(text);
  if (!t) return emptyMessage;
  if (t.length > max) return `Keep it under ${max} characters.`;
  return null;
}

/** Same rule as public.fr_make_title(): first line, single spaces, at most 120 characters. */
export function makeTitle(content: string): string {
  let t = (content.split('\n')[0] ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 3) t = content.replace(/\s+/g, ' ').trim();
  if (t.length > 120) {
    t = t.slice(0, 117);
    if (t.includes(' ')) t = t.replace(/\s+\S*$/, '');
    t += '…';
  }
  return t;
}

export function normaliseVersion(input: string): string | null {
  const v = input.trim();
  if (!/^v?[0-9]+(\.[0-9]+){0,3}$/.test(v)) return null;
  return v.startsWith('v') ? v : `v${v}`;
}

export function isSafeHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  if (/[\s<>"]/.test(value.trim())) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

// ───────── Errors ─────────

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
}

function errorParts(err: unknown): { message: string; code: string } {
  if (err && typeof err === 'object') {
    const e = err as ErrorLike;
    return {
      message: typeof e.message === 'string' ? e.message : '',
      code: typeof e.code === 'string' ? e.code : '',
    };
  }
  if (typeof err === 'string') return { message: err, code: '' };
  return { message: '', code: '' };
}

/** A message the user can act on, never a raw database error. */
export function friendlyError(err: unknown): string {
  const { message, code } = errorParts(err);
  const ours = message.match(/fr_[a-z_]+:\s*([\s\S]+)$/);
  if (ours) return ours[1].trim();
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(message)) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (/jwt|not authenticated|session/i.test(message) || code === 'PGRST301') {
    return 'Your session has expired. Refresh the page or sign in again.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'You do not have permission to do that. Refresh the page and try again.';
  }
  if (code === '23514' || /check constraint/i.test(message)) {
    return 'That does not look right. Check what you entered and try again.';
  }
  if (code === '23503') {
    return 'This request no longer exists. Refresh the page.';
  }
  return 'Something went wrong. Please try again.';
}

/** True when the database has not been upgraded for this version of the page yet. */
export function isMissingSchemaError(err: unknown): boolean {
  const { message, code } = errorParts(err);
  if (['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true;
  return /does not exist|could not find the .* (column|table|function)|schema cache/i.test(message);
}

export function isDuplicateError(err: unknown): boolean {
  return errorParts(err).code === '23505';
}

// ───────── Following and unread updates ─────────

function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * A request has an unread update for this user when they follow it (posted it or said
 * Me too) and the developer changed its status or replied after they last looked.
 */
export function isUnread(
  req: Pick<FeatureRequest, 'userId' | 'createdAt' | 'lastUpdateAt'>,
  ctx: { userId: string | null; myVoteAt?: string | null; seenAt?: string | null },
): boolean {
  if (!ctx.userId || !req.lastUpdateAt) return false;
  const mine = req.userId === ctx.userId;
  if (!mine && !ctx.myVoteAt) return false;
  const baseline = Math.max(ms(ctx.seenAt), ms(ctx.myVoteAt), mine ? ms(req.createdAt) : 0);
  return ms(req.lastUpdateAt) > baseline;
}

// ───────── Sorting ─────────

const DAY = 86_400_000;

/** Recent Me toos count most, so new ideas can rise above old totals. */
export function trendingScore(req: Pick<FeatureRequest, 'likes' | 'createdAt'>, recentVotes: number, now: number): number {
  const ageDays = Math.max(0, (now - ms(req.createdAt)) / DAY);
  const freshBoost = ageDays < 3 ? 2 : 0;
  return recentVotes * 3 + Math.log2(1 + Math.max(0, req.likes)) + freshBoost;
}

export function sortRequests<T extends Pick<FeatureRequest, 'id' | 'likes' | 'createdAt' | 'lastUpdateAt'>>(
  list: readonly T[],
  key: SortKey,
  ctx: { recentVotes?: ReadonlyMap<string, number>; now?: number } = {},
): T[] {
  const now = ctx.now ?? Date.now();
  const recent = ctx.recentVotes ?? new Map<string, number>();
  const newest = (a: T, b: T) => ms(b.createdAt) - ms(a.createdAt);
  const copy = [...list];
  switch (key) {
    case 'top':
      return copy.sort((a, b) => b.likes - a.likes || newest(a, b));
    case 'newest':
      return copy.sort(newest);
    case 'updated':
      return copy.sort((a, b) => ms(b.lastUpdateAt ?? b.createdAt) - ms(a.lastUpdateAt ?? a.createdAt) || newest(a, b));
    case 'trending':
    default:
      return copy.sort(
        (a, b) =>
          trendingScore(b, recent.get(b.id) ?? 0, now) - trendingScore(a, recent.get(a.id) ?? 0, now) ||
          b.likes - a.likes ||
          newest(a, b),
      );
  }
}

// ───────── Time ─────────

export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = ms(iso);
  if (!t) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(iso: string): string {
  const t = ms(iso);
  if (!t) return '';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ───────── Talking to the developer ─────────

export const DEVELOPER = {
  name: 'Anil',
  whatsappNumber: '919082146640',
  telegramUrl: 'https://t.me/jack26_ig',
  email: 'anilsahu2672000@gmail.com',
} as const;

export function availabilityText(s: Pick<BoardSettings, 'availability' | 'awayNote'>): string {
  if (s.availability === 'away') return s.awayNote?.trim() || 'Away for a few days. Messages are saved.';
  if (s.availability === 'busy') return s.awayNote?.trim() || 'Busy right now. Usually replies within a day.';
  return 'Usually replies within a few hours.';
}

export function whatsAppText(requestTitle?: string | null): string {
  const about = requestTitle ? ` about the feature request "${requestTitle.slice(0, 140)}"` : ' about OrderFlow';
  return `Hi ${DEVELOPER.name}, I'm messaging${about}. `;
}

export function whatsAppLink(text: string): string {
  return `https://wa.me/${DEVELOPER.whatsappNumber}?text=${encodeURIComponent(text.slice(0, 1000))}`;
}
