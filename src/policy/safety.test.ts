import { test } from 'node:test';
import assert from 'node:assert';
import { SafetyPolicy } from './safety.js';

test('SafetyPolicy validates navigation to allowed domains', () => {
  const policy = new SafetyPolicy({ allowedDomains: ['localhost', 'example.com'] });
  
  const result = policy.validateAction(
    { type: 'navigate', value: 'http://localhost:3000' },
    'http://localhost:3000'
  );
  
  assert.strictEqual(result.allowed, true);
});

test('SafetyPolicy blocks navigation to disallowed domains', () => {
  const policy = new SafetyPolicy({ allowedDomains: ['localhost'] });
  
  const result = policy.validateAction(
    { type: 'navigate', value: 'http://malicious.com' },
    'http://localhost:3000'
  );
  
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason?.includes('not in allowlist'));
});

test('SafetyPolicy blocks risky actions', () => {
  const policy = new SafetyPolicy({ riskyActions: ['delete', 'remove'] });
  
  const result = policy.validateAction(
    { type: 'click', target: 'button:Delete Account' },
    'http://localhost:3000'
  );
  
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason?.includes('risky'));
});

test('SafetyPolicy redacts email addresses', () => {
  const policy = new SafetyPolicy();
  
  const redacted = policy.redactSensitiveData('Contact: john@example.com');
  
  assert.strictEqual(redacted, 'Contact: [REDACTED]');
});

test('SafetyPolicy redacts SSN', () => {
  const policy = new SafetyPolicy();
  
  const redacted = policy.redactSensitiveData('SSN: 123-45-6789');
  
  assert.strictEqual(redacted, 'SSN: [REDACTED]');
});
