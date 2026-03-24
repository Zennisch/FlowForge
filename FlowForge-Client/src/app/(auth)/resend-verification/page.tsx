'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useResendVerification } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function ResendVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authToken = useAuthStore((state) => state.token);
  const resendVerificationMutation = useResendVerification();

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
      const response = await resendVerificationMutation.mutateAsync({ email });
      setSuccessMessage(response.message);
    } catch {
      // Error is already exposed through resendVerificationMutation.error.
    }
  };

  return (
    <AuthFormCard
      title="Resend verification email"
      subtitle="Need a fresh verification link? Enter your email and we will send a new one."
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

        {resendVerificationMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {resendVerificationMutation.error.message}
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
          loading={resendVerificationMutation.isPending}
          loadingText="Sending email..."
        >
          Resend email
        </ZButton>

        <ZButton as={Link} href="/login" variant="ghost" fullWidth>
          Back to sign in
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
