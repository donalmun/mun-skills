# Gemini Runner Protocol Reference

Shared protocol for all gemini-review skills.

## Stdin Format Rules
- **JSON** -> `render`/`finalize`: heredoc. Literal-only -> `<<'RENDER_EOF'`. Dynamic vars -> escape with `json_esc`, use `<<RENDER_EOF` (unquoted).
- **json_esc output includes quotes** -> embed directly: `{"KEY":$(json_esc "$VAL")}`.
- **Plain text** -> `start`/`resume`: `printf '%s' "$PROMPT" | node "$RUNNER" ...` -- NEVER `echo`.
- **NEVER** `echo '{...}'` for JSON. Forbidden: NULL bytes (`\x00`).

## Session Init
```bash
INIT_OUTPUT=$(node "$RUNNER" init --skill-name <skill-name> --working-dir "$PWD")
SESSION_DIR=${INIT_OUTPUT#GEMINI_SESSION:}
```
Validate: `INIT_OUTPUT` must start with `GEMINI_SESSION:`. Abort if not.

## Start Round
```bash
printf '%s' "$PROMPT" | node "$RUNNER" start "$SESSION_DIR" --effort "$EFFORT"
```
Validate JSON: `{"status":"started","round":1}`. If error contains `GEMINI_NOT_FOUND` -> tell user to install gemini (`npm install -g @google/gemini-cli`).

## Render Prompt
```bash
PROMPT=$(node "$RUNNER" render --skill <skill-name> --template <template> --skills-dir "$SKILLS_DIR" <<RENDER_EOF
{"KEY1":$(json_esc "$VAL1"),"KEY2":$(json_esc "$VAL2")}
RENDER_EOF
)
```

## Resume
```bash
printf '%s' "$PROMPT" | node "$RUNNER" resume "$SESSION_DIR" --effort "$EFFORT"
```
Validate JSON. Runner uses stored `gemini_session_id` for resumption.

## Poll Protocol
```bash
POLL_JSON=$(node "$RUNNER" poll "$SESSION_DIR")
```
**Intervals by effort** (Gemini is async background process):

| Effort | Round 1 schedule | Round 2+ |
|--------|-----------------|----------|
| medium | 60s, 30s, 15s+ | 15s, 10s+ |
| high   | 90s, 60s, 30s+ | 30s, 15s+ |

First poll at 60-90s gives Gemini thinking time. Continue while `status === "running"`. Stop on `completed|failed|timeout`.

Report `status` when available. Say "Gemini is thinking..." while running.

**CRITICAL**: `status === "completed"` means Gemini finished its turn -- it does NOT mean the debate is over. After `completed`, check the skill's Loop Decision table.

## Debate Loop Protocol

After each `poll` returns `status === "completed"`, check:

1. **Check stalemate FIRST** — `convergence.stalemate` before anything else. EXIT immediately if true.
2. **Evaluate the variant-specific Loop Decision Table** to determine EXIT or CONTINUE.
3. **If the table says CONTINUE → MUST render response/rebuttal + resume**. Gemini needs to re-verify.
4. **Response/rebuttal prompt is ALWAYS sent when the table says CONTINUE**.
5. **No round cap** — loop continues until EXIT condition or stalemate.
6. **Never skip resume** — fixing code/plan without sending rebuttal+resume means Gemini never re-verifies.

## Error Handling

| Status | Action |
|--------|--------|
| `failed` | Retry once — re-poll 15s. If fails again, report partial results. |
| `timeout` | Report partial, suggest lower effort or smaller scope. Run finalize+stop. |
| `error` in start/resume | Check if `GEMINI_NOT_FOUND` — install gemini. Otherwise report and abort. |

## Finalize + Stop
```bash
printf '%s' '{"verdict":"APPROVE"}' | node "$RUNNER" finalize "$SESSION_DIR"
node "$RUNNER" stop "$SESSION_DIR"
```
**ALWAYS run both**, even on failure/timeout. Pass actual verdict: `APPROVE|REVISE|STALEMATE|partial`.
