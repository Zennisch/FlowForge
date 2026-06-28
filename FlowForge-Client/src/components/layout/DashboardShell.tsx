'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { extractUserFromAccessToken } from '@/lib/utils/auth-token';
import { useAuthStore } from '@/store/auth.store';
import { Header } from './Header';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [builderSidebarRestore, setBuilderSidebarRestore] = useState<boolean | null>(null);
  const [userChangedBuilderSidebar, setUserChangedBuilderSidebar] = useState(false);
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isWorkflowBuilderPage =
    pathname === '/workflows/new' || /^\/workflows\/[^/]+$/.test(pathname ?? '');

  useEffect(() => {
    const savedMode = window.localStorage.getItem('flowforge-theme-mode');
    const nextIsDark = savedMode ? savedMode === 'dark' : false;

    setIsDarkMode(nextIsDark);
    document.documentElement.classList.toggle('dark', nextIsDark);
  }, []);

  useEffect(() => {
    if (!token || user) {
      return;
    }

    const decodedUser = extractUserFromAccessToken(token);
    if (decodedUser) {
      setUser(decodedUser);
    }
  }, [setUser, token, user]);

  const toggleTheme = () => {
    setIsDarkMode((previous) => {
      const nextValue = !previous;
      document.documentElement.classList.toggle('dark', nextValue);
      window.localStorage.setItem('flowforge-theme-mode', nextValue ? 'dark' : 'light');
      return nextValue;
    });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (isWorkflowBuilderPage) {
      if (builderSidebarRestore === null) {
        setBuilderSidebarRestore(isSidebarCollapsed);
        setUserChangedBuilderSidebar(false);
        setIsSidebarCollapsed(true);
      }
      return;
    }

    if (builderSidebarRestore !== null) {
      if (!userChangedBuilderSidebar) {
        setIsSidebarCollapsed(builderSidebarRestore);
      }
      setBuilderSidebarRestore(null);
      setUserChangedBuilderSidebar(false);
    }
  }, [
    builderSidebarRestore,
    isSidebarCollapsed,
    isWorkflowBuilderPage,
    userChangedBuilderSidebar,
  ]);

  const toggleSidebarCollapse = () => {
    if (isWorkflowBuilderPage) {
      setUserChangedBuilderSidebar(true);
    }
    setIsSidebarCollapsed((previous) => !previous);
  };

  const sidebarPaddingClass = isSidebarCollapsed ? 'md:pl-20' : 'md:pl-72';

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-(--shell-canvas-bg) text-(--color-text-primary)">
        <Sidebar
          mobileOpen={isSidebarOpen}
          collapsed={isSidebarCollapsed}
          isDarkMode={isDarkMode}
          onNavigate={closeSidebar}
          onToggleCollapse={toggleSidebarCollapse}
        />

        {isSidebarOpen ? (
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-slate-950/35 md:hidden"
          />
        ) : null}

        <div className={`flex h-screen flex-col ${sidebarPaddingClass}`}>
          <Header
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            onToggleSidebar={() => setIsSidebarOpen((previous) => !previous)}
          />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
