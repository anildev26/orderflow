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

test('review submission preserves delivery data across save and reload; expiry only advances Delivered', async (t) => {
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
    'review_rating_submitted', 'refund_form_pending', 'refund_form_filled', 'informed_mediator',
  ]);
  assert.equal(rows[1].status, 'refund_form_pending', 'automatic transition must persist');
  assert.deepEqual(getReturnWindow(store().orders[0]), { endDate: '2026-10-08', daysLeft: 0 });
  assert.deepEqual(getReturnWindow(store().orders[1]), { endDate: '2026-10-08', daysLeft: 0 });
  assert.equal(getReturnWindow(store().orders[2]), null);
});
