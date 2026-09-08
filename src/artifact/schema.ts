import { z } from 'zod';

export const ActionSchema = z.object({
  type: z.enum(['click', 'type', 'navigate', 'wait', 'screenshot']),
  target: z.string().optional(),
  value: z.string().optional(),
  timeout: z.number().optional(),
  description: z.string()
});

export const StepSchema = z.object({
  id: z.string(),
  action: ActionSchema,
  expectedOutcome: z.string(),
  fallback: z.object({
    condition: z.string(),
    nextStepId: z.string().optional()
  }).optional()
});

export const ParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string(),
  required: z.boolean()
});

export const CapabilityArtifactSchema = z.object({
  version: z.literal('1.0'),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  domain: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  parameters: z.array(ParameterSchema),
  steps: z.array(StepSchema),
  successCriteria: z.array(z.string()),
  metadata: z.object({
    discoveryModel: z.string().optional(),
    discoveryRun: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

export type CapabilityArtifact = z.infer<typeof CapabilityArtifactSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;
