import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '../types/order.ts';
import {
  DEFAULT_FILTERS,
  NO_BANK_KEY,
  activeFilterCount,
  archiveDateOf,
  bankOptions,
  daysToPay,
  groupByMonth,
  matchesArchiveFilters,
  matchesArchiveSearch,
  matchesStatus,
  nameOptions,
  previousStatusOf,
  rangeBounds,
  receivedOf,
  reopenedReminder,
  sortArchived,
  suggestNames,
  totalsOf,
  yearSummary,
} from './archive.ts';

let n = 0;
function order(p: Partial<Order> = {}): Order {
  n++;
  return {
    id: `id${n}`,
    orderId: `OD${1000 + n}`,
    platform: 'amazon',
    email: '',
    brandName: '',
    productName: 'Thing',
    orderDate: '2026-10-01',
    totalAmount: 1000,
    sellerLess: 100,
    commissionAmount: null,
    mediatorName: 'Riya',
    reviewerName: 'Anil',
    orderType: 'Rating',
    isReplacement: false,
    isExchange: false,
    exchangeProductName: '',
    replacementOrderId: '',
    mediatorMessage: '',
    status: 'payment_received',
    paymentReceivedDate: '2026-11-20',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    ...p,
  };
}

const TODAY = '2026-11-27';

describe('money', () => {
  it('counts cancelled orders as ₹0', () => {
    assert.equal(receivedOf(order({ status: 'order_cancelled' })), 0);
    assert.equal(receivedOf(order()), 900);
    assert.equal(receivedOf(order({ sellerLess: 0, commissionAmount: 50 })), 1050);
  });
  it('totals only paid orders', () => {
    const t = totalsOf([order(), order({ status: 'order_cancelled' }), order({ totalAmount: 500, sellerLess: 0 })]);
    assert.deepEqual(t, { received: 1400, paid: 2, cancelled: 1 });
  });
});

describe('archive date', () => {
  it('uses the paid date, then archived date, then last change', () => {
    assert.equal(archiveDateOf(order()), '2026-11-20');
    assert.equal(archiveDateOf(order({ paymentReceivedDate: undefined, archivedAt: '2026-11-02' })), '2026-11-02');
    assert.equal(archiveDateOf(order({ status: 'order_cancelled', paymentReceivedDate: undefined, archivedAt: null })), '2026-11-20');
  });
  it('days to pay counts from the refund form date', () => {
    assert.equal(daysToPay(order({ refundFormFilledDate: '2026-11-02' })), 18);
    assert.equal(daysToPay(order()), null);
    assert.equal(daysToPay(order({ status: 'order_cancelled', refundFormFilledDate: '2026-11-02' })), null);
    assert.equal(daysToPay(order({ refundFormFilledDate: '2026-12-02' })), null);
  });
});

describe('search', () => {
  const o = order({ orderId: '408-7712093-5531809', productName: 'boAt Airdopes', brandName: 'boAt', mediatorName: 'Riya Deals', reviewerName: 'Anjali', paymentBank: 'HDFC' });
  it('finds by any field, ignoring case', () => {
    for (const q of ['airdopes', 'BOAT', 'riya', 'anjali', 'hdfc', '5531809']) assert.ok(matchesArchiveSearch(o, q), q);
    assert.ok(!matchesArchiveSearch(o, 'flipkart'));
  });
  it('ignores spaces and dashes in order IDs', () => {
    assert.ok(matchesArchiveSearch(o, '40877120935531809'));
    assert.ok(matchesArchiveSearch(o, '7712093 5531809'));
  });
  it('empty search matches everything', () => assert.ok(matchesArchiveSearch(o, '  ')));
});

describe('filters', () => {
  it('date presets', () => {
    assert.deepEqual(rangeBounds({ range: 'this_month', from: '', to: '' }, TODAY), { from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(rangeBounds({ range: 'last_month', from: '', to: '' }, TODAY), { from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(rangeBounds({ range: 'last_3_months', from: '', to: '' }, TODAY), { from: '2026-09-01', to: '2026-11-30' });
    assert.deepEqual(rangeBounds({ range: 'last_month', from: '', to: '' }, '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
    assert.deepEqual(rangeBounds({ range: 'custom', from: '2026-11-10', to: '2026-11-01' }, TODAY), { from: '2026-11-01', to: '2026-11-10' });
  });
  it('filters by date, platform, mediator, reviewer and bank', () => {
    const a = order({ paymentReceivedDate: '2026-10-15', platform: 'flipkart', mediatorName: ' riya ', reviewerName: 'Anil', paymentBank: 'SBI' });
    const f = { ...DEFAULT_FILTERS, range: 'last_month' as const };
    assert.ok(matchesArchiveFilters(a, f, TODAY));
    assert.ok(!matchesArchiveFilters(order(), f, TODAY));
    assert.ok(matchesArchiveFilters(a, { ...DEFAULT_FILTERS, platforms: ['flipkart'] }, TODAY));
    assert.ok(!matchesArchiveFilters(a, { ...DEFAULT_FILTERS, platforms: ['amazon'] }, TODAY));
    assert.ok(matchesArchiveFilters(a, { ...DEFAULT_FILTERS, mediator: 'riya' }, TODAY));
    assert.ok(matchesArchiveFilters(a, { ...DEFAULT_FILTERS, reviewer: 'anil' }, TODAY));
    assert.ok(!matchesArchiveFilters(a, { ...DEFAULT_FILTERS, reviewer: 'anjali' }, TODAY));
    assert.ok(matchesArchiveFilters(a, { ...DEFAULT_FILTERS, banks: ['sbi'] }, TODAY));
    assert.ok(matchesArchiveFilters(order({ paymentBank: '' }), { ...DEFAULT_FILTERS, banks: [NO_BANK_KEY] }, TODAY));
    assert.ok(!matchesArchiveFilters(order({ status: 'order_cancelled' }), { ...DEFAULT_FILTERS, banks: [NO_BANK_KEY] }, TODAY));
  });
  it('status chips and filter count', () => {
    assert.ok(matchesStatus(order(), 'paid'));
    assert.ok(!matchesStatus(order(), 'cancelled'));
    assert.ok(!matchesStatus(order({ status: 'informed_mediator' }), 'all'));
    assert.equal(activeFilterCount(DEFAULT_FILTERS), 0);
    assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, range: 'custom' }), 0);
    assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, range: 'this_year', platforms: ['amazon'], reviewer: 'anil' }), 3);
  });
});

describe('names and banks', () => {
  const list = [
    order({ reviewerName: 'Anil' }),
    order({ reviewerName: 'anil ' }),
    order({ reviewerName: 'Anjali' }),
    order({ reviewerName: 'Riyan Kumar' }),
    order({ reviewerName: '' }),
  ];
  it('merges spellings and counts', () => {
    const opts = nameOptions(list, 'reviewer');
    assert.deepEqual(opts.map((o) => [o.key, o.count]), [['anil', 2], ['anjali', 1], ['riyan kumar', 1]]);
  });
  it('suggests names starting with the text first', () => {
    const opts = nameOptions(list, 'reviewer');
    assert.deepEqual(suggestNames(opts, 'an').map((o) => o.key), ['anil', 'anjali', 'riyan kumar']);
    assert.deepEqual(suggestNames(opts, 'kum').map((o) => o.key), ['riyan kumar']);
  });
  it('lists banks with no-bank last', () => {
    const b = bankOptions([order({ paymentBank: 'HDFC' }), order({ paymentBank: 'hdfc' }), order({ paymentBank: '' }), order({ paymentBank: 'SBI' })]);
    assert.deepEqual(b.map((x) => [x.key, x.count]), [['hdfc', 2], ['sbi', 1], [NO_BANK_KEY, 1]]);
  });
});

describe('sorting', () => {
  it('newest paid, oldest, highest, slowest', () => {
    const a = order({ paymentReceivedDate: '2026-11-01', totalAmount: 300, sellerLess: 0, refundFormFilledDate: '2026-10-01' });
    const b = order({ paymentReceivedDate: '2026-11-10', totalAmount: 100, sellerLess: 0, refundFormFilledDate: '2026-11-05' });
    const c = order({ paymentReceivedDate: '2026-11-05', totalAmount: 200, sellerLess: 0 });
    assert.deepEqual(sortArchived([a, b, c], 'newest').map((o) => o.id), [b.id, c.id, a.id]);
    assert.deepEqual(sortArchived([a, b, c], 'oldest').map((o) => o.id), [a.id, c.id, b.id]);
    assert.deepEqual(sortArchived([a, b, c], 'highest').map((o) => o.id), [a.id, c.id, b.id]);
    assert.deepEqual(sortArchived([a, b, c], 'slowest').map((o) => o.id), [a.id, b.id, c.id]);
  });
});

describe('monthly', () => {
  const list = [
    order({ paymentReceivedDate: '2026-11-20', paymentBank: 'HDFC', refundFormFilledDate: '2026-11-10' }),
    order({ paymentReceivedDate: '2026-11-02', paymentBank: 'SBI', refundFormFilledDate: '2026-10-23' }),
    order({ paymentReceivedDate: '2026-11-05', paymentBank: '' }),
    order({ paymentReceivedDate: '2026-10-05', paymentBank: 'HDFC' }),
    order({ status: 'order_cancelled', archivedAt: '2026-11-03' }),
    order({ paymentReceivedDate: '2025-12-31' }),
  ];
  it('groups paid orders by paid month and leaves cancelled out', () => {
    const g = groupByMonth(list);
    assert.deepEqual(g.map((m) => [m.key, m.count, m.total]), [['2026-11', 3, 2700], ['2026-10', 1, 900], ['2025-12', 1, 900]]);
    assert.equal(g[0].avgDays, 10);
    assert.deepEqual(g[0].byBank.map((b) => [b.name, b.total]), [['HDFC', 900], ['SBI', 900], ['No bank saved', 900]]);
    assert.deepEqual(g[0].orders.map((o) => o.paymentReceivedDate), ['2026-11-20', '2026-11-05', '2026-11-02']);
  });
  it('year summary has 12 months', () => {
    const y = yearSummary(groupByMonth(list), '2026');
    assert.equal(y.months.length, 12);
    assert.equal(y.total, 3600);
    assert.equal(y.count, 4);
    assert.equal(y.months[10].total, 2700);
    assert.equal(y.months[0].total, 0);
  });
});

describe('reopen', () => {
  it('uses the saved previous status', () => {
    assert.equal(previousStatusOf({ archivedFromStatus: 'refund_form_pending', informedMediatorDate: '2026-11-01' }), 'refund_form_pending');
  });
  it('works it out from dates for older orders', () => {
    assert.equal(previousStatusOf({ informedMediatorDate: '2026-11-01', refundFormFilledDate: '2026-10-30' }), 'informed_mediator');
    assert.equal(previousStatusOf({ refundFormFilledDate: '2026-10-30' }), 'refund_form_filled');
    assert.equal(previousStatusOf({ reviewRatingDate: '2026-10-20' }), 'review_rating_submitted');
    assert.equal(previousStatusOf({ deliveredDate: '2026-10-10' }), 'delivered');
    assert.equal(previousStatusOf({}), 'ordered');
    assert.equal(previousStatusOf({ archivedFromStatus: 'payment_received', deliveredDate: '2026-10-10' }), 'delivered');
  });
  it('brings back a reminder that Got paid stopped', () => {
    const r = reopenedReminder({
      reminderStatus: 'stopped',
      nextReminderDate: '2026-12-01',
      reminderHistory: [
        { date: '2026-11-01', action: 'snoozed', nextReminderDate: '2026-12-01' },
        { date: '2026-11-20', action: 'stopped', note: 'Payment received' },
      ],
    });
    assert.equal(r.reminderStatus, 'snoozed');
    assert.equal(r.reminderHistory?.length, 1);
  });
  it('brings back a reminder that Update Order stopped', () => {
    const r = reopenedReminder({ reminderStatus: 'stopped', nextReminderDate: '2026-12-01', reminderHistory: [{ date: '2026-11-01', action: 'scheduled' }] });
    assert.deepEqual(r, { reminderStatus: 'scheduled' });
  });
  it('keeps a reminder the user stopped by hand', () => {
    assert.deepEqual(
      reopenedReminder({ reminderStatus: 'stopped', nextReminderDate: '2026-12-01', reminderHistory: [{ date: '2026-11-01', action: 'stopped' }] }),
      {},
    );
    assert.deepEqual(reopenedReminder({ reminderStatus: 'scheduled', nextReminderDate: '2026-12-01' }), {});
    assert.deepEqual(reopenedReminder({ reminderStatus: 'stopped' }), {});
  });
});
