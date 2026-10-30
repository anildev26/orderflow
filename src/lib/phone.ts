export const PHONE_CHECK_MESSAGE = 'Check this number';

const ALLOWED_PREFIXES = new Set(['', '0', '91', '091', '0091']);

export type PhoneParse =
  | { ok: true; empty: true }
  | { ok: true; empty: false; normalized: string; display: string }
  | { ok: false; message: typeof PHONE_CHECK_MESSAGE };

/** Digits only. Drops spaces, dashes, plus signs, brackets, and unicode marks. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Indian mobile stored as 91 + last 10 digits.
 * The prefix in front of those 10 digits may only be empty, 0, 91, 091, or 0091.
 */
export function normalizeIndianMobile(raw: string): PhoneParse {
  if (!raw || !raw.trim()) return { ok: true, empty: true };
  const digits = digitsOnly(raw);
  if (digits.length < 10) return { ok: false, message: PHONE_CHECK_MESSAGE };
  const national = digits.slice(-10);
  const prefix = digits.slice(0, -10);
  if (!ALLOWED_PREFIXES.has(prefix)) return { ok: false, message: PHONE_CHECK_MESSAGE };
  return { ok: true, empty: false, normalized: `91${national}`, display: formatIndianMobile(`91${national}`) };
}

export function formatIndianMobile(normalized: string | null | undefined): string {
  if (!normalized || !/^91\d{10}$/.test(normalized)) return '';
  const national = normalized.slice(2);
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

export function isNormalizedIndianMobile(value: string | null | undefined): value is string {
  return !!value && /^91\d{10}$/.test(value);
}

/** Blank WhatsApp chat. No prefilled message. */
export function waMeUrl(normalized: string): string {
  return `https://wa.me/${normalized}`;
}
