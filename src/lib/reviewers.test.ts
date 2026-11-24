import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterReviewers, mergeReviewerSuggestions, planReviewerSave, reviewerSaveError, type ReviewerRecord } from './reviewers.ts';

const aaditya: ReviewerRecord = { id: '1', name: 'Aaditya', nameKey: 'aaditya' };
const anil: ReviewerRecord = { id: '2', name: 'Anil Sahu Meesho', nameKey: 'anil sahu meesho' };

describe('reviewerSaveError', () => {
  it('blocks the same name after spacing and case changes', () => {
    assert.equal(reviewerSaveError([aaditya], '  AADITYA '), 'Already in your reviewers');
  });

  it('allows a different name', () => {
    assert.equal(reviewerSaveError([aaditya], 'Anil Sahu'), null);
  });

  it('ignores the row being edited', () => {
    assert.equal(reviewerSaveError([aaditya], 'Aaditya', '1'), null);
  });

  it('rejects an empty name', () => {
    assert.equal(reviewerSaveError([], '   '), 'Enter a name');
  });
});

describe('planReviewerSave', () => {
  it('links an existing name without inserting', () => {
    const plan = planReviewerSave({
      name: 'aaditya',
      saveToList: true,
      pickedId: null,
      list: [aaditya, anil],
    });
    assert.equal(plan.action, 'link');
    if (plan.action === 'link') assert.equal(plan.reviewer.id, '1');
  });

  it('does not replace the order text when the name is already listed and save is unchecked', () => {
    const plan = planReviewerSave({
      name: 'aaditya',
      saveToList: false,
      pickedId: null,
      list: [aaditya],
    });
    assert.deepEqual(plan, { action: 'order-only', name: 'aaditya' });
  });

  it('stores the name on the order only when save is unchecked', () => {
    const plan = planReviewerSave({
      name: '  New Reviewer ',
      saveToList: false,
      pickedId: null,
      list: [aaditya],
    });
    assert.deepEqual(plan, { action: 'order-only', name: 'New Reviewer' });
  });

  it('creates a list row when save is checked', () => {
    const plan = planReviewerSave({
      name: 'New Reviewer',
      saveToList: true,
      pickedId: null,
      list: [aaditya],
    });
    assert.deepEqual(plan, { action: 'create', name: 'New Reviewer', nameKey: 'new reviewer' });
  });

  it('keeps a picked name linked when nothing changed', () => {
    const plan = planReviewerSave({
      name: 'Aaditya',
      saveToList: false,
      pickedId: '1',
      list: [aaditya],
    });
    assert.equal(plan.action, 'link');
  });

  it('clears an empty name', () => {
    assert.deepEqual(
      planReviewerSave({ name: '  ', saveToList: true, pickedId: null, list: [] }),
      { action: 'clear' },
    );
  });
});

const saloni: ReviewerRecord = { id: '3', name: 'Saloni Selvan', nameKey: 'saloni selvan' };

describe('filterReviewers', () => {
  const list = [saloni, aaditya];

  it('matches a trimmed, case-insensitive substring anywhere in the name', () => {
    assert.deepEqual(filterReviewers(list, 'sel').map((r) => r.id), ['3']);
    assert.deepEqual(filterReviewers(list, '  SEL ').map((r) => r.id), ['3']);
    assert.deepEqual(filterReviewers(list, 'sal').map((r) => r.id), ['3']);
  });

  it('returns the full list when the query is empty', () => {
    assert.equal(filterReviewers(list, '   ').length, 2);
  });
});

describe('mergeReviewerSuggestions', () => {
  it('keeps a saved row instead of the same name on an order', () => {
    const merged = mergeReviewerSuggestions([saloni], ['SALONI   SELVAN', 'Anil Sahu']);
    assert.deepEqual(merged.map((r) => ({ id: r.id, name: r.name })), [
      { id: null, name: 'Anil Sahu' },
      { id: '3', name: 'Saloni Selvan' },
    ]);
  });

  it('keeps the first spelling of an order-only name and drops blanks', () => {
    const merged = mergeReviewerSuggestions([], ['  SALONI   SELVAN ', '', 'saloni selvan']);
    assert.deepEqual(merged, [{ id: null, name: 'SALONI SELVAN', nameKey: 'saloni selvan' }]);
  });
});
