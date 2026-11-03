import { describe, expect, it } from 'vitest';
import { codeQualityAnalyzer, refactoringSuggester, testCoverageAnalyzer } from '../src/agents/index.js';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ErrorCodes, ReviewError } from '../src/utils/error-handler.js';

describe('CodeReviewOrchestrator', () => {
  it('initializes with defaults and accepts custom rate limits', () => {
    expect(new CodeReviewOrchestrator()).toBeInstanceOf(CodeReviewOrchestrator);
    expect(new CodeReviewOrchestrator({
      model: 'test-model',
      rateLimits: { maxRequestsPerMinute: 4, maxTokensPerMinute: 2000, maxConcurrent: 2 }
    })).toBeInstanceOf(CodeReviewOrchestrator);
  });

  it('rejects reviews without a configured model or valid PR identity', async () => {
    await expect(new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1))
      .rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
    await expect(new CodeReviewOrchestrator({ model: 'test-model' }).reviewPullRequest('', 'Hello-World', 1))
      .rejects.toBeInstanceOf(ReviewError);
    await expect(new CodeReviewOrchestrator({ model: 'test-model' }).reviewPullRequest('octocat', 'Hello-World', 0))
      .rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
  });

  it('registers specialized agents with inherited models and skill access', () => {
    for (const agent of [codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester]) {
      expect(agent.model).toBe('inherit');
      expect(agent.tools).toContain('Skill');
      expect(agent.description.length).toBeGreaterThan(20);
    }
  });

  it.skip('reviews a real pull request when valid API credentials are configured', async () => {
    const report = await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);
    expect(report.pullRequest).toEqual({ owner: 'octocat', repo: 'Hello-World', number: 1 });
  });
});
