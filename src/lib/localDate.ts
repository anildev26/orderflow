/** Notify at local midnight, and recheck after a browser tab resumes. */
export function watchLocalDate(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;

  function scheduleMidnight() {
    clearTimeout(timer);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    timer = setTimeout(refresh, midnight.getTime() - now.getTime());
  }

  function refresh() {
    onChange();
    scheduleMidnight();
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible') refresh();
  }

  scheduleMidnight();
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
