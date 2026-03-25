import type {
  BackoffStrategy,
  CreateWorkflowRequest,
  StepType,
  TriggerType,
  Workflow,
  WorkflowStatus,
} from '@/types/workflow.types';

export type BuilderSelection =
  | { kind: 'canvas' }
  | { kind: 'trigger' }
  | { kind: 'step'; stepKey: string; panel: StepInspectorPanelKind };

export type StepInspectorPanelKind = 'retry' | 'config';

export interface BuilderTriggerDraft {
  type: TriggerType;
  webhookPath: string;
  webhookMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  webhookSecret: string;
  webhookRequireSignature: boolean;
  scheduleCron: string;
  scheduleTimezone: string;
  additionalConfigText: string;
}

export interface BuilderStepDraft {
  key: string;
  id: string;
  type: StepType;
  position: {
    x: number;
    y: number;
  };
  maxAttempts: number;
  backoff: BackoffStrategy;
  configText: string;
}

export interface BuilderEdgeDraft {
  key: string;
  fromStepKey: string;
  toStepKey: string;
  condition: string;
}

export interface WorkflowBuilderDraft {
  id?: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  trigger: BuilderTriggerDraft;
  steps: BuilderStepDraft[];
  edges: BuilderEdgeDraft[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowBuilderValidationResult {
  isValid: boolean;
  fieldErrors: Record<string, string>;
}

export interface BuildPayloadResult {
  payload?: CreateWorkflowRequest;
  validation: WorkflowBuilderValidationResult;
}

export type BuilderMode = 'create' | 'edit';

export interface WorkflowBuilderEditorProps {
  mode: BuilderMode;
  initialWorkflow?: Workflow;
  isPending: boolean;
  submitError?: string;
  onSubmit: (payload: CreateWorkflowRequest) => Promise<void>;
}
