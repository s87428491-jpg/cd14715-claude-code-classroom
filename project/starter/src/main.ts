import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Orchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError } from './utils/error-handler.js';

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(process.env.PROJECT_ROOT ?? defaultProjectRoot, '.env') });
const projectRoot = resolve(process.env.PROJECT_ROOT ?? defaultProjectRoot);

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);
  const prNumber = Number(prStr);
  if (!owner || !repo || !prStr || !Number.isInteger(prNumber) || prNumber < 1) {
    console.error('Usage: npm run dev -- <owner> <repo> <positive-pr-number>');
    process.exitCode = 2;
    return;
  }

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsCredentials = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (!hasAnthropicKey && !(hasAwsCredentials && process.env.AWS_REGION)) {
    console.error('Configure ANTHROPIC_API_KEY, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION.');
    process.exitCode = 2;
    return;
  }
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('ANTHROPIC_MODEL is required (for example: claude-sonnet-4-5-20250929).');
    process.exitCode = 2;
    return;
  }

  console.info(hasAnthropicKey ? 'Using Anthropic API authentication.' : 'Using AWS Bedrock authentication.');
  try {
    const report = await new Orchestrator({ cwd: projectRoot }).reviewPullRequest(owner, repo, prNumber);
    const reportGenerator = new ReportGenerator();
    const reportsDirectory = resolve(projectRoot, 'reports');
    const filenameBase = `${owner}_${repo}_${prNumber}`.replace(/[^A-Za-z0-9._-]/g, '_');
    const outputs = [
      { extension: 'json', content: reportGenerator.generateJSONReport(report) },
      { extension: 'md', content: reportGenerator.generateMarkdownReport(report) },
      { extension: 'html', content: reportGenerator.generateHTMLReport(report) }
    ];

    await mkdir(reportsDirectory, { recursive: true });
    for (const output of outputs) {
      const filePath = resolve(reportsDirectory, `${filenameBase}.${output.extension}`);
      await writeFile(filePath, output.content, 'utf8');
      console.info(`Saved ${filePath}`);
    }
  } catch (error) {
    console.error(`Review failed: ${formatError(error)}`);
    process.exitCode = 1;
  }
}

void main();
