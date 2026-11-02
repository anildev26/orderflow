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
