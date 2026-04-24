# Prompt Templates

## Placeholder Injection Guide

| Placeholder | Source | Required | Default |
|-------------|--------|----------|---------|
| `{DIFF_CONTEXT}` | Diff command (staged: `git diff --cached`; last: `git diff HEAD~N..HEAD`) | Yes | — |
| `{FILES_CHANGED}` | List of files changed | Yes | — |
| `{USER_REQUEST}` | User's task/request description | No | `"Review committed code quality"` |
| `{SESSION_CONTEXT}` | Structured context block | No | `"Not specified"` |
| `{PROJECT_CONTEXT}` | Discovered project context | No | `"None discovered"` |
| `{OUTPUT_FORMAT}` | Copy fenced block from `references/output-format.md` | Yes | — |
| `{CLAUDE_ANALYSIS_FORMAT}` | Copy fenced block from `references/claude-analysis-template.md` | Yes | — |
| `{COMMIT_LIST}` | Formatted list of commits (last mode) | Yes (last mode) | — |
| `{AGREED_POINTS}` | Findings both Claude and Gemini agree on | Yes (round 2+) | — |
| `{DISAGREED_POINTS}` | Findings where Claude and Gemini disagree | Yes (round 2+) | — |
| `{NEW_FINDINGS}` | Claude-only or Gemini-only findings | Yes (round 2+) | — |
| `{CONTINUE_OR_CONSENSUS_OR_STALEMATE}` | Current debate status | Yes (round 2+) | — |

---

## Staged Review Prompt (Round 1)

```
## Your Role
You are Gemini 3.1 Pro acting as an equal peer reviewer of staged code changes. Use your extended thinking capability. Another reviewer (Claude) is independently analyzing the same changes — you will debate afterward.

## Task
{USER_REQUEST}

## Session Context
{SESSION_CONTEXT}

## Files Changed
{FILES_CHANGED}

## How to Inspect Changes
Run `git diff --cached` to read the staged diff. Review the actual code changes.

## Project Context
{PROJECT_CONTEXT}

## Instructions
1. Focus on code quality: bugs, edge cases, security vulnerabilities, performance issues, maintainability.
2. Read the staged diff thoroughly — check every changed file.
3. For each issue found, specify the exact file and line range.
4. Use extended thinking to reason about subtle issues.
5. Provide a suggested fix description (NOT a patch) for each issue.
6. Use EXACT output format below.

## Required Output Format
{OUTPUT_FORMAT}
```

## Last Review Prompt (Round 1)

```
## Your Role
You are Gemini 3.1 Pro acting as an equal peer reviewer of committed code changes. Use your extended thinking capability. Another reviewer (Claude) is independently analyzing the same commits — you will debate afterward.

## Task
{USER_REQUEST}

## Session Context
{SESSION_CONTEXT}

## Commits to Review
{COMMIT_LIST}

## Files Changed
{FILES_CHANGED}

## How to Inspect Changes
- For each commit, run `git show <SHA>` to see its individual diff.
- Also run `{DIFF_CONTEXT}` for aggregate diff context.
- Review the actual code changes for quality issues.

## Project Context
{PROJECT_CONTEXT}

## Instructions
1. Focus on code quality: bugs, edge cases, security vulnerabilities, performance issues, maintainability.
2. Reference specific commit SHA in Evidence field.
3. For each issue found, specify exact file and line range.
4. Use extended thinking to reason about subtle issues.
5. Use EXACT output format below.

## Required Output Format
{OUTPUT_FORMAT}
```

## Claude Independent Analysis Prompt — Staged mode

```
## Your Task
Perform independent analysis of staged changes BEFORE reading any peer review output.

## Information Barrier
You MUST complete this analysis independently. Do NOT look at Gemini's output yet.

## How to Inspect
Run `git diff --cached` to see staged changes. Read every file thoroughly.

## Required Format
{CLAUDE_ANALYSIS_FORMAT}
```

## Claude Independent Analysis Prompt — Last mode

```
## Your Task
Perform independent analysis of committed changes BEFORE reading any peer review output.

## Information Barrier
You MUST complete this analysis independently. Do NOT look at Gemini's output yet.

## Commits
{COMMIT_LIST}

## How to Inspect
Run `git show <SHA>` for each commit. Run `{DIFF_CONTEXT}` for full aggregate diff.

## Required Format
{CLAUDE_ANALYSIS_FORMAT}
```

## Response Prompt — Staged mode (Round 2+)

```
## Context
You are Claude in a peer debate with Gemini 3.1 Pro about staged code changes.

## Session Context
{SESSION_CONTEXT}

## Project Context
{PROJECT_CONTEXT}

## Staged Changes (for reference)
Run `git diff --cached` to inspect current state.

## Debate Status
{CONTINUE_OR_CONSENSUS_OR_STALEMATE}

## Agreed Points
{AGREED_POINTS}

## Disagreed Points
{DISAGREED_POINTS}

## New Findings (not yet discussed)
{NEW_FINDINGS}

## Your Task
Respond to Gemini's analysis:
1. Confirm genuine agreements.
2. Challenge genuine disagreements with evidence from code.
3. Add any new perspectives.
4. If consensus is reached on all medium+ severity items, say so clearly.
5. Provide your updated assessment with VERDICT.

## Required Output Format
{OUTPUT_FORMAT}
```

## Response Prompt — Last mode (Round 2+)

```
## Context
You are Claude in a peer debate with Gemini 3.1 Pro about committed code changes.

## Session Context
{SESSION_CONTEXT}

## Project Context
{PROJECT_CONTEXT}

## Commits Reviewed
{COMMIT_LIST}

## How to Inspect
Run `{DIFF_CONTEXT}` for aggregate diff. `git show <SHA>` for individual commits.

## Debate Status
{CONTINUE_OR_CONSENSUS_OR_STALEMATE}

## Agreed Points
{AGREED_POINTS}

## Disagreed Points
{DISAGREED_POINTS}

## New Findings (not yet discussed)
{NEW_FINDINGS}

## Your Task
Respond to Gemini's analysis with evidence. Challenge disagreements or concede with reasoning.
Provide your updated assessment with VERDICT.

## Required Output Format
{OUTPUT_FORMAT}
```
