# Prompt Templates

## Placeholder Injection Guide

| Placeholder | Source | Required | Default |
|-------------|--------|----------|---------|
| `{QUESTION}` | The technical question or decision topic | Yes | — |
| `{PROJECT_CONTEXT}` | Project-specific context | No | `"Not specified"` |
| `{RELEVANT_FILES}` | Files relevant to the question | No | `"None specified"` |
| `{CONSTRAINTS}` | Known constraints or requirements | No | `"None specified"` |
| `{CLAUDE_ANALYSIS_FORMAT}` | Copy fenced block from claude-analysis-template.md | Yes | — |
| `{AGREED_POINTS}` | Points both Claude and Gemini agree on | Yes (round 2+) | — |
| `{DISAGREED_POINTS}` | Points where Claude and Gemini disagree | Yes (round 2+) | — |
| `{NEW_PERSPECTIVES}` | Insights unique to one side | Yes (round 2+) | — |
| `{CONTINUE_OR_CONSENSUS_OR_STALEMATE}` | Current debate status | Yes (round 2+) | — |

---

## Round 1 Prompt

```
## Your Role
You are Gemini 3.1 Pro as an equal analytical peer. Use your full extended thinking capability to reason deeply about this technical question. Another analyst (Claude) is independently analyzing the same question — you will debate afterward.

## Question
{QUESTION}

## Project Context
{PROJECT_CONTEXT}

## Relevant Files/Code
{RELEVANT_FILES}

## Constraints
{CONSTRAINTS}

## Instructions
1. Think deeply and independently — do NOT give a surface-level answer.
2. Leverage your extended thinking to explore all angles.
3. Consider trade-offs, failure modes, scalability, and long-term implications.
4. If you consult external knowledge, note your sources.
5. Be honest about uncertainty — mark opinions vs facts.
6. Use EXACT output format below.

## Required Output Format

### Key Insights
- {insight 1}
- {insight 2}
...

### Considerations
- {trade-off or risk 1}
- {trade-off or risk 2}
...

### Recommendations
- {recommendation 1}
- {recommendation 2}
...

### Open Questions
- {question that needs more data}
...

### Sources
| # | Source | Description |
|---|--------|-------------|
| 1 | {url or reference} | {what it says} |

### Confidence Level
{low | medium | high} — {reason for confidence level}

### Suggested Status (Advisory)
{CONTINUE | CONSENSUS | STALEMATE} — {brief reason}
```

## Claude Independent Analysis Prompt

```
## Your Task
Analyze this technical question BEFORE reading Gemini's output.

## Information Barrier
Complete your analysis independently. Do NOT look at Gemini's output yet.

## Question
{QUESTION}

## Project Context
{PROJECT_CONTEXT}

## Relevant Files
{RELEVANT_FILES}

## Constraints
{CONSTRAINTS}

## Required Format
{CLAUDE_ANALYSIS_FORMAT}
```

## Round 2+ Response Prompt

```
## Context
You are Claude in a peer debate with Gemini 3.1 Pro on a technical question.

## Debate Status
{CONTINUE_OR_CONSENSUS_OR_STALEMATE}

## Points We Agree On
{AGREED_POINTS}

## Points We Disagree On
{DISAGREED_POINTS}

## New Perspectives (not yet discussed)
{NEW_PERSPECTIVES}

## Your Task
1. Confirm genuine agreements.
2. Challenge genuine disagreements with evidence or reasoning.
3. Add any new perspectives Gemini may have missed.
4. If consensus is reached, summarize the agreed conclusion.
5. If stalemate on key points, acknowledge and explain why you maintain your position.
6. Provide updated recommendations.

## Required Output Format

### Key Insights
- {updated insight 1}
...

### Considerations
- {updated consideration 1}
...

### Recommendations
- {updated recommendation 1}
...

### Open Questions
- {remaining open question}
...

### Confidence Level
{low | medium | high} — {reason}

### Suggested Status (Advisory)
{CONTINUE | CONSENSUS | STALEMATE} — {brief reason}
```
