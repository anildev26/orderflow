import { planMediatorSave, type MediatorRecord } from './mediators';
import { PHONE_CHECK_MESSAGE } from './phone';

export interface SavedMediatorLink {
  name: string;
  mediatorId: string | null;
  mediatorPhone: string | null;
}

export async function commitMediatorDraft(args: {
  name: string;
  phoneInput: string;
  saveToList: boolean;
  pickedId: string | null;
  list: MediatorRecord[];
  create: (input: { name: string; nameKey: string; phoneNormalized: string; phoneDisplay: string }) => Promise<MediatorRecord>;
}): Promise<SavedMediatorLink> {
  const plan = planMediatorSave(args);
  if (plan.action === 'invalid') throw new Error(PHONE_CHECK_MESSAGE);
  if (plan.action === 'clear') return { name: '', mediatorId: null, mediatorPhone: null };
  if (plan.action === 'order-only') return { name: plan.name, mediatorId: null, mediatorPhone: plan.phone };
  if (plan.action === 'link') {
    return {
      name: plan.mediator.name,
      mediatorId: plan.mediator.id,
      mediatorPhone: plan.mediator.phoneNormalized || null,
    };
  }
  if (plan.action === 'blocked') {
    throw new Error(`This number is already saved as ${plan.mediator.name} in your mediators`);
  }
  const created = await args.create(plan);
  return {
    name: created.name,
    mediatorId: created.id,
    mediatorPhone: created.phoneNormalized || null,
  };
}
