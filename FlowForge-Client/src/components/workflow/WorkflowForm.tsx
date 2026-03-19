'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useAuthStore } from '@/store/auth.store';
import type { CreateWorkflowRequest, Workflow } from '@/types/workflow.types';

import { StepList } from './StepList';

const webhookMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const webhookReservedKeys = new Set([
	'path',
	'endpoint',
	'url',
	'method',
	'secret',
	'signingSecret',
	'token',
	'requireSignature',
	'verifySignature',
]);

const scheduleReservedKeys = new Set(['cron', 'expression', 'timezone', 'tz']);

function getStringFromConfig(
	config: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = config[key];
		if (typeof value === 'string') {
			return value;
		}
	}

	return undefined;
}

function getBooleanFromConfig(
	config: Record<string, unknown>,
	keys: string[],
): boolean | undefined {
	for (const key of keys) {
		const value = config[key];
		if (typeof value === 'boolean') {
			return value;
		}
	}

	return undefined;
}

function omitKeys(
	config: Record<string, unknown>,
	reservedKeys: Set<string>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(config).filter(([key]) => !reservedKeys.has(key)),
	);
}

function hasReservedKey(
	config: Record<string, unknown>,
	reservedKeys: Set<string>,
): boolean {
	return Object.keys(config).some((key) => reservedKeys.has(key));
}

function isValidTimezone(value: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

function normalizeWebhookPath(value: string): string {
	return value.trim().replace(/^\/+|\/+$/g, '');
}

function extractUserIdFromToken(token: string | null): string {
	if (!token) {
		return '';
	}

	const tokenParts = token.split('.');
	if (tokenParts.length < 2) {
		return '';
	}

	const payloadPart = tokenParts[1];
	if (!payloadPart) {
		return '';
	}

	const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
	const paddingLength = (4 - (normalizedPayload.length % 4)) % 4;
	const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + paddingLength, '=');

	try {
		const decoded = JSON.parse(atob(paddedPayload)) as Record<string, unknown>;
		const rawUserId = decoded.id ?? decoded.sub ?? decoded.userId ?? decoded.uid;
		return typeof rawUserId === 'string' ? rawUserId : '';
	} catch {
		return '';
	}
}

function parseConfigJson(value: string): Record<string, unknown> | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return {};
	}

	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

const workflowFormSchema = z
	.object({
		name: z.string().trim().min(1, 'Workflow name is required'),
		description: z.string().optional(),
		status: z.enum(['active', 'inactive']),
		triggerType: z.enum(['manual', 'webhook', 'schedule']),
		webhookPath: z.string().optional(),
		webhookMethod: webhookMethodSchema.optional(),
		webhookSecret: z.string().optional(),
		webhookRequireSignature: z.boolean().optional(),
		scheduleCron: z.string().optional(),
		scheduleTimezone: z.string().optional(),
		additionalTriggerConfigJson: z.string().refine((value) => parseConfigJson(value) !== null, {
			message: 'Additional trigger config must be a valid JSON object',
		}),
		steps: z
			.array(
				z.object({
					id: z.string().trim().min(1, 'Step ID is required'),
					type: z.enum(['http', 'transform', 'store', 'branch']),
					maxAttempts: z.number().min(1, 'Min is 1').max(10, 'Max is 10').optional(),
					backoff: z.enum(['exponential', 'fixed']).optional(),
					configJson: z.string().refine((value) => parseConfigJson(value) !== null, {
						message: 'Config must be a valid JSON object',
					}),
				}),
			)
			.min(1, 'At least one step is required')
			.superRefine((steps, ctx) => {
				const seen = new Set<string>();

				steps.forEach((step, index) => {
					const stepId = step.id.trim();
					if (seen.has(stepId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: `Duplicate step id: ${stepId}`,
							path: [index, 'id'],
						});
						return;
					}
					seen.add(stepId);
				});
			}),
		edges: z.array(
			z.object({
				from: z.string().trim().min(1, 'Source step is required'),
				to: z.string().trim().min(1, 'Target step is required'),
				condition: z.string().optional(),
			}),
		),
	})
	.superRefine((values, ctx) => {
		const stepIds = new Set(values.steps.map((step) => step.id.trim()));
		const additionalConfig = parseConfigJson(values.additionalTriggerConfigJson) ?? {};

		if (values.triggerType === 'webhook' && !values.webhookPath?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Webhook path is required',
				path: ['webhookPath'],
			});
		}

		if (values.triggerType === 'webhook' && values.webhookPath?.trim()) {
			const normalizedWebhookPath = normalizeWebhookPath(values.webhookPath);
			if (!/^[A-Za-z0-9_-]+$/.test(normalizedWebhookPath)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'Webhook path may only contain letters, numbers, underscore, and hyphen',
					path: ['webhookPath'],
				});
			}
		}

		if (
			values.triggerType === 'webhook' &&
			hasReservedKey(additionalConfig, webhookReservedKeys)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Additional config cannot contain webhook reserved keys (path, method, secret, requireSignature, ...)',
				path: ['additionalTriggerConfigJson'],
			});
		}

		if (values.triggerType === 'schedule' && !values.scheduleCron?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Cron expression is required',
				path: ['scheduleCron'],
			});
		}

		if (
			values.triggerType === 'schedule' &&
			values.scheduleTimezone?.trim() &&
			!isValidTimezone(values.scheduleTimezone.trim())
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Timezone must be a valid IANA timezone (for example: Asia/Ho_Chi_Minh)',
				path: ['scheduleTimezone'],
			});
		}

		if (
			values.triggerType === 'schedule' &&
			hasReservedKey(additionalConfig, scheduleReservedKeys)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					'Additional config cannot contain schedule reserved keys (cron, timezone, expression, tz)',
				path: ['additionalTriggerConfigJson'],
			});
		}

		values.edges.forEach((edge, index) => {
			if (!stepIds.has(edge.from.trim())) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Edge source must reference an existing step ID',
					path: ['edges', index, 'from'],
				});
			}

			if (!stepIds.has(edge.to.trim())) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Edge target must reference an existing step ID',
					path: ['edges', index, 'to'],
				});
			}
		});
	});

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

interface WorkflowFormProps {
	mode: 'create' | 'edit';
	initialWorkflow?: Workflow;
	isPending: boolean;
	submitError?: string;
	submitLabel?: string;
	onSubmit: (payload: CreateWorkflowRequest) => Promise<void>;
}

function toDefaultValues(workflow?: Workflow): WorkflowFormValues {
	const triggerType = workflow?.trigger?.type ?? 'manual';
	const triggerConfig = workflow?.trigger?.config ?? {};
	const webhookMethodValue = getStringFromConfig(triggerConfig, ['method'])?.toUpperCase();
	const webhookMethod = webhookMethodSchema.safeParse(webhookMethodValue).success
		? (webhookMethodValue as z.infer<typeof webhookMethodSchema>)
		: 'POST';

	const additionalTriggerConfig =
		triggerType === 'webhook'
			? omitKeys(triggerConfig, webhookReservedKeys)
			: triggerType === 'schedule'
				? omitKeys(triggerConfig, scheduleReservedKeys)
				: triggerConfig;

	return {
		name: workflow?.name ?? '',
		description: workflow?.description ?? '',
		status: workflow?.status ?? 'active',
		triggerType,
		webhookPath: getStringFromConfig(triggerConfig, ['path', 'endpoint', 'url']) ?? '',
		webhookMethod,
		webhookSecret: getStringFromConfig(triggerConfig, ['secret', 'signingSecret', 'token']) ?? '',
		webhookRequireSignature:
			getBooleanFromConfig(triggerConfig, ['requireSignature', 'verifySignature']) ?? false,
		scheduleCron: getStringFromConfig(triggerConfig, ['cron', 'expression']) ?? '',
		scheduleTimezone: getStringFromConfig(triggerConfig, ['timezone', 'tz']) ?? '',
		additionalTriggerConfigJson: JSON.stringify(additionalTriggerConfig, null, 2),
		steps:
			workflow?.steps?.map((step) => ({
				id: step.id,
				type: step.type,
				maxAttempts: step.retry?.maxAttempts,
				backoff: step.retry?.backoff ?? 'exponential',
				configJson: JSON.stringify(step.config ?? {}, null, 2),
			})) ?? [{ id: '', type: 'http', maxAttempts: 3, backoff: 'exponential', configJson: '{}' }],
		edges:
			workflow?.edges?.map((edge) => ({
				from: edge.from,
				to: edge.to,
				condition: edge.condition ?? '',
			})) ?? [],
	};
}

export function WorkflowForm({
	mode,
	initialWorkflow,
	isPending,
	submitError,
	submitLabel,
	onSubmit,
}: WorkflowFormProps) {
	const token = useAuthStore((state) => state.token);
	const currentUserId = useMemo(() => extractUserIdFromToken(token), [token]);
	const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

	const defaultValues = useMemo(() => toDefaultValues(initialWorkflow), [initialWorkflow]);

	const {
		control,
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<WorkflowFormValues>({
		resolver: zodResolver(workflowFormSchema),
		defaultValues,
		values: defaultValues,
	});

	const stepFieldArray = useFieldArray({ control, name: 'steps', keyName: 'formId' });
	const edgeFieldArray = useFieldArray({ control, name: 'edges', keyName: 'formId' });
	const triggerType = useWatch({ control, name: 'triggerType' });
	const webhookPath = useWatch({ control, name: 'webhookPath' });

	const watchedSteps = useWatch({ control, name: 'steps' }) ?? [];
	const stepIdOptions = watchedSteps
		.map((step) => step.id.trim())
		.filter((stepId, index, arr) => stepId.length > 0 && arr.indexOf(stepId) === index);

	const webhookPrefixPath = useMemo(
		() => `/webhook/${currentUserId || '(current user id)'}/`,
		[currentUserId],
	);

	const fullWebhookPath = useMemo(() => {
		const normalizedPath = normalizeWebhookPath(webhookPath ?? '');
		if (!normalizedPath) {
			return '';
		}

		const relativePath = `/webhook/${currentUserId || '(current user id)'}/${normalizedPath}`;
		const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

		if (!apiBaseUrl) {
			return relativePath;
		}

		return `${apiBaseUrl.replace(/\/$/, '')}${relativePath}`;
	}, [currentUserId, webhookPath]);

	const handleCopyWebhookPath = async () => {
		if (!fullWebhookPath || typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}

		try {
			await navigator.clipboard.writeText(fullWebhookPath);
			setCopiedWebhookUrl(true);
			window.setTimeout(() => {
				setCopiedWebhookUrl(false);
			}, 2000);
		} catch {
			setCopiedWebhookUrl(false);
		}
	};

	const internalSubmit = async (values: WorkflowFormValues) => {
		const additionalTriggerConfig = parseConfigJson(values.additionalTriggerConfigJson) ?? {};

		const triggerConfig: Record<string, unknown> =
			values.triggerType === 'manual'
				? { ...additionalTriggerConfig }
				: values.triggerType === 'webhook'
					? {
						...additionalTriggerConfig,
						path: normalizeWebhookPath(values.webhookPath ?? ''),
						method: values.webhookMethod ?? 'POST',
						...(values.webhookSecret?.trim()
							? { secret: values.webhookSecret.trim() }
							: {}),
						...(values.webhookRequireSignature ? { requireSignature: true } : {}),
					}
					: {
						...additionalTriggerConfig,
						cron: values.scheduleCron?.trim() ?? '',
						...(values.scheduleTimezone?.trim()
							? { timezone: values.scheduleTimezone.trim() }
							: {}),
					};

		const payload: CreateWorkflowRequest = {
			name: values.name.trim(),
			description: values.description?.trim() || undefined,
			status: values.status,
			trigger: {
				type: values.triggerType,
				config: triggerConfig,
			},
			steps: values.steps.map((step) => ({
				id: step.id.trim(),
				type: step.type,
				config: parseConfigJson(step.configJson) ?? {},
				retry:
					step.maxAttempts || step.backoff
						? {
								...(step.maxAttempts ? { maxAttempts: step.maxAttempts } : {}),
								...(step.backoff ? { backoff: step.backoff } : {}),
							}
						: undefined,
			})),
			edges: values.edges.map((edge) => ({
				from: edge.from.trim(),
				to: edge.to.trim(),
				condition: edge.condition?.trim() || undefined,
			})),
		};

		await onSubmit(payload);
	};

	return (
		<form className="space-y-6" onSubmit={handleSubmit(internalSubmit)}>
			<section className="rounded-xl border border-(--color-border) bg-blue-50/35 p-4">
				<h2 className="text-sm font-semibold text-(--color-text-primary)">Workflow metadata</h2>

				<div className="mt-3 grid gap-4 md:grid-cols-2">
					<label className="block md:col-span-2">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Name</span>
						<input
							{...register('name')}
							disabled={isPending}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
						/>
						<p className="mt-1 text-xs text-(--color-error)">{errors.name?.message}</p>
					</label>

					<label className="block md:col-span-2">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Description</span>
						<textarea
							{...register('description')}
							disabled={isPending}
							rows={3}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Status</span>
						<select
							{...register('status')}
							disabled={isPending}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
						>
							<option value="active">active</option>
							<option value="inactive">inactive</option>
						</select>
					</label>

					<label className="block">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Trigger type</span>
						<select
							{...register('triggerType')}
							disabled={isPending}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
						>
							<option value="manual">manual</option>
							<option value="webhook">webhook</option>
							<option value="schedule">schedule</option>
						</select>
					</label>

					{triggerType === 'manual' ? (
						<div className="rounded-lg border border-dashed border-(--color-border) bg-white/70 p-3 text-xs text-(--color-text-secondary) md:col-span-2">
							Manual trigger has no required config. You can still provide optional keys in the additional config below.
						</div>
					) : null}

					{triggerType === 'webhook' ? (
						<>
							<div className="block md:col-span-2">
								<span className="mb-1 block text-sm text-(--color-text-secondary)">Webhook path</span>
								<div className="flex items-stretch gap-2">
									<div className="min-w-0 shrink rounded-lg border border-(--color-border) bg-white/80 px-3 py-2 text-xs text-(--color-text-secondary)">
										{webhookPrefixPath}
									</div>
									<input
										{...register('webhookPath')}
										disabled={isPending}
										placeholder="workflow-order-sync"
										className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
									/>
									<button
										type="button"
										onClick={() => {
											void handleCopyWebhookPath();
										}}
										disabled={isPending || !fullWebhookPath}
										className="rounded-lg border border-(--color-border) bg-white px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
									>
										{copiedWebhookUrl ? 'Copied' : 'Copy'}
									</button>
								</div>
								<p className="mt-1 text-xs text-(--color-text-secondary)">
									Endpoint: {fullWebhookPath || `${webhookPrefixPath}<path>`}
								</p>
								<p className="mt-1 text-xs text-(--color-error)">{errors.webhookPath?.message}</p>
							</div>

							<label className="block">
								<span className="mb-1 block text-sm text-(--color-text-secondary)">Webhook method</span>
								<select
									{...register('webhookMethod')}
									disabled={isPending}
									className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
								>
									<option value="GET">GET</option>
									<option value="POST">POST</option>
									<option value="PUT">PUT</option>
									<option value="PATCH">PATCH</option>
									<option value="DELETE">DELETE</option>
								</select>
							</label>

							<label className="block md:col-span-2">
								<span className="mb-1 block text-sm text-(--color-text-secondary)">Webhook secret (optional)</span>
								<input
									{...register('webhookSecret')}
									disabled={isPending}
									placeholder="whsec_xxx"
									className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
								/>
							</label>

							<label className="inline-flex items-center gap-2 md:col-span-2">
								<input
									type="checkbox"
									{...register('webhookRequireSignature')}
									disabled={isPending}
									className="h-4 w-4 rounded border border-(--color-border)"
								/>
								<span className="text-sm text-(--color-text-secondary)">Require webhook signature validation</span>
							</label>
						</>
					) : null}

					{triggerType === 'schedule' ? (
						<>
							<label className="block">
								<span className="mb-1 block text-sm text-(--color-text-secondary)">Cron expression (trigger.config.cron)</span>
								<input
									{...register('scheduleCron')}
									disabled={isPending}
									placeholder="0 */5 * * * *"
									className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-(--color-primary)"
								/>
								<p className="mt-1 text-xs text-(--color-error)">{errors.scheduleCron?.message}</p>
							</label>

							<label className="block">
								<span className="mb-1 block text-sm text-(--color-text-secondary)">Timezone (optional, trigger.config.timezone)</span>
								<input
									{...register('scheduleTimezone')}
									disabled={isPending}
									placeholder="Asia/Ho_Chi_Minh"
									className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
								/>
								<p className="mt-1 text-xs text-(--color-error)">{errors.scheduleTimezone?.message}</p>
							</label>
						</>
					) : null}

					<label className="block md:col-span-2">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Additional trigger config (JSON object)</span>
						<textarea
							{...register('additionalTriggerConfigJson')}
							disabled={isPending}
							rows={5}
							placeholder={'{\n  "source": "partner-system"\n}'}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-(--color-primary)"
						/>
						<p className="mt-1 text-xs text-(--color-error)">{errors.additionalTriggerConfigJson?.message}</p>
					</label>
				</div>
			</section>

			<StepList
				stepFields={stepFieldArray.fields}
				edgeFields={edgeFieldArray.fields}
				appendStep={stepFieldArray.append}
				removeStep={stepFieldArray.remove}
				appendEdge={edgeFieldArray.append}
				removeEdge={edgeFieldArray.remove}
				register={register}
				errors={errors}
				stepIdOptions={stepIdOptions}
				isPending={isPending}
			/>

			{submitError ? (
				<p className="rounded-lg bg-(--color-error-light) px-3 py-2 text-sm text-(--color-error)">{submitError}</p>
			) : null}

			<div className="flex flex-wrap items-center justify-end gap-2">
				<Link
					href={mode === 'create' ? '/workflows' : `/workflows/${initialWorkflow?.id ?? ''}`}
					className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
				>
					Cancel
				</Link>
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isPending ? 'Saving...' : submitLabel ?? (mode === 'create' ? 'Create workflow' : 'Save changes')}
				</button>
			</div>
		</form>
	);
}

