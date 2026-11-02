import { planReviewerSave, type ReviewerRecord } from './reviewers';

export interface SavedReviewerLink {
  name: string;
}

export async function commitReviewerDraft(args: {
  name: string;
  saveToList: boolean;
  pickedId: string | null;
  list: ReviewerRecord[];
  create: (input: { name: string; nameKey: string }) => Promise<ReviewerRecord>;
}): Promise<SavedReviewerLink> {
  const plan = planReviewerSave(args);
  if (plan.action === 'clear') return { name: '' };
  if (plan.action === 'order-only') return { name: plan.name };
  if (plan.action === 'link') return { name: plan.reviewer.name };
  const created = await args.create(plan);
  return { name: created.name };
}
