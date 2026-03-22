'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { useVerifyEmail } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function VerifyEmailPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const authToken = useAuthStore((state) => state.token);
	const verifyEmailMutation = useVerifyEmail();

	const [token, setToken] = useState('');
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
			const response = await verifyEmailMutation.mutateAsync({ token });
			setSuccessMessage(response.message);
		} catch {
			// Error is already exposed through verifyEmailMutation.error.
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe,transparent_42%),var(--zui-surface)] px-4">
			<section className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--zui-surface) p-6 shadow-[0_18px_50px_-20px_rgba(29,78,216,0.28)]">
				<h1 className="text-2xl font-semibold text-(--color-text-primary)">Verify email</h1>
				<p className="mt-1 text-sm text-(--color-text-secondary)">
					Enter the verification token from your email.
				</p>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
					<label className="block">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Verification token</span>
						<input
							type="text"
							value={token}
							onChange={(event) => setToken(event.target.value)}
							required
							className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
						/>
					</label>

					{verifyEmailMutation.isError ? (
						<p className="rounded-md bg-(--color-error-light) px-3 py-2 text-sm text-(--color-error)">
							{verifyEmailMutation.error.message}
						</p>
					) : null}

					{successMessage ? (
						<p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
							{successMessage}
						</p>
					) : null}

					<button
						type="submit"
						disabled={verifyEmailMutation.isPending}
						className="w-full rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:bg-(--color-bg-disabled)"
					>
						{verifyEmailMutation.isPending ? 'Verifying...' : 'Verify email'}
					</button>
				</form>

				<p className="mt-5 text-center text-sm text-(--color-text-secondary)">
					Back to{' '}
					<Link className="font-medium text-(--color-primary) hover:underline" href="/login">
						login
					</Link>
				</p>
			</section>
		</main>
	);
}
