import { AuthGuard } from '@/components/layout/AuthGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<AuthGuard>
			<div className="min-h-screen bg-(--zui-surface)">{children}</div>
		</AuthGuard>
	);
}
