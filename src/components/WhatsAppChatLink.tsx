import { waMeUrl } from '@/lib/phone';

export function WhatsAppGlyph({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 3.4A11 11 0 0 0 2.1 16.9L1 23l6.3-1.6A11 11 0 0 0 12 23a11 11 0 0 0 8.5-19.6zM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-3.7.9 1-3.6-.2-.3A9 9 0 1 1 12 21zm5.2-6.7c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.2-.7.9-.9 1.1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.3 8.1 8.1 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.4c.1-.2.2-.3.2-.5s0-.4-.1-.5-.8-1.8-1-2.5-.4-.6-.6-.6h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4.1c.6.3 1.1.4 1.6.5.7.2 1.3.1 1.8-.1a2.7 2.7 0 0 0 1.2-1.8c.1-.3.1-.6 0-.7s-.3-.2-.6-.3z" />
    </svg>
  );
}

export function WhatsAppChatLink({
  phone,
  name,
  compact = false,
}: {
  phone: string;
  name: string;
  compact?: boolean;
}) {
  const label = `Chat with ${name} on WhatsApp`;
  return (
    <a
      href={waMeUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={compact
        ? 'inline-flex items-center justify-center w-5 h-5 rounded-md text-[#25D366] hover:bg-[#25D366]/15 flex-shrink-0'
        : 'inline-flex items-center gap-1 text-[11px] font-semibold text-[#25D366] hover:underline flex-shrink-0'}
    >
      <WhatsAppGlyph className="w-3.5 h-3.5" />
      {compact ? null : 'Chat'}
    </a>
  );
}
