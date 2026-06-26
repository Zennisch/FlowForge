'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import appTileTrans from '@/assets/app-tile-trans.png';
import appTileTransDark from '@/assets/app-tile-trans-dark.png';
import appIcon from '@/assets/icon.png';
import ZButton from '@/components/primary/ZButton';
import { cn } from '@/components/primary/utils';
import { useExecutionSummary, useExecutions } from '@/hooks/useExecutions';
import { useWorkflows } from '@/hooks/useWorkflows';
import type { ExecutionStatus } from '@/types/execution.types';
import type { Workflow } from '@/types/workflow.types';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  GitBranch,
  KeyRound,
  LogOut,
  MoreVertical,
  Plus,
  Settings,
  Timer,
  Webhook,
  Zap,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth.store';

interface SidebarProps {
  mobileOpen: boolean;
  collapsed: boolean;
  isDarkMode: boolean;
  onNavigate: () => void;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  {
    href: '/workflows',
    label: 'Workflows',
    icon: GitBranch,
  },
  {
    href: '/executions',
    label: 'Executions',
    icon: Zap,
  },
] as const;

const RECENT_EXECUTION_LIMIT = 5;

const STATUS_DOT_CLASS: Record<ExecutionStatus, string> = {
  pending: 'bg-sky-400',
  running: 'bg-blue-500',
  completed: 'bg-emerald-500',
  failed: 'bg-rose-500',
  cancelled: 'bg-slate-400',
  compensating: 'bg-amber-500',
};

function getInitialFromEmail(email?: string | null): string {
  if (!email) {
    return 'U';
  }

  const normalized = email.trim();
  return normalized.charAt(0).toUpperCase() || 'U';
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(-8) : value;
}

function readConfigString(config: Record<string, unknown> | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = config?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeWebhookPath(path: string): string {
  return path.replace(/^\/+/, '');
}

function buildWebhookTarget(workflow: Workflow, userId?: string): string {
  const path = normalizeWebhookPath(readConfigString(workflow.trigger.config, ['path', 'endpoint']));
  if (!path) {
    return '';
  }

  const relativePath = userId ? `/webhook/${userId}/${path}` : `/webhook/${path}`;
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');

  return apiBase ? `${apiBase}${relativePath}` : relativePath;
}

export function Sidebar({
  mobileOpen,
  collapsed,
  isDarkMode,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    scheduled: true,
    webhooks: true,
    recent: true,
  });
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const userEmail = useAuthStore((state) => state.user?.email);
  const workflowsQuery = useWorkflows();
  const recentExecutionsQuery = useExecutions({ limit: RECENT_EXECUTION_LIMIT });
  const summaryQuery = useExecutionSummary();

  const workflows = workflowsQuery.data ?? [];
  const workflowCount = workflowsQuery.data?.length ?? 0;
  const failedAndCompensatingCount =
    (summaryQuery.data?.counts.failed ?? 0) + (summaryQuery.data?.counts.compensating ?? 0);
  const scheduledWorkflows = useMemo(
    () =>
      workflows
        .filter((workflow) => workflow.status === 'active' && workflow.trigger.type === 'schedule')
        .slice(0, 5),
    [workflows]
  );
  const webhookWorkflows = useMemo(
    () =>
      workflows
        .filter((workflow) => workflow.status === 'active' && workflow.trigger.type === 'webhook')
        .slice(0, 5),
    [workflows]
  );
  const recentExecutions = recentExecutionsQuery.data?.items.slice(0, RECENT_EXECUTION_LIMIT) ?? [];

  const profileInitial = useMemo(() => getInitialFromEmail(userEmail), [userEmail]);
  const profileLabel = userEmail ?? 'Unknown user';

  const handleLogout = () => {
    useAuthStore.getState().clearToken();
    router.replace('/login');
  };

  const toggleGroup = (group: keyof typeof openGroups) => {
    setOpenGroups((previous) => ({ ...previous, [group]: !previous[group] }));
  };

  const copyWebhookTarget = async (workflow: Workflow) => {
    const target = buildWebhookTarget(workflow, userId);
    if (!target) {
      return;
    }

    await navigator.clipboard.writeText(target);
    setCopiedWebhookId(workflow.id);
    window.setTimeout(() => setCopiedWebhookId(null), 1200);
  };

  const getIsActive = (href: string) => {
    if (pathname === href) {
      return true;
    }

    return pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      if (!profileMenuRef.current) {
        return;
      }

      const targetNode = event.target as Node | null;
      if (targetNode && !profileMenuRef.current.contains(targetNode)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen]);

  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 80 : 288,
      }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className={cn(
        'fixed inset-y-0 left-0 z-40 border-r border-(--shell-border) bg-(--shell-sidebar-bg) text-(--shell-text)',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'relative border-b border-(--shell-border) px-3 py-3',
            collapsed ? 'h-20' : 'h-24'
          )}
        >
          <ZButton
            variant="ghost"
            size="xs"
            shape="pill"
            iconOnly
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapse}
            className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 border border-(--shell-border) bg-(--shell-panel-bg) text-(--shell-muted) hover:border-(--shell-accent) hover:text-(--shell-accent) md:inline-flex"
            iconStart={
              collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )
            }
          />

          <div
            className={cn(
              'flex h-full items-center',
              collapsed ? 'justify-center' : 'justify-center gap-3 px-2'
            )}
          >
            <Link href="/" onClick={onNavigate} aria-label="Go to home" className="inline-flex">
              <Image
                src={collapsed ? appIcon : isDarkMode ? appTileTransDark : appTileTrans}
                alt="FlowForge"
                priority
                className={cn(collapsed ? 'h-9 w-9 rounded-lg object-cover' : 'h-auto full')}
              />

              {!collapsed ? <span className="sr-only">FlowForge</span> : null}
            </Link>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ZButton
            as={Link}
            href="/workflows/new"
            variant="primary"
            size="sm"
            iconOnly={collapsed}
            iconStart={<Plus className="h-4 w-4" />}
            onClick={onNavigate}
            title={collapsed ? 'New Workflow' : undefined}
            aria-label="New Workflow"
            className={cn(
              'mb-4 w-full rounded-lg shadow-sm',
              collapsed ? 'h-10 justify-center px-0' : 'justify-start px-3'
            )}
          >
            {!collapsed ? 'New Workflow' : null}
          </ZButton>

          <div className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = getIsActive(item.href);
            const Icon = item.icon;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-(--shell-hover) text-(--shell-text)'
                      : 'text-(--shell-muted) hover:bg-(--shell-hover) hover:text-(--shell-text)'
                  )}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-(--shell-accent)" />
                  ) : null}

                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="font-medium">{item.label}</span> : null}

                  {!collapsed && item.href === '/workflows' && workflowCount > 0 ? (
                    <span className="ml-auto rounded-full bg-(--shell-hover) px-2 py-0.5 text-[10px] font-semibold text-(--shell-text)">
                      {workflowCount}
                    </span>
                  ) : null}

                  {!collapsed && item.href === '/executions' && failedAndCompensatingCount > 0 ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  ) : null}
                </Link>
              </div>
            );
          })}
          </div>

          {!collapsed ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-(--shell-border) bg-(--shell-panel-bg)">
                <button
                  type="button"
                  onClick={() => toggleGroup('scheduled')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-(--shell-muted) transition-colors hover:bg-(--shell-hover)"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>Scheduled</span>
                  <span className="ml-auto text-[10px]">{scheduledWorkflows.length}</span>
                  {openGroups.scheduled ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {openGroups.scheduled ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto px-2 pb-2">
                    {scheduledWorkflows.map((workflow) => {
                      const cron = readConfigString(workflow.trigger.config, ['cron']);
                      const timezone = readConfigString(workflow.trigger.config, ['timezone']);

                      return (
                        <Link
                          key={workflow.id}
                          href={`/workflows/${workflow.id}`}
                          onClick={onNavigate}
                          className="block rounded-md px-2 py-1.5 transition-colors hover:bg-(--shell-hover)"
                        >
                          <p className="truncate text-xs font-medium text-(--shell-text)">
                            {workflow.name}
                          </p>
                          <p className="truncate text-[11px] text-(--shell-muted)">
                            {cron || 'No cron'}{timezone ? ` · ${timezone}` : ''}
                          </p>
                        </Link>
                      );
                    })}

                    {scheduledWorkflows.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-(--shell-muted)">
                        No scheduled workflows
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-(--shell-border) bg-(--shell-panel-bg)">
                <button
                  type="button"
                  onClick={() => toggleGroup('webhooks')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-(--shell-muted) transition-colors hover:bg-(--shell-hover)"
                >
                  <Webhook className="h-3.5 w-3.5" />
                  <span>Webhooks</span>
                  <span className="ml-auto text-[10px]">{webhookWorkflows.length}</span>
                  {openGroups.webhooks ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {openGroups.webhooks ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto px-2 pb-2">
                    {webhookWorkflows.map((workflow) => {
                      const path = normalizeWebhookPath(
                        readConfigString(workflow.trigger.config, ['path', 'endpoint'])
                      );
                      const method =
                        readConfigString(workflow.trigger.config, ['method']).toUpperCase() ||
                        'POST';
                      const hasTarget = Boolean(path);

                      return (
                        <div
                          key={workflow.id}
                          className="flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-(--shell-hover)"
                        >
                          <Link
                            href={`/workflows/${workflow.id}`}
                            onClick={onNavigate}
                            className="min-w-0 flex-1"
                          >
                            <p className="truncate text-xs font-medium text-(--shell-text)">
                              {workflow.name}
                            </p>
                            <p className="truncate text-[11px] text-(--shell-muted)">
                              {method} /{path || 'missing-path'}
                            </p>
                          </Link>

                          <button
                            type="button"
                            disabled={!hasTarget}
                            onClick={() => copyWebhookTarget(workflow)}
                            aria-label={`Copy webhook for ${workflow.name}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--shell-muted) transition-colors hover:bg-(--shell-hover) hover:text-(--shell-text) disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {copiedWebhookId === workflow.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {webhookWorkflows.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-(--shell-muted)">No webhooks</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-(--shell-border) bg-(--shell-panel-bg)">
                <button
                  type="button"
                  onClick={() => toggleGroup('recent')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-(--shell-muted) transition-colors hover:bg-(--shell-hover)"
                >
                  <Timer className="h-3.5 w-3.5" />
                  <span>Recent</span>
                  <span className="ml-auto text-[10px]">{recentExecutions.length}</span>
                  {openGroups.recent ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {openGroups.recent ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto px-2 pb-2">
                    {recentExecutions.map((execution) => (
                      <Link
                        key={execution.id}
                        href={`/executions/${execution.id}`}
                        onClick={onNavigate}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-(--shell-hover)"
                      >
                        <span
                          className={cn(
                            'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                            STATUS_DOT_CLASS[execution.status]
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-(--shell-text)">
                            {execution.workflow?.name ?? `Execution ${shortId(execution.id)}`}
                          </span>
                          <span className="block truncate text-[11px] text-(--shell-muted)">
                            {execution.status} · {shortId(execution.id)}
                          </span>
                        </span>
                      </Link>
                    ))}

                    {recentExecutions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-(--shell-muted)">No recent runs</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </nav>

        <div className="border-t border-(--shell-border) px-2 py-3">
          <div className={collapsed ? 'flex justify-center' : 'px-2'}>
            <div
              className={collapsed ? '' : 'flex items-center gap-2'}
              title="All systems operational"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              {!collapsed ? (
                <span className="text-xs text-(--shell-muted)">All systems operational</span>
              ) : null}
            </div>
          </div>

          <div className="relative mt-3" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((previous) => !previous)}
              className={cn(
                'flex w-full items-center rounded-lg border border-(--shell-border) bg-(--shell-panel-bg) transition-colors hover:bg-(--shell-hover)',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-2 py-2'
              )}
              title={collapsed ? profileLabel : undefined}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-(--shell-hover) text-sm font-semibold text-(--shell-accent)">
                {profileInitial}
              </span>

              {!collapsed ? (
                <span className="truncate text-left text-xs text-(--shell-text)">
                  {profileLabel}
                </span>
              ) : null}

              {!collapsed ? (
                <MoreVertical className="ml-auto h-4 w-4 shrink-0 text-(--shell-muted)" />
              ) : null}
            </button>

            <AnimatePresence>
              {isProfileMenuOpen ? (
                <motion.div
                  initial={{ opacity: 0, x: -8, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className={cn(
                    'absolute bottom-0 z-20 w-52 rounded-lg border border-(--shell-border) bg-(--shell-panel-bg) p-1 shadow-xl',
                    collapsed ? 'left-full ml-2 origin-bottom-left' : 'left-72 origin-bottom-right'
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-(--shell-text) transition-colors hover:bg-(--shell-hover)"
                  >
                    <Settings className="h-4 w-4 text-(--shell-muted)" />
                    Settings
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-(--shell-text) transition-colors hover:bg-(--shell-hover)"
                  >
                    <KeyRound className="h-4 w-4 text-(--shell-muted)" />
                    API Keys
                  </button>

                  <div className="my-1 h-px bg-(--shell-border)" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-(--color-error) transition-colors hover:bg-(--shell-hover) hover:text-(--color-error)"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
