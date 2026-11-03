import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes, ReviewError, withRetry, withTimeout } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('error handling utilities', () => {
  it('retries failed operations and returns the successful result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('done');

    await expect(withRetry(operation, 1, 0)).resolves.toBe('done');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws RETRY_EXHAUSTED after all attempts fail', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await expect(withRetry(async () => { throw new Error('offline'); }, 1, 0))
      .rejects.toMatchObject({ code: ErrorCodes.RETRY_EXHAUSTED });
  });

  it('rejects timed-out operations with AGENT_TIMEOUT', async () => {
    await expect(withTimeout(() => new Promise(resolve => setTimeout(resolve, 50)), 1))
      .rejects.toMatchObject({ code: ErrorCodes.AGENT_TIMEOUT });
  });

  it('returns a result that completes before the timeout', async () => {
    await expect(withTimeout(async () => 42, 100)).resolves.toBe(42);
  });

  it('preserves ReviewError identity and code', () => {
    expect(new ReviewError('invalid', ErrorCodes.INVALID_CONFIG)).toMatchObject({
      name: 'ReviewError',
      code: ErrorCodes.INVALID_CONFIG
    });
  });
});

describe('rate limiter', () => {
  it('tracks request/token limits and prunes records after the sliding window', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ maxRequestsPerMinute: 1, maxTokensPerMinute: 10, maxConcurrent: 1 });

    await limiter.acquire(5);
    limiter.release();
    expect(limiter.canProceed(5)).toBe(false);
    expect(limiter.getStatus()).toMatchObject({ requestsInWindow: 1, tokensInWindow: 5 });

    vi.advanceTimersByTime(60001);
    expect(limiter.canProceed(10)).toBe(true);
    expect(limiter.getStatus()).toMatchObject({ requestsInWindow: 0, tokensInWindow: 0 });
  });

  it('queues concurrent operations until a slot is released', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 10, maxTokensPerMinute: 100, maxConcurrent: 1 });
    await limiter.acquire(1);
    let secondAcquired = false;
    const second = limiter.acquire(1).then(() => { secondAcquired = true; });

    await Promise.resolve();
    expect(secondAcquired).toBe(false);
    limiter.release();
    await second;
    expect(limiter.getStatus().activeRequests).toBe(1);
    limiter.release();
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('rejects token estimates larger than the configured capacity', async () => {
    const limiter = new RateLimiter({ maxTokensPerMinute: 5 });
    await expect(limiter.acquire(6)).rejects.toThrow('exceeds the configured');
  });
});