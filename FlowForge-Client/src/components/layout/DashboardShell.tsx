'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedMode = window.localStorage.getItem('flowforge-theme-mode');
    const nextIsDark = savedMode ? savedMode === 'dark' : false;

    setIsDarkMode(nextIsDark);
    document.documentElement.classList.toggle('dark', nextIsDark);
  }, []);

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

  const sidebarPaddingClass = isSidebarCollapsed ? 'md:pl-20' : 'md:pl-72';

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-linear-to-b from-white to-blue-50/40 text-(--color-text-primary) dark:from-slate-950 dark:to-slate-900/70">
        <Sidebar
          mobileOpen={isSidebarOpen}
          collapsed={isSidebarCollapsed}
          isDarkMode={isDarkMode}
          onNavigate={closeSidebar}
          onToggleTheme={toggleTheme}
          onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
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
