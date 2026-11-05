'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isLoading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
}

function ConfirmModalDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  requireReason,
  reasonPlaceholder,
  isLoading,
  onConfirm,
  onClose,
}: Omit<ConfirmModalProps, 'isOpen'>) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onClose]);

  const handleConfirm = async () => {
    if (requireReason && reason.trim().length < 5) {
      setError('Please provide an audit explanation of at least 5 characters.');
      return;
    }
    setError(null);
    await onConfirm(reason.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E5DFD2] p-6 space-y-5 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                variant === 'danger'
                  ? 'bg-red-50 text-red-600'
                  : variant === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-teal-50 text-teal-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-lg font-bold text-[#152220]">
                {title}
              </h3>
              <p className="text-sm text-[#576563] mt-0.5">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="text-[#576563] hover:text-[#152220] p-1.5 rounded-lg hover:bg-[#F3EFE6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason Input Field */}
        {requireReason && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#152220] uppercase tracking-wider">
              Audit Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={reasonPlaceholder}
              disabled={isLoading}
              className="w-full text-sm rounded-xl border border-[#E5DFD2] p-3 focus:outline-none focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent placeholder:text-[#576563]/50 transition-all resize-none"
            />
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5DFD2]/60">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-xl px-5 py-2 font-semibold shadow-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal(props: ConfirmModalProps) {
  if (!props.isOpen) return null;
  return <ConfirmModalDialog {...props} />;
}
