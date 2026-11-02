/**
 * Production (`next start`, Vercel) rejects the webhook when TELEGRAM_WEBHOOK_SECRET
 * is unset. `next dev` keeps NODE_ENV as development so local lookups still work.
 * A configured secret is checked in every environment.
 */
export function rejectTelegramWebhook(
  secret: string | undefined,
  isProduction: boolean,
  headerToken: string | null,
): boolean {
  if (!secret) return isProduction;
  return headerToken !== secret;
}
