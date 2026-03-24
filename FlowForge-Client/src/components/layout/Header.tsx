'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useExecutions, useExecutionSummary } from '@/hooks/useExecutions';
import { useWorkflows } from '@/hooks/useWorkflows';
import type { Execution } from '@/types/execution.types';
import type { Workflow } from '@/types/workflow.types';
import {
  Bell,
  ChevronRight,
  Command,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Workflow as WorkflowIcon,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface PaletteResult {
  id: string;
  label: string;
  hint: string;
  href: string;
  kind: 'workflow' | 'execution';
}

function shortId(value: string): string {
  return value.length > 12 ? value.slice(-12) : value;
}

function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase();
}

function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/workflows') {
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Workflows', isCurrent: true },
    ];
  }

  if (pathname === '/workflows/new') {
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Workflows', href: '/workflows' },
      { label: 'New', isCurrent: true },
    ];
  }

  if (/^\/workflows\/[^/]+$/.test(pathname)) {
    const workflowId = pathname.split('/')[2] ?? '';
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Workflows', href: '/workflows' },
      { label: shortId(workflowId), isCurrent: true },
    ];
  }

  if (/^\/workflows\/[^/]+\/executions$/.test(pathname)) {
    const workflowId = pathname.split('/')[2] ?? '';
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Workflows', href: '/workflows' },
      { label: shortId(workflowId), href: `/workflows/${workflowId}` },
      { label: 'Executions', isCurrent: true },
    ];
  }

  if (pathname === '/executions') {
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Executions', isCurrent: true },
    ];
  }

  if (/^\/executions\/[^/]+$/.test(pathname)) {
    const executionId = pathname.split('/')[2] ?? '';
    return [
      { label: 'FlowForge', href: '/workflows' },
      { label: 'Executions', href: '/executions' },
      { label: shortId(executionId), isCurrent: true },
    ];
  }

  return [
    { label: 'FlowForge', href: '/workflows' },
    { label: 'Dashboard', isCurrent: true },
  ];
}

function buildWorkflowResults(workflows: Workflow[], query: string): PaletteResult[] {
  if (!query) {
    return workflows.slice(0, 5).map((workflow) => ({
      id: workflow.id,
      label: workflow.name,
      hint: shortId(workflow.id),
      href: `/workflows/${workflow.id}`,
      kind: 'workflow',
    }));
  }

  return workflows
    .filter((workflow) => {
      const name = workflow.name.toLowerCase();
      const id = workflow.id.toLowerCase();
      return name.includes(query) || id.includes(query);
    })
    .slice(0, 6)
    .map((workflow) => ({
      id: workflow.id,
      label: workflow.name,
      hint: shortId(workflow.id),
      href: `/workflows/${workflow.id}`,
      kind: 'workflow',
    }));
}

function buildExecutionResults(executions: Execution[]): PaletteResult[] {
  return executions.slice(0, 8).map((execution) => ({
    id: execution.id,
    label: execution.idempotencyKey || `Execution ${shortId(execution.id)}`,
    hint: `${execution.status} · ${shortId(execution.id)}`,
    href: `/executions/${execution.id}`,
    kind: 'execution',
  }));
}

export function Header({ isDarkMode, onToggleSidebar, onToggleTheme }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const workflowsQuery = useWorkflows();
  const searchTerm = normalizeQueryValue(searchQuery);
  const shouldSearchExecutions = isPaletteOpen && searchTerm.length > 0;
  const executionsSearchQuery = useExecutions(
    {
      q: searchTerm,
      limit: 8,
    },
    {
      enabled: shouldSearchExecutions,
    }
  );
  const summaryQuery = useExecutionSummary();

  const breadcrumbs = useMemo(() => createBreadcrumbs(pathname), [pathname]);
  const isWorkflowListPage = pathname === '/workflows';
  const isSearchLoading = executionsSearchQuery.isFetching || workflowsQuery.isFetching;
  const hasQuery = searchTerm.length > 0;

  const [isMacShortcut, setIsMacShortcut] = useState(false);

  useEffect(() => {
    setIsMacShortcut(/mac/i.test(window.navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
        if (!isTypingTarget) {
          event.preventDefault();
          setIsPaletteOpen(true);
        }
      }

      if (event.key === 'Escape') {
        setIsPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const shortcutLabel = isMacShortcut ? '⌘ K' : 'Ctrl K';

  const workflowResults = useMemo(() => {
    return buildWorkflowResults(workflowsQuery.data ?? [], searchTerm);
  }, [workflowsQuery.data, searchTerm]);

  const executionResults = useMemo(() => {
    return buildExecutionResults(executionsSearchQuery.data?.items ?? []);
  }, [executionsSearchQuery.data?.items]);

  const notificationCount =
    (summaryQuery.data?.counts.failed ?? 0) + (summaryQuery.data?.counts.compensating ?? 0);

  const closePalette = () => {
    setIsPaletteOpen(false);
  };

  const navigateFromPalette = (href: string) => {
    setIsPaletteOpen(false);
    router.push(href);
  };

  const handlePaletteKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const firstResult = executionResults[0] || workflowResults[0];
      if (firstResult) {
        navigateFromPalette(firstResult.href);
      }
    }
  };

  return (
    <>
      <header className="z-20 border-b border-(--shell-border) bg-(--shell-header-bg) backdrop-blur">
        <div className="grid h-16 grid-cols-1 items-center gap-3 px-4 sm:grid-cols-[auto_1fr_auto] sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Open sidebar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Breadcrumb">
              {breadcrumbs.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-1">
                  {item.href && !item.isCurrent ? (
                    <Link
                      href={item.href}
                      className="rounded px-1.5 py-0.5 text-(--shell-muted) transition-colors hover:text-(--shell-text)"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        item.isCurrent
                          ? 'rounded px-1.5 py-0.5 font-medium text-(--shell-accent)'
                          : 'rounded px-1.5 py-0.5 text-(--shell-muted)'
                      }
                    >
                      {item.label}
                    </span>
                  )}

                  {index < breadcrumbs.length - 1 ? (
                    <ChevronRight className="h-3.5 w-3.5 text-(--shell-muted)" />
                  ) : null}
                </div>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="mx-auto hidden h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-(--shell-border) bg-(--shell-panel-bg) px-3 text-left text-sm text-(--shell-muted) transition-colors hover:bg-(--shell-hover) sm:flex"
            aria-label="Open global search"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search workflows, executions, or events...</span>
            <span className="ml-auto rounded-md border border-(--shell-border) bg-(--shell-panel-bg) px-1.5 py-0.5 text-[11px] font-medium text-(--shell-text)">
              {shortcutLabel}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <div className="relative">
              <ZButton
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Notifications"
                className="h-9 w-9 border border-(--shell-border) bg-(--shell-panel-bg) text-(--shell-muted) hover:bg-(--shell-hover) hover:text-(--shell-text)"
                iconStart={<Bell className="h-4 w-4" />}
              />
              {notificationCount > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </div>

            <ZButton
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={onToggleTheme}
              className="h-9 w-9 border border-(--shell-border) bg-(--shell-panel-bg) text-(--shell-muted) hover:bg-(--shell-hover) hover:text-(--shell-text)"
              iconStart={isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            />

            {isWorkflowListPage ? (
              <ZButton
                as={Link}
                href="/workflows/new"
                variant="primary"
                size="sm"
                iconStart={<Plus className="h-4 w-4" />}
                className="hidden rounded-lg px-3 sm:inline-flex"
              >
                New Workflow
              </ZButton>
            ) : null}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isPaletteOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm"
            role="dialog"
            aria-modal
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close command palette"
              onClick={closePalette}
            />

            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative mx-auto mt-20 w-[min(880px,92vw)] rounded-2xl border border-(--shell-border) bg-(--shell-panel-bg) p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-(--shell-text)">Command Palette</p>
                <div className="flex items-center gap-1 text-xs text-(--shell-muted)">
                  <Command className="h-3.5 w-3.5" />
                  <span>{shortcutLabel}</span>
                </div>
              </div>

              <ZTextInput
                fullWidth
                autoFocus
                size="sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(String(event.target.value))}
                onKeyDown={handlePaletteKeyDown}
                iconStart={<Search className="h-4 w-4" />}
                placeholder="Search by workflow name, execution id, or idempotency key"
              />

              <div className="mt-4 max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--shell-muted)">
                    Workflows
                  </p>
                  <div className="space-y-1">
                    {workflowResults.map((result) => (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        onClick={() => navigateFromPalette(result.href)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-(--shell-hover)"
                      >
                        <WorkflowIcon className="h-4 w-4 text-sky-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-(--shell-text)">{result.label}</p>
                          <p className="truncate text-xs text-(--shell-muted)">{result.hint}</p>
                        </div>
                      </button>
                    ))}

                    {workflowResults.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-(--shell-border) px-3 py-2 text-sm text-(--shell-muted)">
                        No workflows matched this query.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--shell-muted)">
                    Executions
                  </p>
                  <div className="space-y-1">
                    {executionResults.map((result) => (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        onClick={() => navigateFromPalette(result.href)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-(--shell-hover)"
                      >
                        <Zap className="h-4 w-4 text-amber-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-(--shell-text)">{result.label}</p>
                          <p className="truncate text-xs text-(--shell-muted)">{result.hint}</p>
                        </div>
                      </button>
                    ))}

                    {!hasQuery ? (
                      <p className="rounded-lg border border-dashed border-(--shell-border) px-3 py-2 text-sm text-(--shell-muted)">
                        Enter a query to search executions by id, workflow id, or idempotency key.
                      </p>
                    ) : null}

                    {hasQuery && executionResults.length === 0 && !isSearchLoading ? (
                      <p className="rounded-lg border border-dashed border-(--shell-border) px-3 py-2 text-sm text-(--shell-muted)">
                        No executions matched this query.
                      </p>
                    ) : null}
                  </div>
                </div>

                {isSearchLoading ? (
                  <p className="rounded-lg border border-dashed border-(--shell-border) px-3 py-2 text-sm text-(--shell-muted)">
                    Searching...
                  </p>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
