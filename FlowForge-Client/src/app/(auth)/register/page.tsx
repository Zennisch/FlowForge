'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { useRegister } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterPage() {
	const router = useRouter();
	const token = useAuthStore((state) => state.token);
	const registerMutation = useRegister();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	useEffect(() => {
		if (token) {
			router.replace('/workflows');
		}
	}, [router, token]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		await registerMutation.mutateAsync({ email, password });
		router.replace('/workflows');
	};

	return (
		<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_bottom,#ffe4e6,transparent_35%),var(--zui-surface)] px-4">
			<section className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--zui-surface) p-6 shadow-[0_18px_50px_-20px_rgba(190,24,93,0.35)]">
				<h1 className="text-2xl font-semibold text-(--color-text-primary)">Register</h1>
				<p className="mt-1 text-sm text-(--color-text-secondary)">
					Create your FlowForge account.
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
							minLength={8}
							onChange={(event) => setPassword(event.target.value)}
							required
							className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-primary)"
						/>
					</label>

					{registerMutation.isError ? (
						<p className="rounded-md bg-(--color-error-light) px-3 py-2 text-sm text-(--color-error)">
							{registerMutation.error.message}
						</p>
					) : null}

					<button
						type="submit"
						disabled={registerMutation.isPending}
						className="w-full rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:bg-(--color-bg-disabled)"
					>
						{registerMutation.isPending ? 'Creating...' : 'Create account'}
					</button>
				</form>

				<p className="mt-5 text-center text-sm text-(--color-text-secondary)">
					Already have an account?{' '}
					<Link className="font-medium text-(--color-primary) hover:underline" href="/login">
						Sign in
					</Link>
				</p>
			</section>
		</main>
	);
}
