'use client';

import Link from 'next/link';
import { Edit3, List, MoreVertical, Trash2, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Workflow } from '@/types/workflow.types';

interface WorkflowContextMenuProps {
  workflow: Workflow;
  onDelete: (workflow: Workflow) => void;
  onCopyId: (workflowId: string) => Promise<void>;
}

export function WorkflowContextMenu({ workflow, onDelete, onCopyId }: WorkflowContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, origin: 'top' as 'top' | 'bottom' });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current || typeof window === 'undefined') {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 216;
    const menuHeight = 184;
    const viewportPadding = 8;

    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );

    const canOpenDown = rect.bottom + 8 + menuHeight <= window.innerHeight - viewportPadding;
    const top = canOpenDown
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - menuHeight - 8);

    setPosition({ top, left, origin: canOpenDown ? 'top' : 'bottom' });
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const clickedTrigger = !!(target && triggerRef.current?.contains(target));
      const clickedMenu = !!(target && menuRef.current?.contains(target));
      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onViewportUpdate = () => {
      updatePosition();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportUpdate);
    window.addEventListener('scroll', onViewportUpdate, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportUpdate);
      window.removeEventListener('scroll', onViewportUpdate, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title="More actions"
        aria-label="More actions"
        aria-expanded={open}
        aria-controls={`workflow-menu-${workflow.id}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-(--color-text-secondary) transition-colors hover:border-(--color-border) hover:bg-(--color-surface-hover)"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={`workflow-menu-${workflow.id}`}
              ref={menuRef}
              className="fixed z-[120] min-w-52 overflow-hidden rounded-md border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
              style={{ top: position.top, left: position.left }}
            >
              <Link
                href={`/workflows/${workflow.id}`}
                onClick={() => {
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Edit / View Canvas
              </Link>

              <Link
                href={`/workflows/${workflow.id}/executions`}
                onClick={() => {
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <List className="h-4 w-4" aria-hidden="true" />
                View Executions
              </Link>

              <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

              <button
                type="button"
                onClick={async () => {
                  await onCopyId(workflow.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy ID
              </button>

              <button
                type="button"
                onClick={() => {
                  onDelete(workflow);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>

              <span
                className="pointer-events-none absolute left-0 right-0 h-0.5"
                style={position.origin === 'top' ? { top: 0 } : { bottom: 0 }}
                aria-hidden="true"
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
