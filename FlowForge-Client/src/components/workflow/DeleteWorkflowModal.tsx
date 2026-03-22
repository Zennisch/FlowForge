'use client';

import { useEffect } from 'react';

interface DeleteWorkflowModalProps {
  open: boolean;
  workflowName?: string;
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteWorkflowModal({
  open,
  workflowName,
  isPending,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteWorkflowModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPending, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--color-overlay-modal) px-4">
      <div className="w-full max-w-md rounded-2xl border border-(--color-border) bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">Delete workflow</h2>
        <p className="mt-2 text-sm text-(--color-text-secondary)">
          This action cannot be undone. Confirm deleting
          <span className="font-semibold text-(--color-text-primary)">
            {' '}
            {workflowName ?? 'this workflow'}
          </span>
          .
        </p>

        {errorMessage ? (
          <p className="mt-3 rounded-lg bg-(--color-error-light) px-3 py-2 text-sm text-(--color-error)">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
