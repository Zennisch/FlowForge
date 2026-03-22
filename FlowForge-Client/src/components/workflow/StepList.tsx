'use client';

import type { FieldErrors, UseFieldArrayReturn, UseFormRegister } from 'react-hook-form';

import type { WorkflowFormValues } from './WorkflowForm';

interface StepListProps {
  stepFields: UseFieldArrayReturn<WorkflowFormValues, 'steps', 'formId'>['fields'];
  edgeFields: UseFieldArrayReturn<WorkflowFormValues, 'edges', 'formId'>['fields'];
  appendStep: UseFieldArrayReturn<WorkflowFormValues, 'steps', 'formId'>['append'];
  removeStep: UseFieldArrayReturn<WorkflowFormValues, 'steps', 'formId'>['remove'];
  appendEdge: UseFieldArrayReturn<WorkflowFormValues, 'edges', 'formId'>['append'];
  removeEdge: UseFieldArrayReturn<WorkflowFormValues, 'edges', 'formId'>['remove'];
  register: UseFormRegister<WorkflowFormValues>;
  errors: FieldErrors<WorkflowFormValues>;
  stepIdOptions: string[];
  isPending: boolean;
}

function ErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-(--color-error)">{message}</p>;
}

export function StepList({
  stepFields,
  edgeFields,
  appendStep,
  removeStep,
  appendEdge,
  removeEdge,
  register,
  errors,
  stepIdOptions,
  isPending,
}: StepListProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-(--color-border) bg-blue-50/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">Steps</h3>
          <button
            type="button"
            onClick={() =>
              appendStep({
                id: '',
                type: 'http',
                maxAttempts: 3,
                backoff: 'exponential',
                configJson: '{}',
              })
            }
            disabled={isPending}
            className="rounded-lg border border-(--color-primary) px-3 py-1.5 text-xs font-medium text-(--color-primary) transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add step
          </button>
        </div>

        {typeof errors.steps?.message === 'string' ? (
          <ErrorText message={errors.steps.message} />
        ) : null}

        {stepFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-secondary)">
            Add at least one step to define your workflow.
          </p>
        ) : null}

        <div className="space-y-3">
          {stepFields.map((field, index) => (
            <div
              key={field.formId}
              className="rounded-lg border border-(--color-border) bg-white p-3"
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">Step ID</span>
                  <input
                    {...register(`steps.${index}.id`)}
                    disabled={isPending}
                    placeholder="fetch-order"
                    className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  />
                  <ErrorText message={errors.steps?.[index]?.id?.message} />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">Type</span>
                  <select
                    {...register(`steps.${index}.type`)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  >
                    <option value="http">http</option>
                    <option value="transform">transform</option>
                    <option value="store">store</option>
                    <option value="branch">branch</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">
                    Max attempts
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    {...register(`steps.${index}.maxAttempts`, {
                      setValueAs: (value) => {
                        if (value === '' || value === undefined || value === null) {
                          return undefined;
                        }
                        return Number(value);
                      },
                    })}
                    disabled={isPending}
                    className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  />
                  <ErrorText message={errors.steps?.[index]?.maxAttempts?.message} />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">Backoff</span>
                  <select
                    {...register(`steps.${index}.backoff`)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  >
                    <option value="exponential">exponential</option>
                    <option value="fixed">fixed</option>
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-xs text-(--color-text-secondary)">
                  Step config (JSON object)
                </span>
                <textarea
                  {...register(`steps.${index}.configJson`)}
                  disabled={isPending}
                  rows={5}
                  placeholder={
                    '{\n  "url": "https://api.example.com/orders",\n  "method": "GET"\n}'
                  }
                  className="w-full rounded-lg border border-(--color-border) px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-(--color-primary)"
                />
                <ErrorText message={errors.steps?.[index]?.configJson?.message} />
              </label>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove step
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-(--color-border) bg-blue-50/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">Edges</h3>
          <button
            type="button"
            onClick={() =>
              appendEdge({
                from: stepIdOptions[0] ?? '',
                to: stepIdOptions[0] ?? '',
                condition: '',
              })
            }
            disabled={isPending || stepIdOptions.length === 0}
            className="rounded-lg border border-(--color-primary) px-3 py-1.5 text-xs font-medium text-(--color-primary) transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add edge
          </button>
        </div>

        {typeof errors.edges?.message === 'string' ? (
          <ErrorText message={errors.edges.message} />
        ) : null}

        {stepIdOptions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-(--color-border) bg-white px-3 py-2 text-sm text-(--color-text-secondary)">
            Add step IDs first to configure edges.
          </p>
        ) : null}

        <div className="space-y-3">
          {edgeFields.map((field, index) => (
            <div
              key={field.formId}
              className="rounded-lg border border-(--color-border) bg-white p-3"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">From</span>
                  <select
                    {...register(`edges.${index}.from`)}
                    disabled={isPending || stepIdOptions.length === 0}
                    className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  >
                    {stepIdOptions.map((stepId) => (
                      <option key={stepId} value={stepId}>
                        {stepId}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={errors.edges?.[index]?.from?.message} />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">To</span>
                  <select
                    {...register(`edges.${index}.to`)}
                    disabled={isPending || stepIdOptions.length === 0}
                    className="w-full rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  >
                    {stepIdOptions.map((stepId) => (
                      <option key={stepId} value={stepId}>
                        {stepId}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={errors.edges?.[index]?.to?.message} />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-(--color-text-secondary)">
                    Condition
                  </span>
                  <input
                    {...register(`edges.${index}.condition`)}
                    disabled={isPending}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-sm outline-none transition-colors focus:border-(--color-primary)"
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeEdge(index)}
                  disabled={isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove edge
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
