import { describe, expect, it } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CodeQualityResultSchema,
  RefactoringSuggestionSchema,
  TestCoverageResultSchema
} from '../src/types/analysis-results.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from '../src/types/report-types.js';

const codeQuality = {
  file: 'src/app.ts',
  issues: [{
    line: 12,
    severity: 'high' as const,
    category: 'security' as const,
    description: 'Untrusted input is rendered as HTML.',
    suggestion: 'Escape user-provided content before rendering.'
  }],
  overallScore: 80,
  summary: 'One actionable issue.'
};

const testCoverage = {
  file: 'src/app.ts',
  hasTests: true,
  testFiles: ['tests/app.test.ts'],
  untestedPaths: [{
    type: 'edge-case' as const,
    location: 'parseInput: empty input',
    priority: 'medium' as const,
    reasoning: 'The empty-input branch has no assertion.',
    suggestedTest: 'Pass an empty string and assert the documented validation error.'
  }],
  coverageEstimate: 75,
  summary: 'The estimate is based on the supplied tests.'
};

const refactorings = {
  file: 'src/app.ts',
  suggestions: [{
    type: 'extract-function' as const,
    location: 'src/app.ts:20',
    impact: 'low' as const,
    description: 'Extract repeated validation into a helper.',
    before: 'if (!value) return false; if (!other) return false;',
    after: 'if (!isValid(value) || !isValid(other)) return false;',
    benefits: 'Centralizes the repeated rule.'
  }],
  summary: 'One optional cleanup.'
};

const report = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [{ file: 'src/app.ts', codeQuality, testCoverage, refactorings }],
  summary: {
    totalFiles: 1,
    overallScore: 80,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 1
  },
  recommendations: [{
    priority: 'high' as const,
    category: 'security',
    description: 'Escape untrusted HTML content.',
    files: ['src/app.ts']
  }],
  metadata: {
    analyzedAt: '2026-11-03T00:00:00.000Z',
    duration: 1200,
    agentVersions: { orchestrator: '1.0.0' }
  }
};

describe('analysis schemas', () => {
  it('accepts valid results and a populated report', () => {
    expect(CodeQualityResultSchema.parse(codeQuality)).toEqual(codeQuality);
    expect(TestCoverageResultSchema.parse(testCoverage)).toEqual(testCoverage);
    expect(RefactoringSuggestionSchema.parse(refactorings)).toEqual(refactorings);
    expect(ReviewReportSchema.parse(report)).toEqual(report);
  });

  it('rejects missing fields, invalid enums, and out-of-range scores', () => {
    expect(() => CodeQualityResultSchema.parse({ file: 'src/app.ts' })).toThrow();
    expect(() => CodeQualityResultSchema.parse({
      ...codeQuality,
      issues: [{ ...codeQuality.issues[0], severity: 'urgent' }]
    })).toThrow();
    expect(() => TestCoverageResultSchema.parse({ ...testCoverage, coverageEstimate: 101 })).toThrow();
    expect(() => RefactoringSuggestionSchema.parse({
      ...refactorings,
      suggestions: [{ ...refactorings.suggestions[0], type: 'rewrite-everything' }]
    })).toThrow();
    expect(() => ReviewReportSchema.parse({ ...report, pullRequest: undefined })).toThrow();
  });

  it('accepts empty findings and score boundaries', () => {
    expect(CodeQualityResultSchema.parse({
      ...codeQuality,
      issues: [],
      overallScore: 0
    }).issues).toEqual([]);
    expect(TestCoverageResultSchema.parse({
      ...testCoverage,
      testFiles: [],
      untestedPaths: [],
      coverageEstimate: 100
    }).coverageEstimate).toBe(100);
    expect(RefactoringSuggestionSchema.parse({ ...refactorings, suggestions: [] }).suggestions).toEqual([]);
  });

  it('exports a JSON Schema with required report fields', () => {
    const schema = zodToJsonSchema(ReviewReportSchema, { $refStrategy: 'root' }) as {
      required?: string[];
      properties?: Record<string, unknown>;
    };
    expect(schema.required).toEqual(expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'metadata']));
    expect(schema.properties).toHaveProperty('pullRequest');
    expect(ReviewReportJSONSchema).toEqual(expect.objectContaining({ type: 'object' }));
  });
});