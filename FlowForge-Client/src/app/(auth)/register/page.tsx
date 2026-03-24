'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import ZButton from '@/components/primary/ZButton';
import ZTextInput from '@/components/primary/ZTextInput';
import { useRegister } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const registerMutation = useRegister();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      router.replace('/workflows');
    }
  }, [router, token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await registerMutation.mutateAsync({ email, password });
      setSuccessMessage(response.message);
      setPassword('');
    } catch {
      // Error is already exposed through registerMutation.error.
    }
  };

  return (
    <AuthFormCard
      title="Create your account"
      subtitle="Start building your automated workflows today."
      footerLinks={[{ text: 'Already have an account?', linkText: 'Sign in', href: '/login' }]}
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

        <div>
          <AuthPasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Create a strong password"
            minLength={8}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        {registerMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {registerMutation.error.message}
          </p>
        ) : null}

        {successMessage ? (
          <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <p>{successMessage}</p>
            <p className="mt-1">Please check your inbox to verify your email address.</p>
          </div>
        ) : null}

        <ZButton
          type="submit"
          fullWidth
          loading={registerMutation.isPending}
          loadingText="Creating account..."
        >
          Create account
        </ZButton>
      </form>
    </AuthFormCard>
  );
}
