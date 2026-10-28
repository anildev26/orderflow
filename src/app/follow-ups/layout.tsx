import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { noIndexMetadata } from '@/lib/site';

export const metadata: Metadata = noIndexMetadata;

export default function FollowUpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-dashboard-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
