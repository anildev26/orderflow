import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// Exercise the real date helpers and store without contacting a live database.
let rows = [];
const database = {
  auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
  from: () => ({
    select: () => ({ order: async () => ({ data: structuredClone(rows), error: null }) }),
    update: (updates) => {
      const apply = (matches) => {
        rows.filter(matches).forEach((row) => Object.assign(row, updates));
        return Promise.resolve({ error: null });
      };
      return {
        eq: (key, value) => apply((row) => row[key] === value),
        in: (key, values) => apply((row) => values.includes(row[key])),
      };
    },
  }),
};
globalThis.__returnWindowTestDatabase = database;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'zustand' || specifier === '@/lib/supabase') {
      return { url: `test:${specifier}`, shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    if (specifier === './followup') {
      return { url: new URL('./followup.ts', context.parentURL).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'test:zustand') {
      return { format: 'module', shortCircuit: true, source: `
        export const create = () => (initialize) => {
          let state;
          const set = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
          state = initialize(set, () => state);
          return { getState: () => state };
        };
      ` };
    }
    if (url === 'test:@/lib/supabase') {
      return { format: 'module', shortCircuit: true, source: 'export const createClient = () => globalThis.__returnWindowTestDatabase;' };
    }
    if (url.endsWith('.ts')) {
      // Node strips explicit type imports; the existing store uses implicit ones.
      const source = readFileSync(new URL(url), 'utf8').replace(
        'import { Order, OrderStatus, OrderPlatform, ReminderHistoryEntry }',
        'import type { Order, OrderStatus, OrderPlatform, ReminderHistoryEntry }'
      );
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source) };
    }
    return nextLoad(url, context);
  },
});

const { getReturnWindow } = await import('../src/lib/returnWindow.ts');
const { STATUS_OPTIONS } = await import('../src/types/order.ts');
const { useOrderStore } = await import('../src/store/useOrderStore.ts');
const { watchLocalDate } = await import('../src/lib/localDate.ts');
const { todayStr } = await import('../src/lib/followup.ts');

test('return closing date survives every status except Refund Form Filled', () => {
  for (const { value: status } of STATUS_OPTIONS) {
    const window = getReturnWindow({ status, deliveredDate: '2026-10-01' }, '2026-10-04');
    assert.deepEqual(window, status === 'refund_form_filled' ? null : { endDate: '2026-10-08', daysLeft: 5 }, status);
  }
  assert.equal(getReturnWindow({ status: 'review_rating_submitted' }), null);
});

test('default and custom windows stay open through the full closing day', () => {
  for (const returnPeriodDays of [1, 3, 7, 10, 14]) {
    const order = { status: 'review_rating_submitted', deliveredDate: '2026-10-01', returnPeriodDays };
    const endDate = `2026-10-${String(1 + returnPeriodDays).padStart(2, '0')}`;
    assert.deepEqual(getReturnWindow(order, endDate), { endDate, daysLeft: 1 });
    assert.equal(getReturnWindow(order, `2026-10-${String(2 + returnPeriodDays).padStart(2, '0')}`).daysLeft, 0);
  }
  assert.deepEqual(getReturnWindow({ status: 'delivered', deliveredDate: '2026-12-28' }, '2027-01-04'), {
    endDate: '2027-01-04', daysLeft: 1,
  });
});

test('review submission preserves delivery data; expiry advances Delivered and Review/Rating Submitted', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00') });
  rows = ['delivered', 'delivered', 'refund_form_filled', 'informed_mediator'].map((status, index) => ({
    id: `row-${index}`, order_id: `order-${index}`, status,
    order_date: '2026-10-01', delivered_date: '2026-10-01', return_period_days: 7,
  }));
  const store = () => useOrderStore.getState();
  await store().fetchOrders();
  assert.equal(store().orders[0].status, 'delivered', 'closing day must stay open');
  await store().updateOrderStatus('row-0', 'review_rating_submitted', { reviewRatingDate: '2026-10-08' });
  assert.equal(rows[0].delivered_date, '2026-10-01');
  assert.equal(rows[0].return_period_days, 7);
  assert.deepEqual(getReturnWindow(store().orders[0]), { endDate: '2026-10-08', daysLeft: 1 });

  t.mock.timers.setTime(new Date('2026-10-09T12:00:00').getTime());
  await store().fetchOrders();
  assert.deepEqual(store().orders.map((order) => order.status), [
    'refund_form_pending', 'refund_form_pending', 'refund_form_filled', 'informed_mediator',
  ]);
  assert.equal(rows[0].status, 'refund_form_pending', 'reviewed orders must persist the automatic transition');
  assert.equal(rows[0].review_rating_date, '2026-10-08', 'review history must be preserved');
  assert.equal(rows[1].status, 'refund_form_pending', 'automatic transition must persist');
  assert.deepEqual(getReturnWindow(store().orders[0]), { endDate: '2026-10-08', daysLeft: 0 });
  assert.deepEqual(getReturnWindow(store().orders[1]), { endDate: '2026-10-08', daysLeft: 0 });
  assert.equal(getReturnWindow(store().orders[2]), null);
});

test('Delivered and Review/Rating Submitted stay open through 23:59:59.999 and expire at the next midnight', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-01T00:00:00') });
  for (const returnDays of [undefined, 1, 3, 7, 10, 14]) {
    const day = 1 + (returnDays || 7);
    const closingDate = `2026-10-${String(day).padStart(2, '0')}`;
    rows = ['delivered', 'review_rating_submitted'].map((status, index) => ({
      id: `boundary-${index}`, order_id: `boundary-order-${index}`, status,
      order_date: '2026-10-01', delivered_date: '2026-10-01', return_period_days: returnDays,
    }));
    for (const time of ['00:00:00', '12:00:00', '23:59:59.999']) {
      t.mock.timers.setTime(new Date(`${closingDate}T${time}`).getTime());
      await useOrderStore.getState().fetchOrders();
      assert.deepEqual(rows.map((row) => row.status), ['delivered', 'review_rating_submitted']);
      for (const order of useOrderStore.getState().orders) {
        assert.deepEqual(getReturnWindow(order), { endDate: closingDate, daysLeft: 1 });
      }
    }
    const nextDate = `2026-10-${String(day + 1).padStart(2, '0')}`;
    t.mock.timers.setTime(new Date(`${nextDate}T00:00:00`).getTime());
    await useOrderStore.getState().fetchOrders();
    assert.deepEqual(rows.map((row) => row.status), ['refund_form_pending', 'refund_form_pending']);
    for (const order of useOrderStore.getState().orders) {
      assert.deepEqual(getReturnWindow(order), { endDate: closingDate, daysLeft: 0 });
    }
  }
});

test('reviewed orders without a delivery date are not automatically expired', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T12:00:00') });
  rows = [{
    id: 'review-without-delivery', order_id: 'review-without-delivery',
    status: 'review_rating_submitted', order_date: '2026-10-01',
    review_rating_date: '2026-10-08',
  }];
  await useOrderStore.getState().fetchOrders();
  assert.equal(rows[0].status, 'review_rating_submitted');
  assert.equal(useOrderStore.getState().orders[0].status, 'review_rating_submitted');
});

function installBrowserEvents() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.visibilityState = 'visible';
  return () => {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  };
}

test('open tabs refresh exactly at midnight, on resume, and stop after unmount', (t) => {
  const restoreBrowserEvents = installBrowserEvents();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-10-08T23:59:59.500') });
  const dates = [];
  const stop = watchLocalDate(() => dates.push(todayStr()));
  t.after(() => { stop(); restoreBrowserEvents(); });
  t.mock.timers.tick(499);
  assert.deepEqual(dates, []);
  t.mock.timers.tick(1);
  assert.deepEqual(dates, ['2026-10-09']);

  // Simulate a sleeping tab whose timeout was suspended across several days.
  t.mock.timers.setTime(new Date('2026-10-12T08:00:00').getTime());
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(dates.length, 1);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(dates.at(-1), '2026-10-12');
  window.dispatchEvent(new Event('focus'));
  assert.equal(dates.at(-1), '2026-10-12');

  stop();
  const count = dates.length;
  t.mock.timers.tick(2 * 24 * 60 * 60 * 1000);
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(dates.length, count);
});

test('midnight scheduling follows calendar days even when daylight saving changes their length', (t) => {
  const restoreBrowserEvents = installBrowserEvents();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-01T00:00:00') });
  let calls = 0;
  const stop = watchLocalDate(() => calls++);
  t.after(() => { stop(); restoreBrowserEvents(); });
  const lengthOfDay = new Date('2026-11-02T00:00:00').getTime() - Date.now();
  t.mock.timers.tick(lengthOfDay - 1);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
  assert.equal(todayStr(), '2026-11-02');
});
