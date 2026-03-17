'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

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
		<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe,transparent_42%),var(--zui-surface)] px-4">
			<section className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--zui-surface) p-6 shadow-[0_18px_50px_-20px_rgba(29,78,216,0.28)]">
				<h1 className="text-2xl font-semibold text-(--color-text-primary)">Login</h1>
				<p className="mt-1 text-sm text-(--color-text-secondary)">
					Sign in to manage your workflows.
				</p>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
					<label className="block">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Email</span>
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Password</span>
						<input
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
							className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
						/>
					</label>

					{loginMutation.isError ? (
						<p className="rounded-md bg-(--color-error-light) px-3 py-2 text-sm text-(--color-error)">
							{loginMutation.error.message}
						</p>
					) : null}

					<button
						type="submit"
						disabled={loginMutation.isPending}
						className="w-full rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:bg-(--color-bg-disabled)"
					>
						{loginMutation.isPending ? 'Signing in...' : 'Sign in'}
					</button>
				</form>

				<p className="mt-5 text-center text-sm text-(--color-text-secondary)">
					No account yet?{' '}
					<Link className="font-medium text-(--color-primary) hover:underline" href="/register">
						Create one
					</Link>
				</p>
			</section>
		</main>
	);
}
