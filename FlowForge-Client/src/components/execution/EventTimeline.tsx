import type { ExecutionEvent } from '@/types/execution.types';

interface EventTimelineProps {
	events: ExecutionEvent[];
}

function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'N/A';
	}

	return new Intl.DateTimeFormat('vi-VN', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

function formatPayload(payload: Record<string, unknown>): string {
	if (Object.keys(payload).length === 0) {
		return '{}';
	}

	try {
		return JSON.stringify(payload, null, 2);
	} catch {
		return '{}';
	}
}

export function EventTimeline({ events }: EventTimelineProps) {
	if (events.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-(--color-border) bg-blue-50/40 p-5 text-sm text-(--color-text-secondary)">
				No events available yet.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{events.map((event) => (
				<article key={event.id} className="rounded-xl border border-(--color-border) bg-white p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-sm font-semibold text-(--color-text-primary)">{event.type}</p>
						<p className="text-xs text-(--color-text-secondary)">{formatDateTime(event.createdAt)}</p>
					</div>

					<div className="mt-2 text-xs text-(--color-text-secondary)">
						{event.stepId ? `Step: ${event.stepId}` : 'Execution event'}
					</div>

					<pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
						{formatPayload(event.payload)}
					</pre>
				</article>
			))}
		</div>
	);
}
