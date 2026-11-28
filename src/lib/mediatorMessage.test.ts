import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyLink, extractLinks, messageView } from './mediatorMessage.ts';

const safe = (u: string) => /^https?:\/\//i.test(u);

describe('extractLinks', () => {
  it('drops punctuation stuck to the end', () => {
    const l = extractLinks('Form: https://forms.gle/AbC123. Product (https://amzn.to/3xYz), thanks!');
    assert.deepEqual(l.map((x) => x.url), ['https://forms.gle/AbC123', 'https://amzn.to/3xYz']);
  });
  it('keeps a bracket that belongs to the link', () => {
    assert.deepEqual(extractLinks('see https://en.wikipedia.org/wiki/Foo_(bar) ok').map((x) => x.url), ['https://en.wikipedia.org/wiki/Foo_(bar)']);
  });
  it('finds links typed without https://', () => {
    assert.deepEqual(extractLinks('fill forms.gle/XyZ987 after review').map((x) => x.url), ['https://forms.gle/XyZ987']);
    assert.deepEqual(extractLinks('www.forms.gle/Q1').map((x) => x.url), ['https://www.forms.gle/Q1']);
  });
  it('does not repeat the same link', () => {
    assert.equal(extractLinks('https://forms.gle/a https://forms.gle/a.').length, 1);
  });
  it('handles empty input and plain text', () => {
    assert.deepEqual(extractLinks(''), []);
    assert.deepEqual(extractLinks(null), []);
    assert.deepEqual(extractLinks('Refund in 30 days. Less 100.'), []);
  });
});

describe('classifyLink', () => {
  it('knows forms and products', () => {
    assert.equal(classifyLink('https://forms.gle/x'), 'form');
    assert.equal(classifyLink('https://docs.google.com/forms/d/e/1FAIp/viewform'), 'form');
    assert.equal(classifyLink('https://docs.google.com/spreadsheets/d/1'), 'other');
    assert.equal(classifyLink('https://www.amazon.in/dp/B0X'), 'product');
    assert.equal(classifyLink('https://dl.flipkart.com/s/abc'), 'product');
    assert.equal(classifyLink('https://amzn.to/3xYz'), 'product');
    assert.equal(classifyLink('https://bit.ly/abc'), 'other');
    assert.equal(classifyLink('https://refunds.example.com/claim'), 'form');
  });
});

describe('messageView', () => {
  it('uses the saved link first and still shows the message', () => {
    const v = messageView('Refund in 30 days after form', 'https://forms.gle/saved', safe);
    assert.equal(v.formUrl, 'https://forms.gle/saved');
    assert.equal(v.hasMore, true);
  });
  it('a text-only message is shown', () => {
    const v = messageView('Less 100. Refund within 30 working days.', undefined, safe);
    assert.equal(v.formUrl, null);
    assert.equal(v.hasMore, true);
  });
  it('a message that is only the form link becomes the Form button and nothing else', () => {
    const v = messageView('https://forms.gle/OnlyLink9 ', undefined, safe);
    assert.equal(v.formUrl, 'https://forms.gle/OnlyLink9');
    assert.equal(v.hasMore, false);
  });
  it('a message that is one short link still opens as the form, like before', () => {
    const v = messageView('https://bit.ly/refund123', undefined, safe);
    assert.equal(v.formUrl, 'https://bit.ly/refund123');
    assert.equal(v.hasMore, false);
  });
  it('a lone product link is never called the refund form', () => {
    const v = messageView('https://amzn.to/3xYz', undefined, safe);
    assert.equal(v.formUrl, null);
    assert.equal(v.hasMore, true);
  });
  it('picks the form link out of a mixed message', () => {
    const v = messageView('Product https://amzn.to/3xYz and form https://docs.google.com/forms/d/e/1/viewform (30 days)', undefined, safe);
    assert.equal(v.formUrl, 'https://docs.google.com/forms/d/e/1/viewform');
    assert.equal(v.links.length, 2);
    assert.equal(v.hasMore, true);
  });
  it('does not guess when there are two form links', () => {
    assert.equal(messageView('https://forms.gle/a or https://forms.gle/b', undefined, safe).formUrl, null);
  });
  it('ignores an unsafe saved link', () => {
    assert.equal(messageView('', 'javascript:alert(1)', safe).formUrl, null);
  });
});
