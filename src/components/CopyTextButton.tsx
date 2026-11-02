'use client';

import toast from 'react-hot-toast';

export function CopyTextButton({ text, label = 'Order ID' }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
      }}
      className="px-1.5 py-0.5 text-[10px] bg-dashboard-bg border border-dashboard-border rounded text-text-muted hover:text-text-primary transition flex-shrink-0"
    >
      Copy
    </button>
  );
}
