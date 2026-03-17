'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import type { CreateWorkflowRequest, Workflow } from '@/types/workflow.types';

import { StepList } from './StepList';

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
		triggerConfigJson: z.string().refine((value) => parseConfigJson(value) !== null, {
			message: 'Trigger config must be a valid JSON object',
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
	return {
		name: workflow?.name ?? '',
		description: workflow?.description ?? '',
		status: workflow?.status ?? 'active',
		triggerType: workflow?.trigger?.type ?? 'manual',
		triggerConfigJson: JSON.stringify(workflow?.trigger?.config ?? {}, null, 2),
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

	const watchedSteps = useWatch({ control, name: 'steps' }) ?? [];
	const stepIdOptions = watchedSteps
		.map((step) => step.id.trim())
		.filter((stepId, index, arr) => stepId.length > 0 && arr.indexOf(stepId) === index);

	const internalSubmit = async (values: WorkflowFormValues) => {
		const payload: CreateWorkflowRequest = {
			name: values.name.trim(),
			description: values.description?.trim() || undefined,
			status: values.status,
			trigger: {
				type: values.triggerType,
				config: parseConfigJson(values.triggerConfigJson) ?? {},
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

					<label className="block md:col-span-2">
						<span className="mb-1 block text-sm text-(--color-text-secondary)">Trigger config (JSON object)</span>
						<textarea
							{...register('triggerConfigJson')}
							disabled={isPending}
							rows={5}
							placeholder={
								'{\n  "cron": "0 */5 * * * *",\n  "timezone": "Asia/Ho_Chi_Minh"\n}'
							}
							className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-(--color-primary)"
						/>
						<p className="mt-1 text-xs text-(--color-error)">{errors.triggerConfigJson?.message}</p>
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

