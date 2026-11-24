import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pointerMovedPastTap, shouldShowNameSuggestions } from './suggestionList.ts';

describe('shouldShowNameSuggestions', () => {
  it('stays closed on an empty field even when names exist', () => {
    assert.equal(shouldShowNameSuggestions('', 3, true), false);
    assert.equal(shouldShowNameSuggestions('   ', 3, true), false);
    assert.equal(shouldShowNameSuggestions('Saloni', 2, false), false);
  });

  it('opens after a typed character when there is a match', () => {
    assert.equal(shouldShowNameSuggestions(' s ', 1, true), true);
    assert.equal(shouldShowNameSuggestions('sel', 0, true), false);
  });
});

describe('pointerMovedPastTap', () => {
  it('treats a short press as a tap and a swipe as a scroll', () => {
    assert.equal(pointerMovedPastTap(0, 0, 3, 4), false);
    assert.equal(pointerMovedPastTap(0, 0, 0, 8), true);
    assert.equal(pointerMovedPastTap(10, 10, 20, 12), true);
  });
});
