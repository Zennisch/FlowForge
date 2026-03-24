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
import { useExecutionSummary } from '@/hooks/useExecutions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { ChevronLeft, ChevronRight, Clock3, GitBranch, Zap } from 'lucide-react';

import { useAuthStore } from '@/store/auth.store';

interface SidebarProps {
  mobileOpen: boolean;
  collapsed: boolean;
  isDarkMode: boolean;
  onNavigate: () => void;
  onToggleTheme: () => void;
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

const EXECUTION_FILTER_SHORTCUTS = [
  { label: 'Running', href: '/executions?status=running' },
  { label: 'Failed', href: '/executions?status=failed' },
  { label: 'Pending', href: '/executions?status=pending' },
] as const;

function getInitialFromEmail(email?: string | null): string {
  if (!email) {
    return 'U';
  }

  const normalized = email.trim();
  return normalized.charAt(0).toUpperCase() || 'U';
}

export function Sidebar({
  mobileOpen,
  collapsed,
  isDarkMode,
  onNavigate,
  onToggleTheme,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const userEmail = useAuthStore((state) => state.user?.email);
  const workflowsQuery = useWorkflows();
  const summaryQuery = useExecutionSummary();

  const workflowCount = workflowsQuery.data?.length ?? 0;
  const failedAndCompensatingCount =
    (summaryQuery.data?.counts.failed ?? 0) + (summaryQuery.data?.counts.compensating ?? 0);

  const profileInitial = useMemo(() => getInitialFromEmail(userEmail), [userEmail]);
  const profileLabel = userEmail ?? 'Unknown user';

  const handleLogout = () => {
    useAuthStore.getState().clearToken();
    router.replace('/login');
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
            <Image
              src={collapsed ? appIcon : isDarkMode ? appTileTransDark : appTileTrans}
              alt="FlowForge"
              priority
              className={cn(collapsed ? 'h-9 w-9 rounded-lg object-cover' : 'h-auto full')}
            />

            {!collapsed ? <span className="sr-only">FlowForge</span> : null}
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-2 py-4">
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

                {!collapsed && item.href === '/executions' && isActive ? (
                  <div className="ml-7 mt-1 space-y-1 border-l border-(--shell-border) pl-3">
                    {EXECUTION_FILTER_SHORTCUTS.map((shortcut) => (
                      <Link
                        key={shortcut.href}
                        href={shortcut.href}
                        className="block rounded px-2 py-1 text-xs text-(--shell-muted) transition-colors hover:bg-(--shell-hover) hover:text-(--shell-text)"
                      >
                        {shortcut.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className={collapsed ? 'pt-2' : 'pt-3'}>
            <button
              type="button"
              disabled
              className={cn(
                'w-full rounded-lg border border-(--shell-border) text-(--shell-muted)',
                collapsed ? 'px-3 py-2.5' : 'px-3 py-2 text-left text-sm'
              )}
              title="Schedules / Triggers (coming soon)"
            >
              <span
                className={
                  collapsed
                    ? 'inline-flex items-center justify-center'
                    : 'inline-flex items-center gap-2'
                }
              >
                <Clock3 className="h-4 w-4" />
                {!collapsed ? 'Schedules / Triggers' : null}
              </span>
            </button>
          </div>
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
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-(--shell-text) transition-colors hover:bg-(--shell-hover)"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-(--shell-text) transition-colors hover:bg-(--shell-hover)"
                  >
                    API Keys
                  </button>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-(--shell-text) transition-colors hover:bg-(--shell-hover)"
                  >
                    {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-(--color-error) transition-colors hover:bg-(--shell-hover) hover:text-(--color-error)"
                  >
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
