'use client';

import { usePathname } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar: () => void;
}

function getHeaderTitle(pathname: string): string {
  if (pathname === '/workflows') {
    return 'Workflow Dashboard';
  }

  if (pathname === '/workflows/new') {
    return 'Create Workflow';
  }

  if (/^\/workflows\/[^/]+\/executions$/.test(pathname)) {
    return 'Workflow Executions';
  }

  if (/^\/workflows\/[^/]+$/.test(pathname)) {
    return 'Workflow Details';
  }

  if (pathname === '/executions') {
    return 'Execution Monitor';
  }

  if (/^\/executions\/[^/]+$/.test(pathname)) {
    return 'Execution Details';
  }

  return 'Dashboard';
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const title = getHeaderTitle(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-(--color-border) bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) md:hidden"
          >
            <span className="text-lg leading-none">☰</span>
          </button>

          <div>
            <h1 className="text-base font-semibold text-(--color-text-primary) sm:text-lg">
              {title}
            </h1>
            <p className="text-xs text-(--color-text-secondary)">Protected dashboard area</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-(--color-border) bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-(--color-primary) sm:inline-flex">
          <span className="inline-block h-2 w-2 rounded-full bg-(--color-success)" />
          Session active
        </div>
      </div>
    </header>
  );
}
