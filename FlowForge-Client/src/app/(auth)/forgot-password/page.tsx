'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useForgotPassword } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authToken = useAuthStore((state) => state.token);
  const forgotPasswordMutation = useForgotPassword();

  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authToken) {
      router.replace('/workflows');
    }
  }, [authToken, router]);

  useEffect(() => {
    const queryEmail = searchParams.get('email') ?? '';
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    try {
      const response = await forgotPasswordMutation.mutateAsync({ email });
      setSuccessMessage(response.message);
    } catch {
      // Error is already exposed through forgotPasswordMutation.error.
    }
  };

  return (
    <AuthFormCard
      title="Reset your password"
      subtitle="Enter your email address and we will send you a link to reset your password."
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

        {forgotPasswordMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {forgotPasswordMutation.error.message}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {successMessage}
          </p>
        ) : null}

        <ZButton
          type="submit"
          fullWidth
          loading={forgotPasswordMutation.isPending}
          loadingText="Sending reset link..."
        >
          Send reset link
        </ZButton>

        <ZButton as={Link} href="/login" variant="ghost" fullWidth>
          {'<- Back to sign in'}
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
