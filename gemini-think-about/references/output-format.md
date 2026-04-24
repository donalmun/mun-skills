# Output Format Contract

Use this exact shape:

```markdown
### ISSUE-{N}: {Short title}
- Category: bug | edge-case | security | performance | maintainability
- Severity: low | medium | high | critical
- Location: {file:line-range}
- Problem: {clear statement}
- Evidence: {specific code snippet or diff reference}
- Why it matters: {impact on correctness, security, performance, or maintainability}
- Suggested fix: {description of how to fix — NOT a patch}

### VERDICT
- Status: APPROVE | REVISE
- Reason: {short reason}
```

If no issues remain, return only `### VERDICT` with `Status: APPROVE`.
