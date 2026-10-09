import { describe, expect, it } from 'vitest';
import { FEEDBACK_TEXT_MAX, FEEDBACK_TEXT_MIN, prepareFeedback } from '@tudobem/shared';
import { describeError, ErrorGate, ignorable, isWebglError, reportBody } from './crash';

describe('uncaught error handling', () => {
  it('toasts and reports each distinct error once, at most three reports a session', () => {
    const gate = new ErrorGate(3, 8000);
    expect(gate.take('TypeError: a', 0)).toEqual({ toast: true, report: true });
    expect(gate.take('TypeError: a', 100)).toEqual({ toast: false, report: false });
    // a new error right after: reported, but no second toast inside the gap
    expect(gate.take('TypeError: b', 200)).toEqual({ toast: false, report: true });
    expect(gate.take('TypeError: c', 9000)).toEqual({ toast: true, report: true });
    expect(gate.take('TypeError: d', 20000)).toEqual({ toast: true, report: false });
  });

  it('builds a report the feedback endpoint accepts', () => {
    for (const msg of ['x', 'TypeError: cannot read properties of undefined', 'a'.repeat(900)]) {
      const body = reportBody(msg, 'main.js:12');
      expect(body.category).toBe('bug');
      expect(body.text.length).toBeGreaterThanOrEqual(FEEDBACK_TEXT_MIN);
      expect(body.text.length).toBeLessThanOrEqual(FEEDBACK_TEXT_MAX);
    }
    expect(prepareFeedback(reportBody('TypeError: cannot read properties of undefined', 'main.js:12')).ok).toBe(true);
  });

  it('tells a WebGL failure from other boot errors, and skips noise', () => {
    expect(isWebglError(new Error('Cannot create WebGL context, aborting.'))).toBe(true);
    expect(isWebglError(new Error('manifest.json: HTTP 404'))).toBe(false);
    expect(ignorable('Script error.')).toBe(true);
    expect(ignorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(ignorable('NotAllowedError: play() failed because the user didn\'t interact')).toBe(true);
    expect(ignorable('TypeError: x is undefined')).toBe(false);
    expect(describeError(new TypeError('boom'))).toBe('TypeError: boom');
    expect(describeError({ a: 1 })).toBe('{"a":1}');
  });
});
