'use client';

import ZSelect, { ZSelectItem } from '@/components/primary/ZSelect';
import { WorkflowStatus } from '@/types/workflow.types';

export type WorkflowFilter = 'all' | WorkflowStatus;

interface WorkflowListFiltersProps {
  value: WorkflowFilter;
  onChange: (nextValue: WorkflowFilter) => void;
}

const FILTER_OPTIONS: ZSelectItem<WorkflowFilter>[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

export function WorkflowListFilters({ value, onChange }: WorkflowListFiltersProps) {
  return (
    <div className="flex w-full justify-start">
      <div className="w-full">
        <ZSelect<WorkflowFilter>
          label="Active status"
          value={value}
          options={FILTER_OPTIONS}
          onChange={(nextValue) => {
            if (!Array.isArray(nextValue)) {
              onChange(nextValue);
            }
          }}
          size="sm"
          placeholder="Select status"
          fullWidth
        />
      </div>
    </div>
  );
}
