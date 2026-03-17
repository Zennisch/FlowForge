'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/auth.store';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const redirectByToken = () => {
      const token = useAuthStore.getState().token;
      router.replace(token ? '/workflows' : '/login');
    };

    if (useAuthStore.persist.hasHydrated()) {
      redirectByToken();
      return;
    }

    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      redirectByToken();
    });

    void useAuthStore.persist.rehydrate();

    return () => {
      unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-(--color-text-secondary)">Loading...</p>
    </main>
  );
}
