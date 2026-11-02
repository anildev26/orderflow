import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rejectTelegramWebhook } from './telegramWebhookAuth.ts';

describe('rejectTelegramWebhook', () => {
  it('fails closed in production when the secret is missing', () => {
    assert.equal(rejectTelegramWebhook(undefined, true, null), true);
    assert.equal(rejectTelegramWebhook('', true, 'anything'), true);
  });

  it('allows local dev when the secret is missing', () => {
    assert.equal(rejectTelegramWebhook(undefined, false, null), false);
    assert.equal(rejectTelegramWebhook('', false, null), false);
  });

  it('checks the header whenever a secret is set', () => {
    assert.equal(rejectTelegramWebhook('s3cret', true, 's3cret'), false);
    assert.equal(rejectTelegramWebhook('s3cret', false, 's3cret'), false);
    assert.equal(rejectTelegramWebhook('s3cret', true, null), true);
    assert.equal(rejectTelegramWebhook('s3cret', true, 'nope'), true);
    assert.equal(rejectTelegramWebhook('s3cret', false, 'nope'), true);
  });
});
