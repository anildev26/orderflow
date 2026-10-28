import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/site';

export const metadata: Metadata = noIndexMetadata;

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
