'use client';

import { useState } from 'react';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-linear-to-b from-white to-blue-50/40 text-(--color-text-primary)">
        <Sidebar mobileOpen={isSidebarOpen} onNavigate={closeSidebar} />

        {isSidebarOpen ? (
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-slate-950/35 md:hidden"
          />
        ) : null}

        <div className="flex min-h-screen flex-col md:pl-72">
          <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
