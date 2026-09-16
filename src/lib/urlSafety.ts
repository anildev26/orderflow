// Only http(s) links are safe to store/render as a clickable href — anything
// else (javascript:, data:, vbscript:, ...) executes in the clicking browser's
// session instead of navigating.
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
