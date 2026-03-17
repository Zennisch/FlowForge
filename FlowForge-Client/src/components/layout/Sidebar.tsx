'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/auth.store';

interface SidebarProps {
	mobileOpen: boolean;
	onNavigate: () => void;
}

const NAV_ITEMS = [
	{
		href: '/workflows',
		label: 'Workflows',
		description: 'Create, update and trigger DAG workflows.',
	},
	{
		href: '/executions',
		label: 'Executions',
		description: 'Track global runs and inspect execution details.',
	},
] as const;

export function Sidebar({ mobileOpen, onNavigate }: SidebarProps) {
	const pathname = usePathname();
	const router = useRouter();

	const handleLogout = () => {
		useAuthStore.getState().clearToken();
		router.replace('/login');
	};

	const getIsActive = (href: string) => {
		if (pathname === href) {
			return true;
		}

		return pathname.startsWith(`${href}/`);
	};

	return (
		<aside
			className={[
				'fixed inset-y-0 left-0 z-40 w-72 border-r border-(--color-border) bg-white/95 backdrop-blur',
				'transition-transform duration-200 md:translate-x-0',
				mobileOpen ? 'translate-x-0' : '-translate-x-full',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="flex h-16 items-center border-b border-(--color-border) px-6">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-(--color-primary)">FlowForge</p>
					<p className="mt-1 text-sm text-(--color-text-secondary)">Automation Control</p>
				</div>
			</div>

			<nav className="space-y-2 px-3 py-4">
				{NAV_ITEMS.map((item) => {
					const isActive = getIsActive(item.href);

					return (
						<Link
							key={item.href}
							href={item.href}
							onClick={onNavigate}
							className={[
								'block rounded-xl border px-4 py-3 transition-colors',
								isActive
									? 'border-(--color-primary) bg-blue-50/80 text-(--color-text-primary)'
									: 'border-transparent text-(--color-text-secondary) hover:border-(--color-border) hover:bg-white',
							]
								.filter(Boolean)
								.join(' ')}
						>
							<p className="text-sm font-semibold">{item.label}</p>
							<p className="mt-1 text-xs text-(--color-text-secondary)">{item.description}</p>
						</Link>
					);
				})}

				<Link
					href="/workflows/new"
					onClick={onNavigate}
					className="mt-4 block rounded-xl border border-(--color-primary) bg-(--color-primary) px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-(--color-primary-hover)"
				>
					New Workflow
				</Link>
			</nav>

			<div className="absolute inset-x-0 bottom-0 border-t border-(--color-border) px-3 py-4">
				<button
					type="button"
					onClick={handleLogout}
					className="w-full rounded-xl border border-(--color-border) bg-white px-4 py-2.5 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
				>
					Sign out
				</button>
			</div>
		</aside>
	);
}
