import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/types/auth.types';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      clearToken: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      // Only persist the token — user can be re-fetched on every session
      partialize: (state) => ({ token: state.token }),
    }
  )
);
