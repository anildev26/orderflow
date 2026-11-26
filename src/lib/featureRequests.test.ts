import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardTabFor,
  cleanText,
  friendlyError,
  isDuplicateError,
  isMissingSchemaError,
  isOpenForVotes,
  isSafeHttpsUrl,
  isUnread,
  makeTitle,
  normaliseVersion,
  sortRequests,
  validateLength,
  validateRequestText,
  whatsAppLink,
  whatsAppText,
} from './featureRequests.ts';

describe('validateRequestText', () => {
  it('accepts short but real asks and any characters', () => {
    assert.equal(validateRequestText('Dark mode'), null);
    assert.equal(validateRequestText('₹ totals per mediator 😀 <b>"quoted"</b> & it\'s ok'), null);
  });
  it('rejects empty, whitespace-only and too-long text', () => {
    assert.ok(validateRequestText(''));
    assert.ok(validateRequestText('     '));
    assert.ok(validateRequestText('hi'));
    assert.ok(validateRequestText('x'.repeat(501)));
    assert.equal(validateRequestText('x'.repeat(500)), null);
  });
});

describe('cleanText / validateLength', () => {
  it('strips invisible control characters but keeps newlines', () => {
    assert.equal(cleanText('  a\u0000b\u0007c\nd  '), 'abc\nd');
  });
  it('checks empty and max', () => {
    assert.equal(validateLength('   ', 10, 'empty'), 'empty');
    assert.ok(validateLength('x'.repeat(11), 10, 'empty'));
    assert.equal(validateLength('ok', 10, 'empty'), null);
  });
});

describe('makeTitle', () => {
  it('matches the database rule', () => {
    assert.equal(makeTitle('  Dark   mode  \nfor refund page'), 'Dark mode');
    assert.equal(makeTitle('\nhello world'), 'hello world');
    const long = makeTitle('word '.repeat(60));
    assert.ok(long.length <= 120);
    assert.ok(long.endsWith('…'));
  });
});

describe('normaliseVersion', () => {
  it('accepts versions with or without v', () => {
    assert.equal(normaliseVersion('1.2.0'), 'v1.2.0');
    assert.equal(normaliseVersion(' v1.1.20 '), 'v1.1.20');
    assert.equal(normaliseVersion('latest'), null);
    assert.equal(normaliseVersion(''), null);
  });
});

describe('isSafeHttpsUrl', () => {
  it('allows only https links', () => {
    assert.equal(isSafeHttpsUrl('https://cal.com/anil/15min'), true);
    assert.equal(isSafeHttpsUrl('http://cal.com'), false);
    assert.equal(isSafeHttpsUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpsUrl('https://a.com/"><script>'), false);
    assert.equal(isSafeHttpsUrl(null), false);
  });
});

describe('friendlyError', () => {
  it('shows our own server messages as written', () => {
    assert.equal(
      friendlyError({ message: 'fr_rate_limited: You can post up to 10 requests a day. Please try again tomorrow.' }),
      'You can post up to 10 requests a day. Please try again tomorrow.',
    );
  });
  it('never shows raw database errors', () => {
    assert.match(friendlyError(new TypeError('Failed to fetch')), /internet connection/);
    assert.match(friendlyError({ code: '42501', message: 'new row violates row-level security policy' }), /permission/);
    assert.match(friendlyError({ code: '23514', message: 'violates check constraint "x"' }), /check what you entered/i);
    assert.equal(friendlyError(undefined), 'Something went wrong. Please try again.');
    assert.equal(friendlyError({ message: 'weird internal' }), 'Something went wrong. Please try again.');
  });
  it('detects missing schema and duplicates', () => {
    assert.equal(isMissingSchemaError({ code: '42703', message: 'column feature_requests.status does not exist' }), true);
    assert.equal(isMissingSchemaError({ code: 'PGRST202', message: 'Could not find the function' }), true);
    assert.equal(isMissingSchemaError({ code: '42501' }), false);
    assert.equal(isDuplicateError({ code: '23505' }), true);
  });
});

describe('status helpers', () => {
  it('maps statuses to tabs and vote rules', () => {
    assert.equal(boardTabFor('new'), 'open');
    assert.equal(boardTabFor('under_review'), 'open');
    assert.equal(boardTabFor('already_exists'), 'closed');
    assert.equal(isOpenForVotes('planned'), true);
    assert.equal(isOpenForVotes('shipped'), false);
    assert.equal(isOpenForVotes('not_planned'), false);
  });
});

describe('isUnread', () => {
  const req = { userId: 'me', createdAt: '2026-11-01T00:00:00Z', lastUpdateAt: '2026-11-10T00:00:00Z' };
  it('flags updates after the user last looked', () => {
    assert.equal(isUnread(req, { userId: 'me' }), true);
    assert.equal(isUnread(req, { userId: 'me', seenAt: '2026-11-11T00:00:00Z' }), false);
    assert.equal(isUnread(req, { userId: 'other', myVoteAt: '2026-11-05T00:00:00Z' }), true);
    assert.equal(isUnread(req, { userId: 'other', myVoteAt: '2026-11-12T00:00:00Z' }), false);
  });
  it('ignores requests the user does not follow, or with no update', () => {
    assert.equal(isUnread(req, { userId: 'other' }), false);
    assert.equal(isUnread({ ...req, lastUpdateAt: null }, { userId: 'me' }), false);
    assert.equal(isUnread(req, { userId: null }), false);
  });
});

describe('sortRequests', () => {
  const now = Date.parse('2026-11-26T00:00:00Z');
  const list = [
    { id: 'old-popular', likes: 30, createdAt: '2026-08-01T00:00:00Z', lastUpdateAt: null },
    { id: 'new-hot', likes: 4, createdAt: '2026-11-25T00:00:00Z', lastUpdateAt: '2026-11-25T10:00:00Z' },
    { id: 'quiet', likes: 2, createdAt: '2026-10-01T00:00:00Z', lastUpdateAt: null },
  ];
  it('trending lets recent activity beat old totals', () => {
    const recent = new Map([['new-hot', 4]]);
    assert.deepEqual(sortRequests(list, 'trending', { recentVotes: recent, now }).map((r) => r.id), ['new-hot', 'old-popular', 'quiet']);
  });
  it('top, newest and updated', () => {
    assert.deepEqual(sortRequests(list, 'top').map((r) => r.id), ['old-popular', 'new-hot', 'quiet']);
    assert.deepEqual(sortRequests(list, 'newest').map((r) => r.id), ['new-hot', 'quiet', 'old-popular']);
    assert.equal(sortRequests(list, 'updated')[0].id, 'new-hot');
  });
  it('does not mutate the input', () => {
    const before = list.map((r) => r.id).join();
    sortRequests(list, 'top');
    assert.equal(list.map((r) => r.id).join(), before);
  });
});

describe('whatsApp helpers', () => {
  it('encodes the message safely', () => {
    const link = whatsAppLink(whatsAppText('Export & "share" #1'));
    assert.ok(link.startsWith('https://wa.me/919082146640?text='));
    assert.ok(!link.includes(' '));
    assert.ok(decodeURIComponent(link.split('text=')[1]).includes('Export & "share" #1'));
  });
});
