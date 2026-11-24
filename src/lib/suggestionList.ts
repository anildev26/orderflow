export const TAP_MOVE_PX = 8;

export function shouldShowNameSuggestions(name: string, matchCount: number, openedByTyping: boolean): boolean {
  return openedByTyping && name.trim().length >= 1 && matchCount > 0;
}

export function pointerMovedPastTap(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = TAP_MOVE_PX,
): boolean {
  return Math.abs(endX - startX) >= threshold || Math.abs(endY - startY) >= threshold;
}
