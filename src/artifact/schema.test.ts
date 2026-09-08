import { test } from 'node:test';
import assert from 'node:assert';
import { CapabilityArtifactSchema } from './schema.js';

test('CapabilityArtifactSchema validates valid artifact', () => {
  const artifact = {
    version: '1.0',
    id: 'test-artifact',
    name: 'test',
    description: 'Test artifact',
    domain: 'localhost',
    createdAt: '2026-09-08T20:00:00.000Z',
    updatedAt: '2026-09-08T20:00:00.000Z',
    parameters: [],
    steps: [],
    successCriteria: ['Test passes'],
    metadata: {
      provisional: true
    }
  };
  
  const result = CapabilityArtifactSchema.safeParse(artifact);
  assert.strictEqual(result.success, true);
});

test('CapabilityArtifactSchema rejects invalid version', () => {
  const artifact = {
    version: '2.0',
    id: 'test',
    name: 'test',
    description: 'Test',
    domain: 'localhost',
    createdAt: '2026-09-08T20:00:00.000Z',
    updatedAt: '2026-09-08T20:00:00.000Z',
    parameters: [],
    steps: [],
    successCriteria: []
  };
  
  const result = CapabilityArtifactSchema.safeParse(artifact);
  assert.strictEqual(result.success, false);
});

test('CapabilityArtifactSchema accepts outputs', () => {
  const artifact = {
    version: '1.0',
    id: 'test',
    name: 'test',
    description: 'Test',
    domain: 'localhost',
    createdAt: '2026-09-08T20:00:00.000Z',
    updatedAt: '2026-09-08T20:00:00.000Z',
    parameters: [],
    steps: [],
    outputs: [
      {
        name: 'balance',
        type: 'string',
        pattern: '\\$([0-9.]+)',
        required: true
      }
    ],
    successCriteria: []
  };
  
  const result = CapabilityArtifactSchema.safeParse(artifact);
  assert.strictEqual(result.success, true);
});
