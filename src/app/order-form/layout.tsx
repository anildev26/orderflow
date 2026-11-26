import { noIndexMetadata } from '@/lib/site';
import BootSplash from '@/components/loading/BootSplash';

export const metadata = noIndexMetadata;

export default function OrderFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BootSplash />
      {children}
    </>
  );
}
