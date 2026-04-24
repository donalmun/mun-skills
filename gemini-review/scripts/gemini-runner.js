#!/usr/bin/env node

/**
 * gemini-runner.js — Runner for Gemini CLI review skills (Node.js stdlib only).
 *
 * v1: Adapted from codex-runner.js for Gemini CLI.
 * Gemini is synchronous (single JSON output), so poll immediately returns completed.
 * Subcommands: version, init, start, resume, poll, stop, finalize, status
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const GEMINI_RUNNER_VERSION = 1;
const DEFAULT_MODEL = "gemini-3.1-pro-preview";

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_TIMEOUT = 2;
const EXIT_TURN_FAILED = 3;
const EXIT_GEMINI_NOT_FOUND = 5;

const IS_WIN = process.platform === "win32";

// ============================================================
// Process management
// ============================================================

function launchGemini(stateDir, workingDir, sessionId, effort) {
  const promptFile = path.join(stateDir, "prompt.txt");
  const outputFile = path.join(stateDir, "output.json");
  const errFile = path.join(stateDir, "error.log");

  const args = ["-m", DEFAULT_MODEL, "-y", "--output-format", "json"];
  if (sessionId) {
    args.unshift("--resume", sessionId);
  }

  const fin = fs.openSync(promptFile, "r");
  const fout = fs.openSync(outputFile, "w");
  const ferr = fs.openSync(errFile, "w");

  const spawnOpts = {
    stdio: [fin, fout, ferr],
    detached: true,
    cwd: workingDir,
  };
  if (IS_WIN) {
    spawnOpts.windowsHide = true;
  }

  const child = spawn("gemini", args, spawnOpts);
  child.unref();

  const pid = child.pid;
  if (pid === undefined) {
    throw new Error(`Failed to spawn gemini — process did not start (ENOENT). Is gemini CLI installed?`);
  }

  fs.closeSync(fin);
  fs.closeSync(fout);
  fs.closeSync(ferr);

  return { pid };
}

function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killSingle(pid) {
  if (!pid || pid <= 1) return;
  try {
    if (IS_WIN) {
      spawnSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore" });
      return;
    }
    try { process.kill(pid, "SIGTERM"); } catch { return; }
    // brief wait
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, 500);
    if (isAlive(pid)) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  } catch {}
}

// ============================================================
// File I/O
// ============================================================

function atomicWrite(filepath, content) {
  const dirpath = path.dirname(filepath);
  const tmpPath = path.join(dirpath, `.${path.basename(filepath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, "utf8");
    fs.renameSync(tmpPath, filepath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

function readState(stateDir) {
  const stateFile = path.join(stateDir, "state.json");
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function updateState(stateDir, updates) {
  const state = readState(stateDir);
  Object.assign(state, updates);
  atomicWrite(path.join(stateDir, "state.json"), JSON.stringify(state, null, 2));
  return state;
}

function readRounds(stateDir) {
  const roundsFile = path.join(stateDir, "rounds.json");
  try {
    return JSON.parse(fs.readFileSync(roundsFile, "utf8"));
  } catch {
    return [];
  }
}

function writeRounds(stateDir, rounds) {
  atomicWrite(path.join(stateDir, "rounds.json"), JSON.stringify(rounds, null, 2));
}

function readStdinSync() {
  const chunks = [];
  const buf = Buffer.alloc(65536);
  let bytesRead;
  try {
    while (true) {
      bytesRead = fs.readSync(0, buf, 0, buf.length, null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(buf.slice(0, bytesRead)));
    }
  } catch {}
  return Buffer.concat(chunks).toString("utf8");
}

// ============================================================
// JSON output helpers
// ============================================================

function jsonOut(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function jsonError(error, code = "UNKNOWN_ERROR") {
  jsonOut({ status: "error", error, code });
}

// ============================================================
// Output parsers
// ============================================================

function parseFields(blockContent) {
  const fields = new Map();
  const lines = blockContent.split("\n");
  let currentField = null;
  let currentValue = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (currentField) currentValue.push(line);
      continue;
    }
    if (inCodeBlock) {
      if (currentField) currentValue.push(line);
      continue;
    }
    const fieldMatch = line.match(/^- ([A-Za-z][A-Za-z_ ]*(?:\([^)]*\))?):\s*(.*)/);
    if (fieldMatch) {
      if (currentField) {
        fields.set(currentField, currentValue.join("\n").replace(/^\s*/, "").replace(/\s+$/, ""));
      }
      currentField = fieldMatch[1].trim().toLowerCase();
      currentValue = [fieldMatch[2]];
    } else if (currentField) {
      currentValue.push(line);
    }
  }
  if (currentField) {
    fields.set(currentField, currentValue.join("\n").replace(/^\s*/, "").replace(/\s+$/, ""));
  }
  return fields;
}

function parseVerdict(md) {
  const verdictMatch = md.match(/^### VERDICT\s*$/m);
  if (!verdictMatch) return null;
  const startIdx = verdictMatch.index + verdictMatch[0].length;
  const nextHeading = md.slice(startIdx).search(/^### /m);
  const verdictContent = nextHeading >= 0
    ? md.slice(startIdx, startIdx + nextHeading)
    : md.slice(startIdx);
  const fields = parseFields(verdictContent);
  const result = {
    status: fields.get("status") || null,
    reason: fields.get("reason") || null,
    risk_summary: null,
  };
  const riskMatch = verdictContent.match(/Security Risk Summary:\s*\n([\s\S]*?)(?:\n\n|\nRecommendations:|\nBlocking|$)/);
  if (riskMatch) {
    const risk = {};
    for (const line of riskMatch[1].trim().split("\n")) {
      const m = line.match(/^-\s*(Critical|High|Medium|Low):\s*(\d+)/i);
      if (m) risk[m[1].toLowerCase()] = parseInt(m[2], 10);
    }
    if (Object.keys(risk).length > 0) result.risk_summary = risk;
  }
  return result;
}

function parseOverallAssessment(md) {
  const oaMatch = md.match(/^### Overall Assessment\s*$/m);
  if (!oaMatch) return null;
  const startIdx = oaMatch.index + oaMatch[0].length;
  const nextHeading = md.slice(startIdx).search(/^### /m);
  const oaContent = nextHeading >= 0
    ? md.slice(startIdx, startIdx + nextHeading)
    : md.slice(startIdx);
  const fields = parseFields(oaContent);
  const result = {};
  for (const [key, value] of fields) {
    const normalized = key.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    result[normalized] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function parseThinkAboutMarkdown(md) {
  const result = {
    format: "think-about",
    insights: [],
    considerations: [],
    recommendations: [],
    sources: [],
    open_questions: [],
    confidence: null,
    suggested_status: null,
    raw_markdown: md,
  };
  const sections = {};
  const sectionRegex = /^### (.+)$/gm;
  let match;
  const headings = [];
  while ((match = sectionRegex.exec(md)) !== null) {
    headings.push({ title: match[1].trim(), index: match.index + match[0].length });
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index - headings[i + 1].title.length - 5 : md.length;
    sections[headings[i].title.toLowerCase()] = md.slice(start, end).trim();
  }
  function extractBullets(sectionName) {
    const content = sections[sectionName];
    if (!content) return [];
    return content.split("\n").filter(l => l.match(/^- /)).map(l => l.replace(/^- /, "").trim());
  }
  result.insights = extractBullets("key insights");
  result.considerations = extractBullets("considerations");
  result.recommendations = extractBullets("recommendations");
  result.open_questions = extractBullets("open questions");
  const confContent = sections["confidence level"];
  if (confContent) {
    const m = confContent.match(/\b(low|medium|high)\b/i);
    if (m) result.confidence = m[1].toLowerCase();
  }
  const statusContent = sections["suggested status (advisory)"] || sections["suggested status"];
  if (statusContent) {
    const m = statusContent.match(/\b(CONTINUE|CONSENSUS|STALEMATE)\b/i);
    if (m) result.suggested_status = m[1].toUpperCase();
  }
  return result;
}

function parseOutputMarkdown(md) {
  if (!md || !md.trim()) {
    return { format: "unknown", raw_markdown: md || "", parse_error: "Empty output" };
  }
  const hasIssue = /^### ISSUE-\d+:/m.test(md);
  const hasCWE = /\bCWE:/m.test(md) || /\bCWE-\d+/m.test(md);
  const hasOWASP = /\bOWASP:/m.test(md) || /\bA\d{2}:2021/m.test(md);
  const hasAttackVector = /\bAttack Vector:/m.test(md);
  const hasOverallAssessment = /^### Overall Assessment/m.test(md);
  const hasKeyInsights = /^### Key Insight/m.test(md);
  const hasConsiderations = /^### Considerations/m.test(md);

  let format;
  if (hasIssue && (hasCWE || hasOWASP || hasAttackVector)) {
    format = "security-review";
  } else if (hasIssue && hasOverallAssessment) {
    format = "commit-pr-review";
  } else if (hasIssue) {
    format = "review";
  } else if (hasKeyInsights || hasConsiderations) {
    return parseThinkAboutMarkdown(md);
  } else {
    return { format: "unknown", raw_markdown: md, parse_error: "No recognized format markers found" };
  }

  const blockRegex = /^### ISSUE-(\d+):\s*(.+)$/gm;
  const blockPositions = [];
  let m;
  while ((m = blockRegex.exec(md)) !== null) {
    blockPositions.push({ id: parseInt(m[1], 10), title: m[2].trim(), startContent: m.index + m[0].length });
  }

  const blocks = [];
  for (let i = 0; i < blockPositions.length; i++) {
    const start = blockPositions[i].startContent;
    const remaining = md.slice(start);
    const nextHeadingMatch = remaining.search(/^### /m);
    const end = nextHeadingMatch >= 0 ? start + nextHeadingMatch : md.length;
    const blockContent = md.slice(start, end);
    const fields = parseFields(blockContent);
    const block = { id: blockPositions[i].id, prefix: "ISSUE", title: blockPositions[i].title };
    for (const [key, value] of fields) {
      const normalized = key.replace(/\s+/g, "_").replace(/[^a-z0-9_()]/g, "");
      block[normalized] = value;
    }
    blocks.push(block);
  }

  return {
    format,
    blocks,
    verdict: parseVerdict(md),
    overall_assessment: hasOverallAssessment ? parseOverallAssessment(md) : null,
    raw_markdown: md,
  };
}

// ============================================================
// Gemini output parsing
// ============================================================

function parseGeminiOutput(stateDir, elapsed, processAlive, timeoutVal, state) {
  const outputFile = path.join(stateDir, "output.json");
  const errFile = path.join(stateDir, "error.log");
  const currentRound = state.round || 1;

  // Process still running → running status
  if (processAlive) {
    if (elapsed >= timeoutVal) {
      return {
        json: { status: "timeout", round: currentRound, elapsed_seconds: elapsed, exit_code: EXIT_TIMEOUT, error: `Timeout after ${timeoutVal}s`, review: null },
        geminiSessionId: "",
        reviewText: "",
        terminal: true,
      };
    }
    return {
      json: { status: "running", round: currentRound, elapsed_seconds: elapsed },
      geminiSessionId: "",
      reviewText: "",
      terminal: false,
    };
  }

  // Process finished — read output
  if (!fs.existsSync(outputFile)) {
    let errContent = "";
    if (fs.existsSync(errFile)) errContent = fs.readFileSync(errFile, "utf8").trim().slice(0, 300);
    return {
      json: { status: "failed", round: currentRound, elapsed_seconds: elapsed, exit_code: EXIT_TURN_FAILED, error: "No output file: " + (errContent || "unknown"), review: null },
      geminiSessionId: "",
      reviewText: "",
      terminal: true,
    };
  }

  const rawContent = fs.readFileSync(outputFile, "utf8").trim();
  if (!rawContent) {
    let errContent = "";
    if (fs.existsSync(errFile)) errContent = fs.readFileSync(errFile, "utf8").trim().slice(0, 300);
    return {
      json: { status: "failed", round: currentRound, elapsed_seconds: elapsed, exit_code: EXIT_TURN_FAILED, error: "Empty output: " + (errContent || "unknown"), review: null },
      geminiSessionId: "",
      reviewText: "",
      terminal: true,
    };
  }

  let geminiJson;
  try {
    geminiJson = JSON.parse(rawContent);
  } catch (e) {
    return {
      json: { status: "failed", round: currentRound, elapsed_seconds: elapsed, exit_code: EXIT_TURN_FAILED, error: `Cannot parse Gemini output: ${e.message}`, review: null },
      geminiSessionId: "",
      reviewText: "",
      terminal: true,
    };
  }

  const geminiSessionId = geminiJson.session_id || "";
  const reviewText = geminiJson.response || "";

  if (!reviewText) {
    return {
      json: { status: "failed", round: currentRound, elapsed_seconds: elapsed, exit_code: EXIT_TURN_FAILED, error: "Gemini returned empty response", review: null },
      geminiSessionId,
      reviewText: "",
      terminal: true,
    };
  }

  atomicWrite(path.join(stateDir, "review.md"), reviewText);
  const review = parseOutputMarkdown(reviewText);

  return {
    json: { status: "completed", round: currentRound, elapsed_seconds: elapsed, thread_id: geminiSessionId, review },
    geminiSessionId,
    reviewText,
    terminal: true,
  };
}

// ============================================================
// Template engine
// ============================================================

const TEMPLATE_MAP = {
  "gemini-plan-review": {
    "round1": "Plan Review Prompt (Round 1)",
    "rebuttal": "Rebuttal Prompt (Round 2+)",
  },
  "gemini-impl-review": {
    "working-tree-round1": "Working Tree Review Prompt (Round 1)",
    "branch-round1": "Branch Review Prompt (Round 1)",
    "rebuttal-working-tree": "Rebuttal Prompt — Working-tree mode (Round 2+)",
    "rebuttal-branch": "Rebuttal Prompt — Branch mode (Round 2+)",
  },
  "gemini-think-about": {
    "round1": "Round 1 Prompt",
    "claude-analysis": "Claude Independent Analysis Prompt",
    "round2+": "Round 2+ Response Prompt",
  },
  "gemini-commit-review": {
    "staged-round1": "Staged Review Prompt (Round 1)",
    "last-round1": "Last Review Prompt (Round 1)",
    "claude-staged": "Claude Independent Analysis Prompt — Staged mode",
    "claude-last": "Claude Independent Analysis Prompt — Last mode",
    "staged-round2+": "Response Prompt — Staged mode (Round 2+)",
    "last-round2+": "Response Prompt — Last mode (Round 2+)",
  },
  "gemini-pr-review": {
    "round1": "PR Review Prompt (Round 1)",
    "claude-analysis": "Claude Independent Analysis Prompt",
    "round2+": "Response Prompt (Round 2+)",
  },
  "gemini-security-review": {
    "round1": "Security Review Prompt (Round 1)",
    "working-tree": "Security Review Prompt - Working Tree Mode",
    "branch": "Security Review Prompt - Branch Mode",
    "full": "Security Review Prompt - Full Codebase Mode",
    "round2+": "Round 2+ Prompt (Resume)",
  },
};

function extractTemplateSection(promptsMd, targetHeading) {
  const lines = promptsMd.split("\n");
  let inTargetSection = false;
  let sectionLines = [];
  let found = false;
  let inFence = false;

  for (const line of lines) {
    if (line.trimEnd().match(/^```/)) {
      if (inTargetSection) {
        sectionLines.push(line);
        inFence = !inFence;
        continue;
      }
      inFence = !inFence;
    }
    if (!inFence) {
      const headingMatch = line.match(/^## (.+)$/);
      if (headingMatch) {
        if (inTargetSection) break;
        if (headingMatch[1].trim() === targetHeading) {
          inTargetSection = true;
          found = true;
          continue;
        }
      }
    }
    if (inTargetSection) sectionLines.push(line);
  }

  if (!found) return null;
  const sectionContent = sectionLines.join("\n");
  const fenceMatch = sectionContent.match(/```[^\n]*\n([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1] : sectionContent.trim();
}

function parsePlaceholderGuide(promptsMd) {
  const guide = new Map();
  const guideMatch = promptsMd.match(/## Placeholder Injection Guide\s*\n([\s\S]*?)(?=\n## |\n---|\n### [^P]|$)/);
  if (!guideMatch) return guide;
  const rows = guideMatch[1].split("\n").filter(line =>
    line.includes("|") && line.includes("`{") && !line.match(/^\|?\s*[-|]+\s*\|?$/)
  );
  for (const row of rows) {
    const cells = row.split("|").map(c => c.trim()).filter(c => c);
    if (cells.length >= 4) {
      const nameMatch = cells[0].match(/`\{([A-Z_]+)\}`/);
      if (nameMatch) {
        const name = nameMatch[1];
        const required = cells[2].toLowerCase().includes("yes");
        const defaultVal = cells[3] === "—" || cells[3] === "-" ? null : cells[3].replace(/^`|`$/g, "").trim() || null;
        guide.set(name, { required, default: defaultVal });
      }
    }
  }
  return guide;
}

function cmdRender(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      skill: { type: "string" },
      template: { type: "string" },
      "skills-dir": { type: "string" },
    },
    strict: true,
  });

  const { skill, template: templateName } = values;
  const skillsDir = values["skills-dir"];

  if (!skill || !templateName || !skillsDir) {
    process.stderr.write("Error: --skill, --template, and --skills-dir are required\n");
    return EXIT_ERROR;
  }

  const skillTemplates = TEMPLATE_MAP[skill];
  if (!skillTemplates) {
    jsonError(`Unknown skill: ${skill}`, "UNKNOWN_SKILL");
    return EXIT_ERROR;
  }

  const targetHeading = skillTemplates[templateName];
  if (!targetHeading) {
    jsonError(`Template '${templateName}' not found for skill '${skill}'. Available: ${Object.keys(skillTemplates).join(", ")}`, "TEMPLATE_NOT_FOUND");
    return EXIT_ERROR;
  }

  const promptsPath = path.join(skillsDir, skill, "references", "prompts.md");
  let promptsMd;
  try {
    promptsMd = fs.readFileSync(promptsPath, "utf8");
  } catch (e) {
    jsonError(`Cannot read prompts.md: ${e.message}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  const template = extractTemplateSection(promptsMd, targetHeading);
  if (template === null) {
    jsonError(`Template heading '${targetHeading}' not found in prompts.md`, "TEMPLATE_NOT_FOUND");
    return EXIT_ERROR;
  }

  let placeholders = {};
  const stdinContent = readStdinSync().trim();
  if (stdinContent) {
    try {
      placeholders = JSON.parse(stdinContent);
    } catch (e) {
      jsonError(`Invalid JSON on stdin: ${e.message}`, "INVALID_INPUT");
      return EXIT_ERROR;
    }
  }

  // Auto-inject {OUTPUT_FORMAT}
  const outputFormatPath = path.join(skillsDir, skill, "references", "output-format.md");
  if (fs.existsSync(outputFormatPath) && !placeholders.OUTPUT_FORMAT) {
    const outputFormatMd = fs.readFileSync(outputFormatPath, "utf8");
    const fenceMatch = outputFormatMd.match(/```(?:markdown)?\n([\s\S]*?)```/);
    placeholders.OUTPUT_FORMAT = fenceMatch ? fenceMatch[1].trim() : outputFormatMd.trim();
  }

  // Auto-inject {CLAUDE_ANALYSIS_FORMAT}
  const claudeAnalysisPath = path.join(skillsDir, skill, "references", "claude-analysis-template.md");
  if (fs.existsSync(claudeAnalysisPath) && !placeholders.CLAUDE_ANALYSIS_FORMAT) {
    const claudeAnalysisMd = fs.readFileSync(claudeAnalysisPath, "utf8");
    const fenceMatch = claudeAnalysisMd.match(/```(?:markdown)?\n([\s\S]*?)```/);
    placeholders.CLAUDE_ANALYSIS_FORMAT = fenceMatch ? fenceMatch[1].trim() : claudeAnalysisMd.trim();
  }

  const guide = parsePlaceholderGuide(promptsMd);
  let rendered = template;
  const missingRequired = [];

  rendered = rendered.replace(/\{([A-Z][A-Z_0-9]{1,})\}/g, (match, name) => {
    if (placeholders[name] !== undefined && placeholders[name] !== null) return String(placeholders[name]);
    const guideEntry = guide.get(name);
    if (guideEntry && guideEntry.default !== null) return guideEntry.default;
    if (guideEntry && guideEntry.required) {
      missingRequired.push(name);
      return match;
    }
    return "";
  });

  if (missingRequired.length > 0) {
    jsonError(`Missing required placeholder(s): ${missingRequired.map(n => `{${n}}`).join(", ")}`, "MISSING_PLACEHOLDER");
    return EXIT_ERROR;
  }

  const remaining = rendered.match(/\{[A-Z][A-Z_0-9]{1,}\}/g);
  if (remaining) {
    process.stderr.write(`Warning: unresolved placeholders: ${remaining.join(", ")}\n`);
  }

  process.stdout.write(rendered);
  return EXIT_SUCCESS;
}

// ============================================================
// Subcommands
// ============================================================

function cmdInit(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "skill-name": { type: "string" },
      "working-dir": { type: "string" },
    },
    strict: true,
  });

  const skillName = values["skill-name"];
  const workingDir = values["working-dir"];

  if (!skillName || !workingDir) {
    process.stderr.write("Error: --skill-name and --working-dir are required\n");
    return EXIT_ERROR;
  }

  let resolvedWorkingDir;
  try {
    resolvedWorkingDir = fs.realpathSync(workingDir);
  } catch {
    process.stderr.write(`Error: working directory does not exist: ${workingDir}\n`);
    return EXIT_ERROR;
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${skillName}-${today}-`;
  const sessionsBase = path.join(resolvedWorkingDir, ".gemini-review", "sessions");
  fs.mkdirSync(sessionsBase, { recursive: true });

  let maxN = 0;
  try {
    for (const d of fs.readdirSync(sessionsBase)) {
      if (d.startsWith(prefix)) {
        const n = parseInt(d.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxN) maxN = n;
      }
    }
  } catch {}

  let sessionDir, sessionId, created = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    sessionId = `${prefix}${String(maxN + 1 + attempt).padStart(3, "0")}`;
    sessionDir = path.join(sessionsBase, sessionId);
    try {
      fs.mkdirSync(sessionDir);
      created = true;
      break;
    } catch (e) {
      if (e.code === "EEXIST") continue;
      throw e;
    }
  }

  if (!created) {
    process.stderr.write("Error: could not reserve session directory\n");
    return EXIT_ERROR;
  }

  fs.mkdirSync(path.join(sessionDir, "prompts"), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, "outputs"), { recursive: true });

  const now = Math.floor(Date.now() / 1000);
  atomicWrite(path.join(sessionDir, "state.json"), JSON.stringify({
    session_id: sessionId,
    runner_version: GEMINI_RUNNER_VERSION,
    skill_name: skillName,
    state_dir: sessionDir,
    working_dir: resolvedWorkingDir,
    round: 0,
    created_at: now,
    pid: null,
    timeout: null,
    started_at: null,
    gemini_session_id: null,
    model: DEFAULT_MODEL,
  }, null, 2));

  process.stdout.write(`GEMINI_SESSION:${sessionDir}\n`);
  return EXIT_SUCCESS;
}

function cmdStart(argv) {
  const sessionDir = argv[0];
  if (!sessionDir) {
    jsonError("Session directory argument required", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      effort: { type: "string", default: "high" },
      timeout: { type: "string", default: "600" },
    },
    strict: true,
  });

  const effort = values.effort || "high";
  const timeout = parseInt(values.timeout || "600", 10);

  let resolvedSessionDir;
  try {
    resolvedSessionDir = fs.realpathSync(sessionDir);
  } catch {
    jsonError(`Session directory does not exist: ${sessionDir}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  let state;
  try {
    state = readState(resolvedSessionDir);
  } catch (e) {
    jsonError(`Cannot read state.json: ${e.message}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  if (state.round !== 0) {
    jsonError("Session already started. Use resume for subsequent rounds.", "PRECONDITION_FAILED");
    return EXIT_ERROR;
  }

  // Check gemini in PATH
  const whichCmd = IS_WIN ? "where" : "which";
  const probe = spawnSync(whichCmd, ["gemini"], { encoding: "utf8" });
  if (probe.status !== 0) {
    jsonError("gemini CLI not found in PATH", "GEMINI_NOT_FOUND");
    return EXIT_GEMINI_NOT_FOUND;
  }

  const resolvedWorkingDir = state.working_dir;
  const promptFile = path.join(resolvedSessionDir, "prompt.txt");

  const stdinContent = readStdinSync();
  if (stdinContent.trim()) {
    fs.writeFileSync(promptFile, stdinContent, "utf8");
  } else if (!fs.existsSync(promptFile) || !fs.readFileSync(promptFile, "utf8").trim()) {
    jsonError("No prompt provided (pipe via stdin or pre-write prompt.txt)", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  fs.writeFileSync(path.join(resolvedSessionDir, "prompts", "round-001.txt"), fs.readFileSync(promptFile, "utf8"), "utf8");

  // Clear stale output
  try { fs.unlinkSync(path.join(resolvedSessionDir, "output.json")); } catch {}

  try {
    const { pid } = launchGemini(resolvedSessionDir, resolvedWorkingDir, null, effort);
    const now = Math.floor(Date.now() / 1000);
    updateState(resolvedSessionDir, {
      round: 1,
      pid,
      timeout,
      started_at: now,
      gemini_session_id: null,
    });
    writeRounds(resolvedSessionDir, [{
      round: 1,
      started_at: now,
      completed_at: null,
      elapsed_seconds: null,
      status: "running",
      verdict: null,
      issues_found: null,
    }]);
  } catch (e) {
    jsonError(e.message, "LAUNCH_FAILED");
    return EXIT_ERROR;
  }

  jsonOut({ status: "started", session_dir: resolvedSessionDir, round: 1 });
  return EXIT_SUCCESS;
}

function cmdResume(argv) {
  const sessionDir = argv[0];
  if (!sessionDir) {
    jsonError("Session directory argument required", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      effort: { type: "string", default: "high" },
      timeout: { type: "string", default: "600" },
    },
    strict: true,
  });

  const effort = values.effort || "high";
  const timeout = parseInt(values.timeout || "600", 10);

  let resolvedSessionDir;
  try {
    resolvedSessionDir = fs.realpathSync(sessionDir);
  } catch {
    jsonError(`Session directory does not exist: ${sessionDir}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  let prevState;
  try {
    prevState = readState(resolvedSessionDir);
  } catch (e) {
    jsonError(`Cannot read state.json: ${e.message}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  const geminiSessionId = prevState.gemini_session_id || "";
  if (!geminiSessionId) {
    jsonError("No gemini_session_id found — cannot resume. Session may have failed on start.", "SESSION_BROKEN");
    return EXIT_ERROR;
  }

  const rounds = readRounds(resolvedSessionDir);
  if (rounds.length > 0 && rounds[rounds.length - 1].status === "running") {
    jsonError("Round still running — poll first before resuming", "ROUND_STILL_RUNNING");
    return EXIT_ERROR;
  }

  // Check gemini in PATH
  const whichCmd = IS_WIN ? "where" : "which";
  const probe = spawnSync(whichCmd, ["gemini"], { encoding: "utf8" });
  if (probe.status !== 0) {
    jsonError("gemini CLI not found in PATH", "GEMINI_NOT_FOUND");
    return EXIT_GEMINI_NOT_FOUND;
  }

  const resolvedWorkingDir = prevState.working_dir;
  const promptFile = path.join(resolvedSessionDir, "prompt.txt");
  const currentRound = prevState.round || 0;
  const newRound = currentRound + 1;

  const stdinContent = readStdinSync();
  if (stdinContent.trim()) {
    fs.writeFileSync(promptFile, stdinContent, "utf8");
  } else if (!fs.existsSync(promptFile) || !fs.readFileSync(promptFile, "utf8").trim()) {
    jsonError("No prompt provided", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  fs.writeFileSync(
    path.join(resolvedSessionDir, "prompts", `round-${String(newRound).padStart(3, "0")}.txt`),
    fs.readFileSync(promptFile, "utf8"), "utf8"
  );

  // Archive current output
  const outputFile = path.join(resolvedSessionDir, "output.json");
  if (fs.existsSync(outputFile)) {
    try {
      fs.copyFileSync(outputFile, path.join(resolvedSessionDir, "outputs", `output-round-${String(currentRound).padStart(3, "0")}.json`));
    } catch {}
    try { fs.unlinkSync(outputFile); } catch {}
  }
  try { fs.unlinkSync(path.join(resolvedSessionDir, "review.md")); } catch {}
  try { fs.unlinkSync(path.join(resolvedSessionDir, "final.txt")); } catch {}

  try {
    const { pid } = launchGemini(resolvedSessionDir, resolvedWorkingDir, geminiSessionId, effort);
    const now = Math.floor(Date.now() / 1000);
    updateState(resolvedSessionDir, {
      round: newRound,
      pid,
      timeout,
      started_at: now,
      gemini_session_id: geminiSessionId,
    });
    rounds.push({
      round: newRound,
      started_at: now,
      completed_at: null,
      elapsed_seconds: null,
      status: "running",
      verdict: null,
      issues_found: null,
    });
    writeRounds(resolvedSessionDir, rounds);
  } catch (e) {
    jsonError(e.message, "LAUNCH_FAILED");
    return EXIT_ERROR;
  }

  jsonOut({ status: "started", session_dir: resolvedSessionDir, round: newRound, thread_id: geminiSessionId });
  return EXIT_SUCCESS;
}

function cmdPoll(argv) {
  const stateDirArg = argv[0];
  if (!stateDirArg) {
    jsonError("Invalid or missing state directory", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  let stateDir;
  try {
    stateDir = fs.realpathSync(stateDirArg);
  } catch {
    jsonError("Invalid or missing state directory", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  // Return cached result if available
  const finalFile = path.join(stateDir, "final.txt");
  if (fs.existsSync(finalFile)) {
    const cached = fs.readFileSync(finalFile, "utf8");
    process.stdout.write(cached);
    if (!cached.endsWith("\n")) process.stdout.write("\n");
    return EXIT_SUCCESS;
  }

  const state = readState(stateDir);
  const geminiPid = state.pid || 0;
  const timeoutVal = state.timeout || 600;
  const startedAt = state.started_at || Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - startedAt;

  const processAlive = isAlive(geminiPid);
  let result = parseGeminiOutput(stateDir, elapsed, processAlive, timeoutVal, state);

  if (result.terminal) {
    // Update rounds.json
    const rounds = readRounds(stateDir);
    if (rounds.length > 0) {
      const currentRoundObj = rounds[rounds.length - 1];
      if (currentRoundObj.status === "running") {
        currentRoundObj.status = result.json.status;
        currentRoundObj.completed_at = now;
        currentRoundObj.elapsed_seconds = now - currentRoundObj.started_at;

        if (result.json.review) {
          const review = result.json.review;
          if (review.verdict && review.verdict.status) currentRoundObj.verdict = review.verdict.status;
          if (review.blocks) {
            currentRoundObj.issues_found = review.blocks.length;
            currentRoundObj.issue_ids = review.blocks.filter(b => b.prefix === "ISSUE").map(b => b.id).sort((a, b) => a - b);
          }
          if (review.suggested_status) currentRoundObj.verdict = review.suggested_status;
        }
        writeRounds(stateDir, rounds);

        // Stalemate detection
        if (result.json.status === "completed" && rounds.length >= 2) {
          const prevRound = rounds[rounds.length - 2];
          if (prevRound.issue_ids && currentRoundObj.issue_ids) {
            const prevIds = prevRound.issue_ids;
            const currIds = currentRoundObj.issue_ids;
            if (currIds.length === 0 && prevIds.length === 0) {
              result.json.convergence = { stalemate: false, reason: "no_issue_blocks_tracked" };
            } else {
              const prevSet = new Set(prevIds);
              const currSet = new Set(currIds);
              const newIssues = currIds.filter(id => !prevSet.has(id));
              const resolvedIssues = prevIds.filter(id => !currSet.has(id));
              const sameSet = prevIds.length === currIds.length && prevIds.every(id => currSet.has(id));
              if (sameSet && newIssues.length === 0) {
                result.json.convergence = {
                  stalemate: true,
                  reason: `Same ${currIds.length} open issue(s) for 2 consecutive rounds`,
                  unchanged_issue_ids: currIds,
                };
              } else {
                result.json.convergence = { stalemate: false, new_issues: newIssues, resolved_issues: resolvedIssues };
              }
            }
          }
        }
      }
    }

    atomicWrite(finalFile, JSON.stringify(result.json));

    // Store gemini session ID for future resumes
    if (result.geminiSessionId) {
      updateState(stateDir, { gemini_session_id: result.geminiSessionId });
    }
  }

  updateState(stateDir, { last_poll_at: now });
  jsonOut(result.json);
  return EXIT_SUCCESS;
}

function cmdStop(argv) {
  const stateDirArg = argv[0];
  if (!stateDirArg) {
    jsonError("State directory argument required", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  let stateDir;
  try {
    stateDir = fs.realpathSync(stateDirArg);
  } catch {
    jsonError("Invalid or missing state directory", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  try {
    const state = readState(stateDir);
    if (state.pid && isAlive(state.pid)) killSingle(state.pid);
    const rounds = readRounds(stateDir);
    const now = Math.floor(Date.now() / 1000);
    let modified = false;
    for (const round of rounds) {
      if (round.status === "running") {
        round.status = "stopped";
        round.completed_at = now;
        round.elapsed_seconds = now - round.started_at;
        modified = true;
      }
    }
    if (modified) writeRounds(stateDir, rounds);
  } catch {}

  jsonOut({ status: "stopped", session_dir: stateDir });
  return EXIT_SUCCESS;
}

function cmdFinalize(argv) {
  const sessionDir = argv[0];
  if (!sessionDir) {
    jsonError("Session directory argument required", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  let resolvedSessionDir;
  try {
    resolvedSessionDir = fs.realpathSync(sessionDir);
  } catch {
    jsonError(`Session directory does not exist: ${sessionDir}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  let state;
  try {
    state = readState(resolvedSessionDir);
  } catch (e) {
    jsonError(`Cannot read state.json: ${e.message}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  const rounds = readRounds(resolvedSessionDir);
  for (const round of rounds) {
    if (round.status === "running") {
      jsonError("Cannot finalize: round " + round.round + " is still running", "PRECONDITION_FAILED");
      return EXIT_ERROR;
    }
  }

  let overrides = {};
  const stdinContent = readStdinSync().trim();
  if (stdinContent) {
    try { overrides = JSON.parse(stdinContent); } catch (e) {
      jsonError(`Invalid JSON on stdin: ${e.message}`, "INVALID_INPUT");
      return EXIT_ERROR;
    }
  }

  const perRound = rounds.map(r => r.elapsed_seconds || 0);
  const totalSeconds = perRound.reduce((a, b) => a + b, 0);

  let verdict = overrides.verdict;
  if (!verdict) {
    for (let i = rounds.length - 1; i >= 0; i--) {
      if (rounds[i].verdict) { verdict = rounds[i].verdict; break; }
    }
  }

  if (!verdict) {
    jsonError("No verdict available — provide via stdin or ensure at least one round has a verdict", "PRECONDITION_FAILED");
    return EXIT_ERROR;
  }

  const meta = {
    skill: state.skill_name || "",
    runner_version: GEMINI_RUNNER_VERSION,
    model: state.model || DEFAULT_MODEL,
    scope: overrides.scope || null,
    base_branch: overrides.base_branch || null,
    rounds: rounds.length,
    verdict,
    timing: { total_seconds: totalSeconds, per_round: perRound },
    timestamp: new Date().toISOString(),
    session_dir: resolvedSessionDir,
  };

  if (overrides.custom_notes) meta.custom_notes = overrides.custom_notes;
  if (overrides.issues) meta.issues = overrides.issues;

  atomicWrite(path.join(resolvedSessionDir, "meta.json"), JSON.stringify(meta, null, 2));
  jsonOut({ status: "finalized", meta });
  return EXIT_SUCCESS;
}

function cmdStatus(argv) {
  const sessionDir = argv[0];
  if (!sessionDir) {
    jsonError("Session directory argument required", "INVALID_INPUT");
    return EXIT_ERROR;
  }

  let resolvedSessionDir;
  try {
    resolvedSessionDir = fs.realpathSync(sessionDir);
  } catch {
    jsonError(`Session directory does not exist: ${sessionDir}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  let state;
  try {
    state = readState(resolvedSessionDir);
  } catch (e) {
    jsonError(`Cannot read state.json: ${e.message}`, "IO_ERROR");
    return EXIT_ERROR;
  }

  const rounds = readRounds(resolvedSessionDir);
  const hasReview = fs.existsSync(path.join(resolvedSessionDir, "review.md"));
  const hasMeta = fs.existsSync(path.join(resolvedSessionDir, "meta.json"));

  jsonOut({
    status: "ok",
    session_id: state.session_id,
    skill: state.skill_name,
    runner_version: state.runner_version || GEMINI_RUNNER_VERSION,
    model: state.model || DEFAULT_MODEL,
    round: state.round,
    gemini_session_id: state.gemini_session_id,
    created_at: state.created_at,
    rounds: rounds.map(r => ({
      round: r.round,
      started_at: r.started_at,
      completed_at: r.completed_at || null,
      elapsed_seconds: r.elapsed_seconds || null,
      status: r.status,
      verdict: r.verdict || null,
      issues_found: r.issues_found != null ? r.issues_found : null,
    })),
    has_review: hasReview,
    has_meta: hasMeta,
  });
  return EXIT_SUCCESS;
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] || "";
  const rest = argv.slice(1);

  let exitCode;

  switch (command) {
    case "version":
      process.stdout.write(`${GEMINI_RUNNER_VERSION}\n`);
      exitCode = EXIT_SUCCESS;
      break;
    case "init":
      exitCode = cmdInit(rest);
      break;
    case "start":
      exitCode = cmdStart(rest);
      break;
    case "resume":
      exitCode = cmdResume(rest);
      break;
    case "poll":
      exitCode = cmdPoll(rest);
      break;
    case "stop":
      exitCode = cmdStop(rest);
      break;
    case "finalize":
      exitCode = cmdFinalize(rest);
      break;
    case "status":
      exitCode = cmdStatus(rest);
      break;
    case "render":
      exitCode = cmdRender(rest);
      break;
    default:
      process.stderr.write(
        "gemini-runner.js — Gemini CLI runner for review skills (v1)\n\n" +
        "Usage:\n" +
        "  node gemini-runner.js version\n" +
        "  node gemini-runner.js init --skill-name <name> --working-dir <dir>\n" +
        "  echo PROMPT | node gemini-runner.js start <session_dir> [--effort <level>] [--timeout <s>]\n" +
        "  echo PROMPT | node gemini-runner.js resume <session_dir> [--effort <level>]\n" +
        "  node gemini-runner.js poll <session_dir>\n" +
        "  node gemini-runner.js stop <session_dir>\n" +
        "  echo JSON | node gemini-runner.js finalize <session_dir>\n" +
        "  node gemini-runner.js status <session_dir>\n" +
        "  echo JSON | node gemini-runner.js render --skill <name> --template <name> --skills-dir <path>\n",
      );
      exitCode = command ? EXIT_ERROR : EXIT_SUCCESS;
      break;
  }

  if (exitCode >= 0) process.exit(exitCode);
}

main();
