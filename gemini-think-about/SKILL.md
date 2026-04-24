---
name: gemini-think-about
description: Peer debate between Claude and Gemini 3.1 Pro on any technical question. Both think independently, challenge each other, converge to consensus or explicit disagreement.
---

# Gemini Think About

## Purpose
Peer reasoning, not code review. Claude and Gemini 3.1 Pro are equal analytical peers with independent extended thinking.

## When to Use
Debate technical decisions or design questions before implementing. Architecture choices, technology comparisons, reasoning through tradeoffs. Gemini's "thinking" mode gives you a second deep-reasoning perspective.

## Prerequisites
- A question or decision topic from the user.

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
- For poll intervals and detailed error flows -> `Read references/protocol.md`

## Workflow

### 1. Collect Inputs
Confirm question. Gather effort (default `high`), scope, relevant files, project context. No premature opinion.

### 2. Init + Start Gemini (Do NOT poll yet)
Init: `node "$RUNNER" init --skill-name gemini-think-about --working-dir "$PWD"`
Render template=`round1`, placeholders: `QUESTION`, `PROJECT_CONTEXT`, `RELEVANT_FILES`, `CONSTRAINTS`.
Start: `printf '%s' "$PROMPT" | node "$RUNNER" start "$SESSION_DIR" --effort "$EFFORT"`

### 3. Claude Independent Analysis (BEFORE polling)
**INFORMATION BARRIER**: MUST NOT read Gemini output. Gemini runs in background.
Render template=`claude-analysis`, same placeholders. Analyze using own knowledge. MAY use MCP tools (web_search, context7). Analysis must be COMPLETE and FINAL before Step 4.

### 4. Poll -> Cross-Analysis -> Resume Loop
Poll: `node "$RUNNER" poll "$SESSION_DIR"`. (-> `references/protocol.md` for intervals)
Parse `review.insights`, `review.considerations`, `review.recommendations`, `review.sources`. Fallback: `review.raw_markdown`.
Classify: Genuine Agreement, Genuine Disagreement, Claude-only Insight, Gemini-only Insight, Same Direction Different Depth.
Build response: Agreements, Disagreements (defend with evidence), New Perspectives, Source Cross-validation.

Render template=`round2+`, placeholders: `AGREED_POINTS`, `DISAGREED_POINTS`, `NEW_PERSPECTIVES`, `CONTINUE_OR_CONSENSUS_OR_STALEMATE`.
Resume: `printf '%s' "$PROMPT" | node "$RUNNER" resume "$SESSION_DIR" --effort "$EFFORT"`. Back to Poll.

| # | Condition | Action |
|---|-----------|--------|
| 1 | Both sides converged, no significant disagreements | EXIT -> step 5 |
| 2 | convergence.stalemate === true or same disagreements 2 rounds | EXIT -> step 5 (stalemate) |
| 3 | Significant disagreements remain or new perspectives | CONTINUE -> Cross-Analysis |

### 5. Completion + Output
Consensus -> done. Stalemate -> list deadlocked points, recommend which to favor, ask user.
Report: Consensus Points, Remaining Disagreements (Point|Claude|Gemini), Recommendations, Consolidated Sources, Open Questions, Confidence Level.

### 6. Finalize + Cleanup
`finalize` + `stop`. Always run. (-> `references/protocol.md` for error handling)

## Flavor Text Triggers
SKILL_START, POLL_WAITING, GEMINI_RETURNED, THINK_PEER, THINK_AGREE, THINK_DISAGREE, LATE_ROUND, APPROVE_VICTORY, STALEMATE_DRAW, FINAL_SUMMARY

## Rules
- Keep roles as peers; no reviewer/implementer framing.
- Gemini MUST NOT modify project files.
- Separate researched facts from opinions.
