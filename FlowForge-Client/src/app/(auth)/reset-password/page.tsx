'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useResetPassword } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authToken = useAuthStore((state) => state.token);
  const resetPasswordMutation = useResetPassword();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authToken) {
      router.replace('/workflows');
    }
  }, [authToken, router]);

  useEffect(() => {
    const queryToken = searchParams.get('token') ?? '';
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    try {
      const response = await resetPasswordMutation.mutateAsync({ token, password });
      setSuccessMessage(response.message);
      setPassword('');
    } catch {
      // Error is already exposed through resetPasswordMutation.error.
    }
  };

  return (
    <AuthFormCard
      title="Set a new password"
      subtitle="Use the reset token from your email and choose a new secure password."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <ZTextInput
          id="reset-token"
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
          fullWidth
          label="Reset token"
          placeholder="Paste your reset token"
          className="text-slate-100"
        />

        <div>
          <AuthPasswordField
            id="new-password"
            label="New password"
            value={password}
            onChange={setPassword}
            placeholder="Create your new password"
            minLength={8}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        {resetPasswordMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {resetPasswordMutation.error.message}
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
          loading={resetPasswordMutation.isPending}
          loadingText="Resetting password..."
        >
          Reset password
        </ZButton>

        <ZButton as={Link} href="/login" variant="ghost" fullWidth>
          Back to sign in
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
