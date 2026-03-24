'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (token) {
      router.replace('/workflows');
    }
  }, [router, token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync({ email, password });
      router.replace('/workflows');
    } catch {
      // Error is already exposed through loginMutation.error.
    }
  };

  return (
    <AuthFormCard
      title="Welcome back"
      subtitle="Sign in to manage your workflows and integrations."
      footerLinks={[
        { text: 'No account yet?', linkText: 'Create one', href: '/register' },
        {
          text: 'Need a new verification email?',
          linkText: 'Resend',
          href: '/resend-verification',
        },
      ]}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <ZTextInput
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
          label="Email"
          placeholder="you@company.com"
          className="text-slate-100"
        />

        <AuthPasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          labelAction={
            <Link
              className="text-xs font-medium text-(--color-primary) transition-colors hover:text-blue-400 hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          }
        />

        {loginMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {loginMutation.error.message}
          </p>
        ) : null}

        <ZButton type="submit" fullWidth loading={loginMutation.isPending} loadingText="Signing in...">
          Sign in
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
