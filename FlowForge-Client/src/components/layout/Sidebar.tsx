'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import appTile from '@/assets/app-tile.png';
import appIcon from '@/assets/icon.png';
import ZButton from '@/components/primary/ZButton';
import { useExecutionSummary } from '@/hooks/useExecutions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { Bell, ChevronLeft, ChevronRight, Clock3, GitBranch, Zap } from 'lucide-react';

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
  const userEmail = useAuthStore((state) => state.user?.email);
  const workflowsQuery = useWorkflows();
  const summaryQuery = useExecutionSummary();

  const workflowCount = workflowsQuery.data?.length ?? 0;
  const failedAndCompensatingCount =
    (summaryQuery.data?.counts.failed ?? 0) + (summaryQuery.data?.counts.compensating ?? 0);

  const profileInitial = useMemo(() => getInitialFromEmail(userEmail), [userEmail]);
  const profileLabel = userEmail ?? 'operator@flowforge.local';

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

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 border-r border-zinc-800/80 bg-zinc-950 text-zinc-200',
        collapsed ? 'w-20' : 'w-72',
        'transition-[width,transform] duration-200 md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex h-full flex-col">
        <div
          className={[
            'relative border-b border-zinc-800 px-3 py-3',
            collapsed ? 'h-20' : 'h-24',
          ].join(' ')}
        >
          <ZButton
            variant="ghost"
            size="xs"
            shape="pill"
            iconOnly
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapse}
            className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-sky-500 hover:text-sky-300 md:inline-flex"
            iconStart={
              collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />
            }
          />

          <div
            className={[
              'flex h-full items-center',
              collapsed ? 'justify-center' : 'justify-start gap-3 px-2',
            ].join(' ')}
          >
            <Image
              src={collapsed ? appIcon : appTile}
              alt="FlowForge"
              priority
              className={collapsed ? 'h-9 w-9 rounded-lg object-cover' : 'h-10 w-auto'}
            />
          </div>

          {!collapsed ? (
            <p className="px-2 text-xs text-zinc-500">Personal Workspace</p>
          ) : null}
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
                  className={[
                    'group relative flex items-center rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                  ].join(' ')}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
                  ) : null}

                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="font-medium">{item.label}</span> : null}

                  {!collapsed && item.href === '/workflows' && workflowCount > 0 ? (
                    <span className="ml-auto rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-100">
                      {workflowCount}
                    </span>
                  ) : null}

                  {!collapsed && item.href === '/executions' && failedAndCompensatingCount > 0 ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  ) : null}
                </Link>

                {!collapsed && item.href === '/executions' && isActive ? (
                  <div className="ml-7 mt-1 space-y-1 border-l border-zinc-800 pl-3">
                    {EXECUTION_FILTER_SHORTCUTS.map((shortcut) => (
                      <Link
                        key={shortcut.href}
                        href={shortcut.href}
                        className="block rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
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
              className={[
                'w-full rounded-lg border border-zinc-800/90 text-zinc-500',
                collapsed ? 'px-3 py-2.5' : 'px-3 py-2 text-left text-sm',
              ].join(' ')}
              title="Schedules / Triggers (coming soon)"
            >
              <span className={collapsed ? 'inline-flex items-center justify-center' : 'inline-flex items-center gap-2'}>
                <Clock3 className="h-4 w-4" />
                {!collapsed ? 'Schedules / Triggers' : null}
              </span>
            </button>
          </div>
        </nav>

        <div className="border-t border-zinc-800 px-2 py-3">
          <div className={collapsed ? 'flex justify-center' : 'px-2'}>
            <div className={collapsed ? '' : 'flex items-center gap-2'} title="All systems operational">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              {!collapsed ? (
                <span className="text-xs text-zinc-500">All systems operational</span>
              ) : null}
            </div>
          </div>

          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((previous) => !previous)}
              className={[
                'flex w-full items-center rounded-lg border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-700',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-2 py-2',
              ].join(' ')}
              title={collapsed ? profileLabel : undefined}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-300">
                {profileInitial}
              </span>

              {!collapsed ? (
                <span className="truncate text-left text-xs text-zinc-300">{profileLabel}</span>
              ) : null}
            </button>

            {isProfileMenuOpen ? (
              <div
                className={[
                  'absolute bottom-12 z-20 w-52 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl',
                  collapsed ? 'left-full ml-2' : 'right-0',
                ].join(' ')}
              >
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  API Keys
                </button>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
