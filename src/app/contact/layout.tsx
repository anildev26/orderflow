import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact OrderFlow support',
  description: 'Email, Telegram, Discord, and WhatsApp support for OrderFlow. No account needed.',
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
