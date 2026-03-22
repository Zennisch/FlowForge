'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = useAuthStore.getState().token;
      if (!token) {
        router.replace('/login');
        return;
      }

      setIsReady(true);
    };

    if (useAuthStore.persist.hasHydrated()) {
      checkAuth();
      return;
    }

    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      checkAuth();
    });

    void useAuthStore.persist.rehydrate();

    return () => {
      unsubscribe();
    };
  }, [router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-(--color-text-secondary)">Checking session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
