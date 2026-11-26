import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_ORDERS_PER_MESSAGE,
  NO_MEDIATOR_KEY,
  buildMediatorMessage,
  groupByMediator,
  inView,
  matchesFollowUpSearch,
  mediatorChips,
  mediatorScore,
  platformChips,
  preferredName,
  refundOf,
  sortFollowUps,
  summarize,
  toneFor,
} from './followUpBoard.ts';
import type { Order } from '../types/order.ts';

const TODAY = '2026-11-26';

function fu(id: string, over: Partial<Order> = {}): Order {
  return ({
    id,
    orderId: `OD${id}`,
    platform: 'flipkart',
    productName: `Product ${id}`,
    mediatorName: 'Ravi Kumar',
    reviewerName: 'Bob',
    totalAmount: 1000,
    sellerLess: 100,
    commissionAmount: null as number | null,
    nextReminderDate: '2026-11-20',
    refundFormFilledDate: '2026-09-15',
    reminderCount: 0,
    ...over,
  }) as unknown as Order;
}

const list = [
  fu('1', { nextReminderDate: '2026-10-24', totalAmount: 1299, sellerLess: 200 }),
  fu('2', { nextReminderDate: '2026-11-20', totalAmount: 2199, sellerLess: 300, platform: 'amazon' }),
  fu('3', { nextReminderDate: '2026-11-19', mediatorName: 'ravi  kumar ', totalAmount: 349, sellerLess: 50 }),
  fu('4', { nextReminderDate: '2026-12-01', mediatorName: 'Sneha', platform: 'meesho', totalAmount: 599 }),
  fu('5', { nextReminderDate: '2026-12-03', mediatorName: 'Aman', commissionAmount: 50, sellerLess: 0, totalAmount: 1599 }),
  fu('6', { nextReminderDate: TODAY, mediatorName: '' }),
];

describe('refundOf', () => {
  it('uses seller less, or adds commission', () => {
    assert.equal(refundOf({ totalAmount: 1299, sellerLess: 200, commissionAmount: null }), 1099);
    assert.equal(refundOf({ totalAmount: 1599, sellerLess: 0, commissionAmount: 50 }), 1649);
  });
});

describe('inView', () => {
  it('splits due (today or earlier) and upcoming', () => {
    assert.deepEqual(inView(list, 'due', TODAY).map((o) => o.id), ['1', '2', '3', '6']);
    assert.deepEqual(inView(list, 'upcoming', TODAY).map((o) => o.id), ['4', '5']);
    assert.equal(inView(list, 'all', TODAY).length, 6);
  });
});

describe('mediatorChips', () => {
  it('lists only mediators in the given list, merges spelling, counts orders', () => {
    const due = inView(list, 'due', TODAY);
    const chips = mediatorChips(due);
    assert.deepEqual(chips.map((c) => [c.label, c.count]), [['Ravi Kumar', 3], ['No mediator', 1]]);
    assert.ok(!chips.some((c) => c.label === 'Sneha' || c.label === 'Aman'), 'no mediators without a due order');
  });
  it('platform chips count what is shown', () => {
    assert.deepEqual(platformChips(inView(list, 'due', TODAY)).map((c) => [c.key, c.count]), [['flipkart', 3], ['amazon', 1]]);
  });
});

describe('preferredName', () => {
  it('picks the most used spelling and tidies spaces', () => {
    assert.equal(preferredName(['ravi  kumar ', 'Ravi Kumar', 'Ravi Kumar']), 'Ravi Kumar');
    assert.equal(preferredName(['', '  ']), 'No mediator');
  });
});

describe('summarize', () => {
  it('adds up money due and in total, and finds the oldest wait', () => {
    const s = summarize(list, TODAY, (o) => (o.id === '1' ? 54 : 10));
    assert.equal(s.dueCount, 4);
    assert.equal(s.dueAmount, 1099 + 1899 + 299 + 900);
    assert.equal(s.totalCount, 6);
    assert.equal(s.totalAmount, 1099 + 1899 + 299 + 499 + 1649 + 900);
    assert.equal(s.upcomingCount, 2);
    assert.equal(s.oldestWait, 54);
  });
  it('handles an empty list', () => {
    assert.deepEqual(summarize([], TODAY, () => null), { dueCount: 0, dueAmount: 0, upcomingCount: 0, totalCount: 0, totalAmount: 0, oldestWait: null });
  });
});

describe('sortFollowUps', () => {
  it('most overdue first, biggest amount, or by mediator', () => {
    assert.deepEqual(sortFollowUps(list, 'overdue').map((o) => o.id), ['1', '3', '2', '6', '4', '5']);
    assert.equal(sortFollowUps(list, 'amount')[0].id, '2');
    const byMed = sortFollowUps(list, 'mediator').map((o) => o.id);
    assert.equal(byMed[byMed.length - 1], '6', 'no mediator goes last');
  });
});

describe('groupByMediator', () => {
  it('one group per mediator, spelling merged, biggest amount due first', () => {
    const g = groupByMediator(list, TODAY);
    assert.deepEqual(g.map((x) => x.name), ['Ravi Kumar', 'Aman', 'Sneha', 'No mediator']);
    assert.equal(g[0].orders.length, 3);
    assert.equal(g[0].dueCount, 3);
    assert.equal(g[0].dueAmount, 1099 + 1899 + 299);
    assert.equal(g[g.length - 1].key, NO_MEDIATOR_KEY);
  });
});

describe('mediatorScore', () => {
  const paid = (filled: string, paidOn: string, name = 'Ravi Kumar') => ({
    status: 'payment_received' as const, mediatorName: name, refundFormFilledDate: filled, paymentReceivedDate: paidOn, refundTimelineDays: 30,
  });
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  it('needs at least 3 paid orders', () => {
    assert.equal(mediatorScore([paid('2026-01-01', '2026-01-11'), paid('2026-02-01', '2026-02-11')], 'ravi kumar', days), null);
  });
  it('typical days is the median; counts on-time payments', () => {
    const s = mediatorScore([
      paid('2026-01-01', '2026-01-11'),
      paid('2026-02-01', '2026-02-21'),
      paid('2026-03-01', '2026-04-20'),
      paid('2026-03-01', '2026-03-05', 'Aman'),
      { status: 'refund_form_filled' as const, mediatorName: 'Ravi Kumar', refundFormFilledDate: '2026-01-01', paymentReceivedDate: undefined, refundTimelineDays: 30 },
    ], 'ravi kumar', days);
    assert.deepEqual(s, { paidCount: 3, typicalDays: 20, onTimeCount: 2 });
  });
  it('ignores bad dates and no-mediator', () => {
    assert.equal(mediatorScore([paid('2026-05-01', '2026-04-01'), paid('', '2026-04-01')], 'ravi kumar', days), null);
    assert.equal(mediatorScore([], NO_MEDIATOR_KEY, days), null);
  });
});

describe('toneFor', () => {
  it('escalates with how many times orders were chased', () => {
    assert.equal(toneFor([{ reminderCount: 0 }]), 'friendly');
    assert.equal(toneFor([{ reminderCount: 0 }, { reminderCount: 1 }]), 'reminder');
    assert.equal(toneFor([{ reminderCount: 3 }]), 'firm');
  });
});

describe('buildMediatorMessage', () => {
  const ctx = { fmtDate: (d: string) => d, waitDays: () => 54, daysLabel: (n: number) => `${n} working days` };

  it('lists only the chosen orders with a correct total', () => {
    const chosen = [list[0], list[1]];
    const msg = buildMediatorMessage('Ravi Kumar', chosen, 'friendly', ctx);
    assert.match(msg, /Hello Ravi Kumar,/);
    assert.match(msg, /these 2 refunds/);
    assert.match(msg, /1\. Flipkart · OD1/);
    assert.match(msg, /2\. Amazon · OD2/);
    assert.ok(!msg.includes('OD3'), 'unchosen order is not in the message');
    assert.match(msg, /Total pending: ₹2,998/);
  });

  it('uses single-order wording and each tone', () => {
    assert.match(buildMediatorMessage('Aman', [list[4]], 'friendly', ctx), /refund for this order/);
    assert.match(buildMediatorMessage('Aman', [list[4]], 'reminder', ctx), /Refund reminder/);
    assert.match(buildMediatorMessage('Aman', [list[4]], 'firm', ctx), /action needed/);
    assert.match(buildMediatorMessage('No mediator', [list[5]], 'friendly', ctx), /^.*\n\nHello,/);
  });

  it('caps the message at 10 orders', () => {
    const many = Array.from({ length: 14 }, (_, i) => fu(String(i + 10)));
    const msg = buildMediatorMessage('Ravi Kumar', many, 'friendly', ctx);
    assert.match(msg, new RegExp(`these ${MAX_ORDERS_PER_MESSAGE} refunds`));
    assert.ok(!msg.includes('OD20'));
  });
});

describe('matchesFollowUpSearch', () => {
  it('searches order id, product, mediator and reviewer', () => {
    assert.equal(matchesFollowUpSearch(list[0], 'od1'), true);
    assert.equal(matchesFollowUpSearch(list[0], 'ravi'), true);
    assert.equal(matchesFollowUpSearch(list[0], 'nothing'), false);
    assert.equal(matchesFollowUpSearch(list[0], '  '), true);
  });
});
