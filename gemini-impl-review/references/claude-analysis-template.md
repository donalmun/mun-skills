# Claude Independent Analysis Template

Use this exact format for Claude's independent code quality analysis.

```markdown
### FINDING-{N}: {Short title}
- Category: bug | edge-case | security | performance | maintainability
- Severity: low | medium | high | critical
- Location: {file:line-range}
- Problem: {clear statement}
- Evidence: {specific code snippet or diff reference}
- Why it matters: {impact on correctness, security, performance, or maintainability}
- Suggested fix: {description of how to fix — NOT a patch}

### Overall Assessment
- Code quality: poor | fair | good | excellent
- Security posture: no concerns | minor concerns | significant concerns
- Test coverage impression: adequate | gaps identified | insufficient
- Maintainability: poor | fair | good | excellent

### Strongest Positions
- {positions Claude is most confident about — defend these in debate}
```

If no findings, write only `Overall Assessment` and `Strongest Positions`.

## FINDING-{N} vs ISSUE-{N}

Claude uses `FINDING-{N}` to distinguish from Gemini's `ISSUE-{N}` during cross-analysis and final report. This prevents ID collisions in the mapping table.

## Matching Protocol (FINDING to ISSUE)

When cross-analyzing in Step 4, map Claude's FINDING-{N} with Gemini's ISSUE-{N}:

1. **Semantic match**: Same Category + same code location referenced = match.
2. **1-to-many**: If 1 FINDING maps to multiple ISSUEs (or vice versa), note the mapping explicitly.
3. **Unmatched**: A FINDING or ISSUE with no counterpart is classified as "Claude-only" or "Gemini-only".
4. **Mapping table**: Maintain one mapping table across all rounds.

```markdown
| Claude FINDING | Gemini ISSUE | Classification | Status |
|---------------|-------------|----------------|--------|
| FINDING-1     | ISSUE-2     | Agreement      | Agreed |
| FINDING-2     | —           | Claude-only    | Pending |
| —             | ISSUE-1     | Gemini-only    | Disputed |
```
