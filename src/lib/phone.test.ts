import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeIndianMobile, PHONE_CHECK_MESSAGE } from './phone.ts';

describe('normalizeIndianMobile', () => {
  const ok = (raw: string) => {
    const parsed = normalizeIndianMobile(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || parsed.empty) throw new Error(`expected a number for ${raw}`);
    assert.equal(parsed.normalized, '919876543210');
    assert.equal(parsed.display, '+91 98765 43210');
  };

  it('accepts the common Indian formats', () => {
    ok('9876543210');
    ok('+91 98765 43210');
    ok('+91-98765-43210');
    ok('(098765) 43210');
    ok('091 9876543210');
    ok('919876543210');
    ok('00919876543210');
    ok('0 98765 43210');
  });

  it('strips unicode spaces and LRM marks', () => {
    ok('+\u200e91\u00a098765\u202f43210');
  });

  it('treats a blank value as no number', () => {
    const parsed = normalizeIndianMobile('   ');
    assert.deepEqual(parsed, { ok: true, empty: true });
  });

  it('rejects fewer than 10 digits', () => {
    const parsed = normalizeIndianMobile('98765');
    assert.deepEqual(parsed, { ok: false, message: PHONE_CHECK_MESSAGE });
  });

  it('rejects a foreign country code in front of the last 10 digits', () => {
    const parsed = normalizeIndianMobile('+44 7911 123456');
    assert.equal(parsed.ok, false);
  });
});
