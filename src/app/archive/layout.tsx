import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import BootSplash from '@/components/loading/BootSplash';
import { noIndexMetadata } from '@/lib/site';

export const metadata: Metadata = noIndexMetadata;

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-dashboard-bg">
      <BootSplash />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
