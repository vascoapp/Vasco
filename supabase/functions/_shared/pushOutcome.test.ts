import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pushOutcome } from './pushOutcome.ts';

Deno.test('delivered only when a device took it', () => {
  assertEquals(pushOutcome({ ok: true, sent: 1, failed: 0 }).delivered, true);
  assertEquals(pushOutcome({ ok: true, sent: 0, failed: 0 }), { delivered: false, error: 'no registered device' });
  assertEquals(pushOutcome({ ok: true, sent: 0, failed: 2 }).error, 'every device rejected the push');
  assertEquals(pushOutcome({ ok: false, error: 'Forbidden' }), { delivered: false, error: 'Forbidden' });
  assertEquals(pushOutcome(null).delivered, false);
});
