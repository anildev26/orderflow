import { formatIndianMobile, isNormalizedIndianMobile, normalizeIndianMobile } from './phone.ts';

export interface MediatorRecord {
  id: string;
  name: string;
  nameKey: string;
  phoneDisplay: string;
  phoneNormalized: string;
}

export function collapseMediatorName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function mediatorNameKey(name: string): string {
  return collapseMediatorName(name).toLowerCase();
}

export function settingsSaveError(
  list: MediatorRecord[],
  name: string,
  phoneNormalized: string,
  ignoreId?: string,
): string | null {
  const key = mediatorNameKey(name);
  if (!key) return 'Enter a name';
  const others = list.filter((m) => m.id !== ignoreId);
  if (others.some((m) => m.nameKey === key && m.phoneNormalized === phoneNormalized)) {
    return 'Already in your mediators';
  }
  if (phoneNormalized) {
    const taken = others.find((m) => m.phoneNormalized === phoneNormalized);
    if (taken) return `This number is already saved as ${taken.name}`;
  }
  return null;
}

export type MediatorPlan =
  | { action: 'clear' }
  | { action: 'invalid' }
  | { action: 'order-only'; name: string; phone: string | null }
  | { action: 'link'; mediator: MediatorRecord }
  | { action: 'create'; name: string; nameKey: string; phoneNormalized: string; phoneDisplay: string }
  | { action: 'blocked'; mediator: MediatorRecord };

export function planMediatorSave(args: {
  name: string;
  phoneInput: string;
  saveToList: boolean;
  pickedId: string | null;
  list: MediatorRecord[];
}): MediatorPlan {
  const name = collapseMediatorName(args.name);
  if (!name) return { action: 'clear' };
  const phone = normalizeIndianMobile(args.phoneInput);
  if (!phone.ok) return { action: 'invalid' };
  const phoneNormalized = phone.empty ? '' : phone.normalized;
  const phoneDisplay = phone.empty ? '' : phone.display;
  const key = mediatorNameKey(name);

  const picked = args.pickedId ? args.list.find((m) => m.id === args.pickedId) : undefined;
  if (picked && picked.nameKey === key && picked.phoneNormalized === phoneNormalized) {
    return { action: 'link', mediator: picked };
  }

  if (!args.saveToList) {
    return { action: 'order-only', name, phone: phoneNormalized || null };
  }

  const exact = args.list.find((m) => m.nameKey === key && m.phoneNormalized === phoneNormalized);
  if (exact) return { action: 'link', mediator: exact };

  if (phoneNormalized) {
    const taken = args.list.find((m) => m.phoneNormalized === phoneNormalized);
    if (taken) return { action: 'blocked', mediator: taken };
  }

  return { action: 'create', name, nameKey: key, phoneNormalized, phoneDisplay };
}

export function sameNameOtherNumbers(
  list: MediatorRecord[],
  name: string,
  phoneNormalized: string,
): MediatorRecord[] {
  const key = mediatorNameKey(name);
  if (!key) return [];
  return list.filter((m) => m.nameKey === key && m.phoneNormalized !== phoneNormalized);
}

export function orderChatPhone(
  order: { mediatorId?: string | null; mediatorPhone?: string | null },
  list: MediatorRecord[],
): string | null {
  if (order.mediatorId) {
    const linked = list.find((m) => m.id === order.mediatorId);
    if (linked && isNormalizedIndianMobile(linked.phoneNormalized)) return linked.phoneNormalized;
  }
  if (isNormalizedIndianMobile(order.mediatorPhone)) return order.mediatorPhone;
  return null;
}

export function phoneInputFromStored(normalized: string | null | undefined, display?: string | null): string {
  if (display && display.trim()) return display;
  return formatIndianMobile(normalized);
}
