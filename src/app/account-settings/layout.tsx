import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/site';
import BootSplash from '@/components/loading/BootSplash';

export const metadata: Metadata = noIndexMetadata;

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BootSplash />
      {children}
    </>
  );
}
