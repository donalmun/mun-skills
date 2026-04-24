#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const REPO = "donalmun/mun-skills";
const BRANCH = "main";
const SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

const REGISTRY = {
  xia: "Extract, compare, and port features from any GitHub repo into your project",
  "gemini-commit-review": "Claude × Gemini debate on committed code quality — report only, no edits",
  "gemini-impl-review": "Claude × Gemini review of uncommitted changes — auto-applies agreed fixes",
  "gemini-plan-review": "Claude × Gemini debate on implementation plans before you write a line of code",
  "gemini-pr-review": "Claude × Gemini debate on PR quality and merge readiness",
  "gemini-security-review": "OWASP/CWE security audit via Claude × Gemini adversarial debate",
  "gemini-think-about": "Claude × Gemini peer debate on any technical question — reaches consensus or flags disagreement",
};

const [, , command, ...args] = process.argv;

function help() {
  console.log(`
  mun-skills — Claude Code skill installer

  Usage:
    npx mun-skills list                        List available skills
    npx mun-skills install <skill> [skill...]  Install one or more skills
    npx mun-skills install --all               Install all skills
    npx mun-skills update <skill> [skill...]   Update installed skills

  Examples:
    npx mun-skills install xia
    npx mun-skills install gemini-pr-review gemini-think-about
    npx mun-skills install --all
`);
}

function list() {
  console.log("\n  Available skills:\n");
  const maxLen = Math.max(...Object.keys(REGISTRY).map((k) => k.length));
  for (const [name, desc] of Object.entries(REGISTRY)) {
    const installed = fs.existsSync(path.join(SKILLS_DIR, name));
    const tag = installed ? " [installed]" : "";
    console.log(`  ${name.padEnd(maxLen)}  ${desc}${tag}`);
  }
  console.log();
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "mun-skills-cli" } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

async function install(targets) {
  if (targets.includes("--all")) {
    targets = Object.keys(REGISTRY);
  }

  const unknown = targets.filter((t) => !REGISTRY[t]);
  if (unknown.length) {
    console.error(`\n  Unknown skill(s): ${unknown.join(", ")}`);
    console.error("  Run `npx mun-skills list` to see available skills.\n");
    process.exit(1);
  }

  console.log(`\n  Downloading from ${REPO}...`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mun-skills-"));
  const tarball = path.join(tmpDir, "repo.tar.gz");
  const extractDir = path.join(tmpDir, "extracted");

  try {
    await download(`https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz`, tarball);

    fs.mkdirSync(extractDir);
    execSync(`tar -xzf "${tarball}" -C "${extractDir}"`, { stdio: "pipe" });

    // GitHub extracts to <repo>-<branch>/
    const extracted = fs.readdirSync(extractDir)[0];
    const repoRoot = path.join(extractDir, extracted);

    fs.mkdirSync(SKILLS_DIR, { recursive: true });

    console.log();
    let count = 0;
    for (const skill of targets) {
      const src = path.join(repoRoot, skill);
      const dst = path.join(SKILLS_DIR, skill);

      if (!fs.existsSync(src)) {
        console.log(`  ✗ ${skill} — not found in registry`);
        continue;
      }

      const action = fs.existsSync(dst) ? "updated" : "installed";
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
      fs.cpSync(src, dst, { recursive: true });
      console.log(`  ✓ ${skill} (${action})`);
      count++;
    }

    console.log(`\n  ${count} skill(s) ready in ${SKILLS_DIR}`);
    console.log("  Reload your Claude Code session to activate.\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    help();
    return;
  }

  if (command === "list") {
    list();
    return;
  }

  if (command === "install" || command === "update") {
    if (!args.length) {
      console.error("\n  Specify skill(s) or use --all\n");
      help();
      process.exit(1);
    }
    await install(args);
    return;
  }

  console.error(`\n  Unknown command: ${command}\n`);
  help();
  process.exit(1);
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});
