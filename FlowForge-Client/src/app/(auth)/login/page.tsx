'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
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
  const [showPassword, setShowPassword] = useState(false);

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
        { linkText: 'Forgot password?', href: '/forgot-password' },
        { text: 'No account yet?', linkText: 'Create one', href: '/register' },
        {
          text: 'Need a new verification email?',
          linkText: 'Resend',
          href: '/resend-verification',
        },
      ]}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <ZTextInput
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
          label="Email"
          placeholder="you@company.com"
          containerClassName="my-0"
          className="text-slate-100"
        />

        <ZTextInput
          id="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
          label="Password"
          placeholder="Enter your password"
          minLength={8}
          containerClassName="my-0"
          className="text-slate-100"
          iconEnd={
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        {loginMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {loginMutation.error.message}
          </p>
        ) : null}

        <ZButton
          type="submit"
          fullWidth
          loading={loginMutation.isPending}
          loadingText="Signing in..."
        >
          Sign in
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
