'use client';

import { OrderStatus, STATUS_OPTIONS } from '@/types/order';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statusFilter: OrderStatus | 'all';
  onStatusFilterChange: (status: OrderStatus | 'all') => void;
  onApply: () => void;
  onReset: () => void;
}

const filterStatusOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STATUS_OPTIONS.filter((opt) => opt.value !== 'payment_received'),
];

export default function FilterPanel({
  isOpen,
  onClose,
  statusFilter,
  onStatusFilterChange,
  onApply,
  onReset,
}: FilterPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute top-0 right-0 h-full w-80 bg-dashboard-card shadow-2xl filter-panel flex flex-col border-l border-dashboard-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-dashboard-border">
          <h2 className="text-lg font-bold text-text-primary">Filters</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dashboard-card-hover text-text-muted hover:text-text-primary transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-3">Status</h3>
            <div className="space-y-2">
              {filterStatusOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={statusFilter === opt.value}
                    onChange={() => onStatusFilterChange(opt.value)}
                    className="w-4 h-4 text-accent-blue"
                  />
                  <span className="text-sm text-text-secondary">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-dashboard-border flex gap-3">
          <button onClick={onApply} className="flex-1 py-2.5 bg-accent-blue text-white font-medium rounded-lg hover:bg-blue-600 transition">
            Apply
          </button>
          <button onClick={onReset} className="px-6 py-2.5 border border-dashboard-border text-text-secondary font-medium rounded-lg hover:bg-dashboard-card-hover hover:text-text-primary transition">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
