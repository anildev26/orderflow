export interface ReviewerRecord {
  id: string;
  name: string;
  nameKey: string;
}

export function collapseReviewerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function reviewerNameKey(name: string): string {
  return collapseReviewerName(name).toLowerCase();
}

export interface ReviewerSuggestion {
  id: string | null;
  name: string;
  nameKey: string;
}

// Saved rows win over the same name on an order. orderNames should be newest
// first so the first spelling of an order-only name is the one shown.
export function mergeReviewerSuggestions(saved: ReviewerRecord[], orderNames: string[]): ReviewerSuggestion[] {
  const savedKeys = new Set(saved.map((reviewer) => reviewer.nameKey || reviewerNameKey(reviewer.name)));
  const fromSaved: ReviewerSuggestion[] = saved
    .map((reviewer) => ({
      id: reviewer.id,
      name: reviewer.name,
      nameKey: reviewer.nameKey || reviewerNameKey(reviewer.name),
    }))
    .filter((reviewer) => reviewer.nameKey);

  const seen = new Set<string>();
  const fromOrders: ReviewerSuggestion[] = [];
  for (const raw of orderNames) {
    const name = collapseReviewerName(raw);
    const nameKey = reviewerNameKey(name);
    if (!nameKey || savedKeys.has(nameKey) || seen.has(nameKey)) continue;
    seen.add(nameKey);
    fromOrders.push({ id: null, name, nameKey });
  }

  return [...fromSaved, ...fromOrders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function filterReviewers<T extends { name: string }>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => item.name.toLowerCase().includes(q));
}

export function reviewerSaveError(list: ReviewerRecord[], name: string, ignoreId?: string): string | null {
  const key = reviewerNameKey(name);
  if (!key) return 'Enter a name';
  if (collapseReviewerName(name).length > 100) return 'Name is too long';
  const others = list.filter((r) => r.id !== ignoreId);
  if (others.some((r) => r.nameKey === key)) return 'Already in your reviewers';
  return null;
}

export type ReviewerPlan =
  | { action: 'clear' }
  | { action: 'order-only'; name: string }
  | { action: 'link'; reviewer: ReviewerRecord }
  | { action: 'create'; name: string; nameKey: string };

export function planReviewerSave(args: {
  name: string;
  saveToList: boolean;
  pickedId: string | null;
  list: ReviewerRecord[];
}): ReviewerPlan {
  const name = collapseReviewerName(args.name);
  if (!name) return { action: 'clear' };
  const key = reviewerNameKey(name);

  const picked = args.pickedId ? args.list.find((r) => r.id === args.pickedId) : undefined;
  if (picked && picked.nameKey === key) return { action: 'link', reviewer: picked };

  if (!args.saveToList) return { action: 'order-only', name };

  const exact = args.list.find((r) => r.nameKey === key);
  if (exact) return { action: 'link', reviewer: exact };
  return { action: 'create', name, nameKey: key };
}
