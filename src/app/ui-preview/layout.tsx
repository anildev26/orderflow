import { noIndexMetadata } from '@/lib/site';

export const metadata = noIndexMetadata;

export default function UiPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
