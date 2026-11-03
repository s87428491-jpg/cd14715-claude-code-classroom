import { describe, expect, it } from 'vitest';
import { ReportGenerator } from '../src/utils/report-generator.js';
import type { ReviewReport } from '../src/types/report-types.js';

const report: ReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [{
    file: 'src/app.ts',
    codeQuality: {
      file: 'src/app.ts',
      issues: [{
        line: 8,
        severity: 'high',
        category: 'security',
        description: 'Untrusted <script> input reaches the page.',
        suggestion: 'Escape the input before rendering.'
      }],
      overallScore: 70,
      summary: 'One security issue.'
    },
    testCoverage: {
      file: 'src/app.ts',
      hasTests: false,
      testFiles: [],
      untestedPaths: [{
        type: 'function',
        location: 'renderInput() line 8',
        priority: 'high',
        reasoning: 'No test covers the rendering boundary.',
        suggestedTest: 'Pass markup and assert it is rendered as text.'
      }],
      coverageEstimate: 20,
      summary: 'Low estimated behavior coverage.'
    },
    refactorings: {
      file: 'src/app.ts',
      suggestions: [{
        type: 'extract-function',
        location: 'src/app.ts:8',
        impact: 'low',
        description: 'Extract the escaping operation.',
        before: 'render(value)',
        after: 'render(escape(value))',
        benefits: 'Makes the trust boundary explicit.'
      }],
      summary: 'One optional refactor.'
    }
  }],
  summary: {
    totalFiles: 1,
    overallScore: 70,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1
  },
  recommendations: [{
    priority: 'high',
    category: 'security',
    description: 'Escape untrusted content.',
    files: ['src/app.ts']
  }],
  metadata: {
    analyzedAt: '2026-11-03T00:00:00.000Z',
    duration: 1000,
    agentVersions: { orchestrator: '1.0.0' }
  }
};

describe('ReportGenerator', () => {
  const generator = new ReportGenerator();

  it('includes file findings, test suggestions, and refactoring examples', () => {
    const markdown = generator.generateMarkdownReport(report);
    const html = generator.generateHTMLReport(report);

    expect(markdown).toContain('Line 8');
    expect(markdown).toContain('Pass markup and assert it is rendered as text.');
    expect(markdown).toContain('After: `render(escape(value))`');
    expect(html).toContain('renderInput() line 8');
    expect(html).toContain('render(escape(value))');
    expect(html).toContain('Quality score: 70/100');
  });

  it('escapes report content in HTML and emits valid JSON', () => {
    const html = generator.generateHTMLReport(report);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(JSON.parse(generator.generateJSONReport(report))).toEqual(report);
  });
});