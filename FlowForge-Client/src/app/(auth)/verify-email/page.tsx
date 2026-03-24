'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { MailIcon } from '@/components/auth/MailIcon';
import ZButton from '@/components/primary/ZButton';
import ZText from '@/components/primary/ZText';
import { useResendVerification, useVerifyEmail } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authToken = useAuthStore((state) => state.token);

  const verifyEmailMutation = useVerifyEmail();
  const resendVerificationMutation = useResendVerification();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const verifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (authToken) {
      router.replace('/workflows');
    }
  }, [authToken, router]);

  useEffect(() => {
    const canAutoVerify = token.length > 0 && verifiedTokenRef.current !== token;
    if (!canAutoVerify) {
      return;
    }

    verifiedTokenRef.current = token;
    verifyEmailMutation.mutate({ token });
  }, [token, verifyEmailMutation]);

  const statusMessage = useMemo(() => {
    if (!token) {
      return 'We sent a temporary link to your inbox. Open your email and tap the verification link to activate your account.';
    }

    if (verifyEmailMutation.isPending) {
      return 'We are verifying your email now. This usually takes a few seconds.';
    }

    if (verifyEmailMutation.isSuccess) {
      return verifyEmailMutation.data.message;
    }

    if (verifyEmailMutation.isError) {
      return verifyEmailMutation.error.message;
    }

    return 'Verification link detected. Continue to confirm your email.';
  }, [token, verifyEmailMutation.data?.message, verifyEmailMutation.error, verifyEmailMutation.isError, verifyEmailMutation.isPending, verifyEmailMutation.isSuccess]);

  const handleResend = async () => {
    if (!email) {
      return;
    }

    await resendVerificationMutation.mutateAsync({ email });
  };

  return (
    <AuthFormCard
      title="Check your inbox"
      subtitle={
        email
          ? `We've sent a temporary link to ${email}. Please check your email to verify your account.`
          : "We've sent a temporary link. Please check your email to verify your account."
      }
      footerLinks={[{ text: 'Already verified?', linkText: 'Sign in', href: '/login' }]}
    >
      <div className="space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10">
          <MailIcon className="h-14 w-14" />
        </div>

        <ZText as="p" size="sm" color="secondary" align="center" className="text-slate-300">
          {statusMessage}
        </ZText>

        {verifyEmailMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            Verification failed. Please request a new link.
          </p>
        ) : null}

        {resendVerificationMutation.isSuccess ? (
          <p className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {resendVerificationMutation.data.message}
          </p>
        ) : null}

        {resendVerificationMutation.isError ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {resendVerificationMutation.error.message}
          </p>
        ) : null}

        <div className="space-y-2 pt-1">
          <ZButton as="a" href={email ? `mailto:${email}` : 'mailto:'} fullWidth>
            Open email app
          </ZButton>

          <ZButton
            type="button"
            variant="secondary"
            fullWidth
            disabled={!email}
            loading={resendVerificationMutation.isPending}
            loadingText="Resending email..."
            onClick={handleResend}
          >
            Resend email
          </ZButton>

          <ZButton as={Link} href={email ? `/resend-verification?email=${encodeURIComponent(email)}` : '/resend-verification'} variant="ghost" fullWidth>
            Use another email
          </ZButton>
        </div>
      </div>
    </AuthFormCard>
  );
}
