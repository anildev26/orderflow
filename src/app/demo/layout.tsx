import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OrderFlow demo — sample order and refund tracker',
  alternates: { canonical: '/demo' },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
