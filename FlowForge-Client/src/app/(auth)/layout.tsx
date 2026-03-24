import { ReactNode } from 'react';

import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthSplitShell>{children}</AuthSplitShell>;
}
