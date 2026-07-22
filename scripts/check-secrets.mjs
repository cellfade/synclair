#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
const fixturePath = "test/fixtures/secrets/fake-github-token.txt"
const gitleaks = path.join(root, "tools/bin/gitleaks")

const credentialShapes = [
  ["synthetic-test-secret", /SYNCLAIR_TEST_SECRET=[A-Za-z0-9-]{20,}/g],
  ["github-token", /gh[pousr]_[A-Za-z0-9]{36,}/g],
  ["openai-token", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]

export function scanTextForCredentialShapes(source) {
  return credentialShapes.filter(([, pattern]) => {
    pattern.lastIndex = 0
    return pattern.test(source)
  }).map(([name]) => name)
}

function repositoryFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
  if (result.status !== 0) throw new Error(result.stderr || "could not enumerate repository files")
  return result.stdout.split("\0").filter(Boolean).sort()
}

async function offlineCleanScan() {
  const findings = []
  for (const relativePath of repositoryFiles()) {
    if (relativePath === fixturePath || relativePath.startsWith("dist/")) continue
    let source
    try {
      source = await readFile(path.join(root, relativePath), "utf8")
    } catch {
      continue
    }
    const matches = scanTextForCredentialShapes(source)
    if (matches.length) findings.push(`${relativePath}: ${matches.join(", ")}`)
  }
  if (findings.length) throw new Error(`credential-shaped content found:\n${findings.join("\n")}`)
}

function runGitleaks(args, expectedStatus = 0) {
  const result = spawnSync(gitleaks, args, { cwd: root, encoding: "utf8" })
  if (result.status !== expectedStatus) {
    const safeOutput = `${result.stdout}\n${result.stderr}`.replace(
      /gh[pousr]_[A-Za-z0-9]{20,}/g,
      "REDACTED",
    )
    throw new Error(`Gitleaks exited ${result.status}; expected ${expectedStatus}: ${safeOutput.trim()}`)
  }
}

function proveNegativeFixture() {
  const fixture = readFileSync(path.join(root, fixturePath), "utf8")
  if (!scanTextForCredentialShapes(fixture).includes("synthetic-test-secret")) {
    throw new Error("negative fixture is not detected by the offline scanner")
  }
  if (!existsSync(gitleaks)) return

  const scratch = mkdtempSync(path.join(tmpdir(), "synclair-gitleaks-negative-"))
  try {
    const config = path.join(scratch, "gitleaks.toml")
    writeFileSync(
      config,
      `[[rules]]
id = "synclair-negative-fixture"
description = "Synthetic test secret"
regex = '''SYNCLAIR_TEST_SECRET=[A-Za-z0-9-]{20,}'''
`,
      { mode: 0o600 },
    )
    runGitleaks(
      ["dir", fixturePath, "--config", config, "--redact", "--no-banner", "--exit-code", "42"],
      42,
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function runCleanGitleaksScan() {
  const scratch = mkdtempSync(path.join(tmpdir(), "synclair-gitleaks-clean-"))
  try {
    for (const relativePath of repositoryFiles()) {
      if (relativePath === fixturePath || relativePath.startsWith("dist/")) continue
      const source = path.join(root, relativePath)
      const destination = path.join(scratch, relativePath)
      mkdirSync(path.dirname(destination), { recursive: true })
      try {
        copyFileSync(source, destination)
      } catch {
        // Unsupported/special paths are already rejected by the release walker.
      }
    }
    runGitleaks(["dir", scratch, "--config", path.join(root, ".gitleaks.toml"), "--redact", "--no-banner"])
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

async function main() {
  const requireGitleaks = process.argv.includes("--require-gitleaks")
  if (requireGitleaks && !existsSync(gitleaks)) {
    throw new Error("checksum-pinned Gitleaks is required but is not installed")
  }

  proveNegativeFixture()
  await offlineCleanScan()
  if (existsSync(gitleaks)) {
    runCleanGitleaksScan()
  }
  console.log(
    `Secret scan clean; negative fixture detected${existsSync(gitleaks) ? " by offline and Gitleaks checks" : " by offline check (Gitleaks not installed)"}.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Secret scan failed: ${error.message}`)
    process.exit(1)
  })
}
