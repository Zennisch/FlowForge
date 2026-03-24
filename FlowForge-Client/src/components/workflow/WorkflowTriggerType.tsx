'use client';

import { Clock3, Hand, Zap } from 'lucide-react';

import { cn } from '@/components/primary/utils';
import { TriggerType } from '@/types/workflow.types';

interface WorkflowTriggerTypeProps {
  triggerType: TriggerType;
}

const TRIGGER_TYPE_CONFIG: Record<
  TriggerType,
  { label: string; icon: typeof Zap; className: string }
> = {
  webhook: {
    label: 'Webhook',
    icon: Zap,
    className: 'text-amber-600',
  },
  schedule: {
    label: 'Schedule',
    icon: Clock3,
    className: 'text-sky-600',
  },
  manual: {
    label: 'Manual',
    icon: Hand,
    className: 'text-violet-600',
  },
};

export function WorkflowTriggerType({ triggerType }: WorkflowTriggerTypeProps) {
  const config = TRIGGER_TYPE_CONFIG[triggerType];
  const Icon = config.icon;

  return (
    <span className="inline-flex items-center justify-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <Icon className={cn(config.className, 'h-3 w-3')} aria-hidden="true" />
      {config.label}
    </span>
  );
}
