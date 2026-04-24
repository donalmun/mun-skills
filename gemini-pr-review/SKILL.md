---
name: gemini-pr-review
description: Peer debate between Claude and Gemini 3.1 Pro on PR quality and merge readiness. No code modifications.
---

# Gemini PR Review

## Purpose
Peer debate on branch changes before merge -- code quality, PR description, commit hygiene, scope, merge readiness. Uses Gemini 3.1 Pro with extended thinking.

## When to Use
Before opening or merging a PR. More thorough than `/gemini-impl-review` for pre-merge scenarios.

## Prerequisites
- Current branch differs from base branch with commits not in base.

## Runner
RUNNER="/home/donald-mun/.claude/skills/gemini-review/scripts/gemini-runner.js"
SKILLS_DIR="/home/donald-mun/.claude/skills"
json_esc() { printf '%s' "$1" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(d)))'; }

## Critical Rules (DO NOT skip)
- Stdin: `printf '%s' "$PROMPT" | node "$RUNNER" ...` -- NEVER `echo`. JSON via heredoc.
- Validate: `init` output must start with `GEMINI_SESSION:`. `start`/`resume` must return valid JSON. `GEMINI_NOT_FOUND`->tell user install gemini.
- `status === "completed"` means **Gemini's turn is done** -- NOT that the debate is over. MUST check Loop Decision table.
- Loop: Do NOT exit unless consensus or stalemate. No round cap.
- Errors: `failed`->retry once (re-poll 15s). `timeout`->report partial. Cleanup: `finalize`+`stop` always.
- Runner manages all session state -- NEVER read/write session files manually.
- **Information barrier**: Claude MUST complete independent analysis BEFORE reading Gemini output.
- **NEVER edit code or create commits** -- debate only.
- For poll intervals and detailed error flows -> `Read references/protocol.md`

## Workflow

### 1. Collect Inputs
Base-branch: `git symbolic-ref refs/remotes/origin/HEAD`, fallback main/master. Validate `git rev-parse --verify`.
Effort: <10 files=`medium`, 10-50=`high`, >50=`high`. Announce defaults.
Inputs: base branch, PR title/description (optional), branch diff, commit log, file stats, effort.
Pre-flight: diff must exist, commits ahead > 0.

### 2. Init + Render + Start (Do NOT poll yet)
Init: `node "$RUNNER" init --skill-name gemini-pr-review --working-dir "$PWD"`
Render: template=`round1`. Placeholders: `PR_TITLE`, `PR_DESCRIPTION`, `BASE_BRANCH`, `COMMIT_COUNT`, `COMMIT_LIST`, `USER_REQUEST`, `SESSION_CONTEXT`.
Start: `printf '%s' "$PROMPT" | node "$RUNNER" start "$SESSION_DIR" --effort "$EFFORT"`

### 3. Claude Independent Analysis (BEFORE polling)
**INFORMATION BARRIER**: MUST NOT read Gemini output.
Render: template=`claude-analysis`. Read diff, commits, file stats, PR description. Write FINDING-{N} per `references/claude-analysis-template.md`. Overall Assessment + Merge Readiness Pre-Assessment. COMPLETE before Step 4.

### 4. Poll -> Cross-Analysis -> Resume Loop
Poll: `node "$RUNNER" poll "$SESSION_DIR"`. (-> `references/protocol.md` for intervals)
Parse `review.blocks[]` + `review.overall_assessment` (code_quality, pr_description_accuracy, commit_hygiene, scope_appropriateness). Fallback: `review.raw_markdown`.
Compare Claude FINDING-{N} vs Gemini ISSUE-{N}: Agreement, Disagreement, Claude-only, Gemini-only, Same Direction Different Severity.
Claude orchestration is authoritative -- Gemini VERDICT is advisory.
Render: template=`round2+`. Placeholders: `SESSION_CONTEXT`, `PR_TITLE`, `BASE_BRANCH`, `COMMIT_COUNT`, `COMMIT_LIST`, `AGREED_POINTS`, `DISAGREED_POINTS`, `NEW_FINDINGS`, `CONTINUE_OR_CONSENSUS_OR_STALEMATE`.
Resume + back to Poll.

| # | Condition | Action |
|---|-----------|--------|
| 1 | Full/Partial Consensus (no severity >= medium disagreements) | EXIT -> step 5 |
| 2 | convergence.stalemate === true | EXIT -> step 5 (stalemate) |
| 3 | Disagreements severity >= medium remain | CONTINUE -> Cross-Analysis |

### 5. Completion + Output
Report: Review Summary (Rounds, Verdict, Findings, Agreed/Disagreed), FINDING<->ISSUE Mapping, Overall Assessment table (Code quality/PR description/Commit hygiene/Scope), **Merge Readiness Scorecard** (must-pass: bug, security; conditional: edge-case if high+).
Merge Recommendation: any agreed critical must-pass=REJECT; >=3 agreed high must-pass=REJECT; any agreed high must-pass=REVISE; else MERGE.
Stalemate: produce scorecard from agreed findings, present disagreements, defer to user.

### 6. Finalize + Cleanup
`finalize` + `stop`. Always run. (-> `references/protocol.md` for error handling)

## Flavor Text Triggers
SKILL_START, POLL_WAITING, GEMINI_RETURNED, THINK_PEER, THINK_AGREE, THINK_DISAGREE, SEND_REBUTTAL, LATE_ROUND, APPROVE_VICTORY, STALEMATE_DRAW, FINAL_SUMMARY

## Rules
- **Safety**: NEVER `git commit`, `git add`, `git rebase`, or modify code/history.
- Both Claude and Gemini are equal peers. Gemini reviews only, no edits.
