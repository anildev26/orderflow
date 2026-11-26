import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURE_CATALOG } from './featureCatalog.ts';
import { findExistingFeatures, findSimilarRequests, isQueryReady, matchesSearch, tokens } from './featureMatch.ts';

const top = (text: string) => findExistingFeatures(text)[0]?.item.id;

describe('tokens', () => {
  it('drops filler words and joins common phrases', () => {
    assert.deepEqual(tokens('Please add a dark mode'), ['theme']);
    assert.deepEqual(tokens('Follow-up with mediators'), ['followup', 'mediator']);
    assert.deepEqual(tokens('send on WhatsApp'), ['send', 'whatsapp']);
  });

  it('treats synonyms as the same word', () => {
    assert.deepEqual(tokens('download spreadsheet'), tokens('export excel'));
    assert.deepEqual(tokens('remind me'), tokens('notification'));
  });

  it('handles emoji, symbols and empty text without throwing', () => {
    assert.deepEqual(tokens(''), []);
    assert.deepEqual(tokens('😀 ₹ <script>'), ['script']);
    assert.deepEqual(tokens('   '), []);
  });
});

describe('isQueryReady', () => {
  it('waits for a meaningful word', () => {
    assert.equal(isQueryReady(''), false);
    assert.equal(isQueryReady('add'), false);
    assert.equal(isQueryReady('please add an option'), false);
    assert.equal(isQueryReady('orders'), false);
    assert.equal(isQueryReady('dark mode'), true);
    assert.equal(isQueryReady('export orders'), true);
  });
});

describe('findExistingFeatures', () => {
  it('finds the feature people most often ask for again', () => {
    assert.equal(top('remind mediators about pending refunds'), 'follow-ups');
    assert.equal(top('dark mode please'), 'theme-toggle');
    assert.equal(top('dark mode on the refund page, it is too bright'), 'theme-toggle');
    assert.equal(top('export my orders to excel'), 'export-csv');
    assert.equal(top('download all orders as csv'), 'export-csv');
    assert.equal(top('backup my data so I don\'t lose it'), 'json-backup');
    assert.equal(top('import old orders from excel sheet'), 'excel-import');
    assert.equal(top('add meesho platform'), 'custom-platforms');
    assert.equal(top('save mediator whatsapp number'), 'mediator-whatsapp');
    assert.equal(top('telegram bot to check order status'), 'telegram-bot');
    assert.equal(top('charts of monthly orders'), 'analytics');
    assert.equal(top('filter orders by platform'), 'filters-search');
    assert.equal(top('commission deal with flat amount'), 'commission-deal');
    assert.equal(top('countdown for return window'), 'return-window');
    assert.equal(top('autocomplete reviewer names'), 'name-suggestions');
  });

  it('does not claim a feature exists for genuinely new ideas', () => {
    assert.equal(top('PDF invoice per mediator every month'), undefined);
    assert.equal(top('login with google account'), undefined);
    assert.equal(top('multi language support hindi'), undefined);
    assert.equal(top('add new orders'), undefined);
    assert.equal(top(''), undefined);
  });

  it('returns at most two matches, best first', () => {
    const r = findExistingFeatures('whatsapp follow up mediator reminder');
    assert.ok(r.length <= 2);
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  });
});

describe('findSimilarRequests', () => {
  const requests = [
    { id: '1', title: 'Send follow-ups to several mediators at once', details: 'Pick 5 orders and send one reminder each' },
    { id: '2', title: 'Monthly statement per mediator', details: 'Export archived orders as PDF' },
    { id: '3', title: 'Show seller deductions in analytics', details: null },
    { id: '4', title: 'Dark mode on refund page', details: 'Too bright at night' },
  ];

  it('finds the same ask worded differently', () => {
    assert.equal(findSimilarRequests('bulk reminder to mediators', requests)[0]?.item.id, '1');
    assert.equal(findSimilarRequests('night theme for refund form', requests)[0]?.item.id, '4');
    assert.equal(findSimilarRequests('statement for each mediator', requests)[0]?.item.id, '2');
  });

  it('ignores unrelated requests and the excluded one', () => {
    assert.deepEqual(findSimilarRequests('login with google', requests), []);
    assert.deepEqual(findSimilarRequests('Dark mode on refund page', requests, { excludeId: '4' }), []);
  });
});

describe('matchesSearch', () => {
  it('matches every word, allowing prefixes', () => {
    assert.equal(matchesSearch('mediator stat', 'Monthly statement per mediator'), true);
    assert.equal(matchesSearch('mediator invoice', 'Monthly statement per mediator'), false);
    assert.equal(matchesSearch('', 'anything'), true);
  });
});

describe('FEATURE_CATALOG', () => {
  it('has unique ids that fit the database column and safe in-app links', () => {
    const ids = new Set<string>();
    for (const f of FEATURE_CATALOG) {
      assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
      ids.add(f.id);
      assert.ok(f.id.length <= 60);
      assert.match(f.href, /^\/[a-z0-9-/]*$/);
    }
  });
});
