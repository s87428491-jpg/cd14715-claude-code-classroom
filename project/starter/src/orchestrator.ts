import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ReviewReportSchema, type ReviewReport } from './types/report-types.js';
import { createMcpServersConfig } from './config/mcp.config.js';
import { codeQualityAnalyzer, refactoringSuggester, testCoverageAnalyzer } from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { RateLimiter, withRateLimit, ReviewError, ErrorCodes } from './utils/index.js';
import type { RateLimiterConfig } from './utils/rate-limiter.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  cwd?: string;
  maxTurns?: number;
  rateLimits?: Partial<RateLimiterConfig>;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly cwd: string;
  private readonly maxTurns: number;
  private readonly rateLimiter: RateLimiter;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? '';
    this.cwd = options.cwd ?? process.env.PROJECT_ROOT ?? process.cwd();
    this.maxTurns = options.maxTurns ?? 30;
    this.rateLimiter = new RateLimiter(options.rateLimits);
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!this.model) {
      throw new ReviewError('ANTHROPIC_MODEL is required to run a review', ErrorCodes.INVALID_CONFIG);
    }
    if (!owner.trim() || !repo.trim() || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new ReviewError('A valid repository owner, name, and positive PR number are required', ErrorCodes.INVALID_CONFIG);
    }

    const agents: Record<string, AgentDefinition> = {
      'code-quality-analyzer': codeQualityAnalyzer,
      'test-coverage-analyzer': testCoverageAnalyzer,
      'refactoring-suggester': refactoringSuggester
    };
    const outputSchema = (zodToJsonSchema as (schema: unknown, options?: unknown) => unknown)(
      ReviewReportSchema,
      { $refStrategy: 'root' }
    ) as Record<string, unknown>;
    const startedAt = Date.now();

    try {
      return await withRateLimit(this.rateLimiter, async () => {
        const messages = query({
          prompt: buildOrchestratorPrompt(owner, repo, prNumber),
          options: {
            agents,
            allowedTools: [
              'Task',
              'Read',
              'Grep',
              'Glob',
              'Skill',
              'mcp__github__get_pull_request',
              'mcp__github__get_pull_request_files',
              'mcp__github__get_file_contents',
              'mcp__github__search_issues',
              'mcp__eslint__lint'
            ],
            tools: ['Task'],
            mcpServers: createMcpServersConfig(),
            model: this.model,
            cwd: this.cwd,
            maxTurns: this.maxTurns,
            permissionMode: 'dontAsk',
            outputFormat: { type: 'json_schema', schema: outputSchema }
          }
        });

        let structuredOutput: unknown;
        for await (const message of messages) {
          if (message.type === 'result' && 'structured_output' in message) {
            structuredOutput = message.structured_output;
          }
        }

        const parsed = ReviewReportSchema.safeParse(structuredOutput);
        if (!parsed.success) {
          throw new ReviewError(
            'The orchestrator did not return a valid ReviewReport',
            ErrorCodes.STRUCTURED_OUTPUT_FAILED,
            { issues: parsed.error.issues }
          );
        }
        if (parsed.data.fileReviews.length === 0
          || parsed.data.summary.totalFiles !== parsed.data.fileReviews.length) {
          throw new ReviewError(
            'GitHub returned no analyzable changed files; refusing to generate an empty review report',
            ErrorCodes.STRUCTURED_OUTPUT_FAILED,
            { owner, repo, prNumber, fileReviews: parsed.data.fileReviews.length }
          );
        }

        const fileReviews = parsed.data.fileReviews;
        const qualityScores = fileReviews.map(file => file.codeQuality.overallScore);
        const overallScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        return {
          ...parsed.data,
          summary: {
            totalFiles: fileReviews.length,
            overallScore: Math.round(overallScore * 10) / 10,
            criticalIssues: fileReviews.reduce((total, file) => total + file.codeQuality.issues
              .filter(issue => issue.severity === 'critical').length, 0),
            highPriorityTests: fileReviews.reduce((total, file) => total + file.testCoverage.untestedPaths
              .filter(path => path.priority === 'high').length, 0),
            refactoringOpportunities: fileReviews.reduce((total, file) => total + file.refactorings.suggestions.length, 0)
          },
          metadata: {
            analyzedAt: new Date().toISOString(),
            duration: Date.now() - startedAt,
            agentVersions: {
              'code-quality-analyzer': '1.0.0',
              'test-coverage-analyzer': '1.0.0',
              'refactoring-suggester': '1.0.0'
            }
          }
        };
      }, 20000);
    } catch (error) {
      if (error instanceof ReviewError) throw error;
      throw new ReviewError(
        `Pull request review failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCodes.AGENT_FAILED,
        { owner, repo, prNumber }
      );
    }
  }
}

export { CodeReviewOrchestrator as Orchestrator };
