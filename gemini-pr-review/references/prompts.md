# Prompt Templates

## Placeholder Injection Guide

| Placeholder | Source | Required | Default |
|-------------|--------|----------|---------|
| `{PR_TITLE}` | PR title or branch name | No | `"Untitled PR"` |
| `{PR_DESCRIPTION}` | PR description/body | No | `"No description provided"` |
| `{BASE_BRANCH}` | Target/base branch | Yes | — |
| `{COMMIT_COUNT}` | Number of commits | Yes | — |
| `{COMMIT_LIST}` | Formatted list of commits (SHA + subject) | Yes | — |
| `{USER_REQUEST}` | User's request | No | `"Review this PR for merge readiness"` |
| `{SESSION_CONTEXT}` | Structured context block | No | `"Not specified"` |
| `{OUTPUT_FORMAT}` | Copy fenced block from output-format.md | Yes | — |
| `{CLAUDE_ANALYSIS_FORMAT}` | Copy fenced block from claude-analysis-template.md | Yes | — |
| `{AGREED_POINTS}` | Findings both sides agree on | Yes (round 2+) | — |
| `{DISAGREED_POINTS}` | Findings with disagreement | Yes (round 2+) | — |
| `{NEW_FINDINGS}` | Unresolved new findings | Yes (round 2+) | — |
| `{CONTINUE_OR_CONSENSUS_OR_STALEMATE}` | Debate status | Yes (round 2+) | — |

---

## PR Review Prompt (Round 1)

```
## Your Role
You are Gemini 3.1 Pro as an equal peer reviewer for a pull request. Use your extended thinking capability. Another reviewer (Claude) is independently analyzing the same PR — you will debate afterward.

## Task
{USER_REQUEST}

## PR Details
- Title: {PR_TITLE}
- Base Branch: {BASE_BRANCH}
- Commits: {COMMIT_COUNT}

## PR Description
{PR_DESCRIPTION}

## Commits to Review
{COMMIT_LIST}

## Session Context
{SESSION_CONTEXT}

## How to Inspect
Run `git diff {BASE_BRANCH}...HEAD` for full diff. Run `git show <SHA>` for individual commits.

## Instructions
1. Evaluate: code quality, correctness, security, PR description accuracy, commit hygiene, scope appropriateness.
2. Read every changed file in the diff.
3. Use extended thinking to identify subtle issues.
4. For each issue: specify file, line range, problem, evidence, suggested fix.
5. Overall Assessment must cover: code_quality, pr_description_accuracy, commit_hygiene, scope_appropriateness.
6. Use EXACT output format below.

## Required Output Format

### ISSUE-{N}: {Short title}
- Category: bug | edge-case | security | performance | maintainability | pr-description | commit-hygiene | scope
- Severity: low | medium | high | critical
- Location: {file:line-range or commit SHA}
- Problem: {clear statement}
- Evidence: {specific reference}
- Why it matters: {impact}
- Suggested fix: {description}

### Overall Assessment
- Code quality: poor | fair | good | excellent
- PR description accuracy: poor | fair | good | excellent
- Commit hygiene: poor | fair | good | excellent
- Scope appropriateness: too broad | appropriate | too narrow

### VERDICT
- Status: CONSENSUS | CONTINUE | STALEMATE
- Reason: {short reason}
```

## Claude Independent Analysis Prompt

```
## Your Task
Perform independent PR analysis BEFORE reading Gemini's output.

## Information Barrier
Complete your analysis independently. Do NOT look at Gemini's output yet.

## PR Details
- Title: {PR_TITLE}
- Base Branch: {BASE_BRANCH}
- Commits: {COMMIT_COUNT}

## Commits
{COMMIT_LIST}

## How to Inspect
Run `git diff {BASE_BRANCH}...HEAD`. Run `git show <SHA>` for each commit.

## Required Format
{CLAUDE_ANALYSIS_FORMAT}
```

## Response Prompt (Round 2+)

```
## Context
You are Claude in a peer debate with Gemini 3.1 Pro about a pull request.

## PR
- Title: {PR_TITLE}
- Base Branch: {BASE_BRANCH}
- Commits: {COMMIT_COUNT}

## Commits
{COMMIT_LIST}

## Session Context
{SESSION_CONTEXT}

## Debate Status
{CONTINUE_OR_CONSENSUS_OR_STALEMATE}

## Agreed Points
{AGREED_POINTS}

## Disagreed Points
{DISAGREED_POINTS}

## New Findings
{NEW_FINDINGS}

## Your Task
Respond to Gemini's analysis with evidence. Challenge disagreements or concede with reasoning.
Provide updated VERDICT and Overall Assessment.

## Required Output Format

### ISSUE-{N}: {Short title}
- Category: bug | edge-case | security | performance | maintainability | pr-description | commit-hygiene | scope
- Severity: low | medium | high | critical
- Location: {file:line-range or commit SHA}
- Problem: {clear statement}
- Evidence: {specific reference}
- Suggested fix: {description}

### Overall Assessment
- Code quality: poor | fair | good | excellent
- PR description accuracy: poor | fair | good | excellent
- Commit hygiene: poor | fair | good | excellent
- Scope appropriateness: too broad | appropriate | too narrow

### VERDICT
- Status: CONSENSUS | CONTINUE | STALEMATE
- Reason: {short reason}
```
