import { ReactNode, Suspense } from 'react';

import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <AuthSplitShell>
      <Suspense fallback={null}>{children}</Suspense>
    </AuthSplitShell>
  );
}
