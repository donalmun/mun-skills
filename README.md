# mun-skills

Claude Code skill library. Install skills directly into your Claude Code setup.

## Install

```bash
# Install a specific skill
npx mun-skills install xia

# Install multiple
npx mun-skills install gemini-pr-review gemini-think-about

# Install everything
npx mun-skills install --all
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `xia` | Extract, compare, and port features from any GitHub repo into your project |
| `gemini-commit-review` | Claude × Gemini debate on committed code quality |
| `gemini-impl-review` | Claude × Gemini review of uncommitted changes — auto-applies agreed fixes |
| `gemini-plan-review` | Claude × Gemini debate on implementation plans before coding |
| `gemini-pr-review` | Claude × Gemini debate on PR quality and merge readiness |
| `gemini-security-review` | OWASP/CWE security audit via Claude × Gemini adversarial debate |
| `gemini-think-about` | Claude × Gemini peer debate on any technical question |

```bash
# See all skills + which ones are installed
npx mun-skills list
```

## Usage in Claude Code

After installing, use skills directly in your Claude Code session:

```
/xia port the auth flow from github.com/someorg/repo
/gemini-pr-review
/gemini-think-about should we use RSC or client components here?
```

## Update

```bash
npx mun-skills update xia
npx mun-skills update --all
```

## Requirements

- Node.js 18+
- Claude Code (`claude` CLI)
