#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
const policyPath = path.join(root, "config/vercel-capability-policy.json")
const versionPath = path.join(root, "tools/vercel-cli.version")

export function assertPinnedCliVersion(output, pinnedVersion) {
  const installedVersion = output.match(/\d+\.\d+\.\d+/)?.[0]
  if (!installedVersion) throw new Error("Unable to parse the installed Vercel CLI version")
  if (installedVersion !== pinnedVersion) {
    throw new Error(
      `Installed Vercel CLI ${installedVersion} does not match pinned version ${pinnedVersion}`
    )
  }
  return installedVersion
}

function assertSecretFree(value, trail = "report") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSecretFree(entry, `${trail}[${index}]`))
    return
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/(?:token|secret|password|cookie|authorization|privateKey)/i.test(key)) {
        throw new Error(`${trail}.${key} is a credential field and must not be recorded`)
      }
      assertSecretFree(entry, `${trail}.${key}`)
    }
    return
  }
  if (typeof value === "string") {
    if (/gh[pousr]_[A-Za-z0-9]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(value)) {
      throw new Error(`${trail} contains a credential-shaped value`)
    }
  }
}

export function validateCapabilityReport(
  report,
  policy,
  pinnedVersion,
  { requireResolved = false } = {},
) {
  if (report?.schemaVersion !== 1) throw new Error("Capability report schemaVersion must be 1")
  if (report.cliVersion !== pinnedVersion) {
    throw new Error(`Capability report CLI version must be ${pinnedVersion}`)
  }
  const immutableId = /^(?!not[-_ ]?recorded$)[A-Za-z0-9_-]{6,}$/i
  if (
    !immutableId.test(report.scope?.userId ?? "") ||
    !immutableId.test(report.scope?.teamId ?? "")
  ) {
    throw new Error("Capability report must record immutable Vercel userId and teamId")
  }

  assertSecretFree(report)

  for (const [name, capabilityPolicy] of Object.entries(policy.capabilities)) {
    const result = report.capabilities?.[name]
    if (!result || !policy.allowedStatuses.includes(result.status)) {
      throw new Error(`${name} must have one allowed capability status`)
    }
    if (requireResolved && result.status === "not-checked") {
      throw new Error(`${name} must be resolved by an approved read-only provider check`)
    }
    if (requireResolved && capabilityPolicy.required && result.status !== "available") {
      throw new Error(
        `${name} is required and must be available; fallback ${capabilityPolicy.fallback} blocks dependent provider writes`,
      )
    }
    if (result.status !== "not-checked" && !result.evidence) {
      throw new Error(`${name} must include a secret-free evidence reference`)
    }
    if (result.status === "unavailable" && result.fallback !== capabilityPolicy.fallback) {
      throw new Error(`${name} must record fallback ${capabilityPolicy.fallback}`)
    }
  }

  return report
}

async function readContract() {
  const [policyText, versionText] = await Promise.all([
    readFile(policyPath, "utf8"),
    readFile(versionPath, "utf8"),
  ])
  const policy = JSON.parse(policyText)
  const pinnedVersion = versionText.trim()

  if (policy.schemaVersion !== 1) throw new Error("Unsupported Vercel capability policy")
  if (!/^\d+\.\d+\.\d+$/.test(pinnedVersion)) {
    throw new Error("tools/vercel-cli.version must contain one exact semantic version")
  }
  if (Object.keys(policy.capabilities ?? {}).length !== 5) {
    throw new Error("Vercel capability policy must define all five Phase 0 capabilities")
  }

  return { policy, pinnedVersion }
}

function inspectInstalledCli(pinnedVersion, required) {
  if (!required) return null

  const executable = process.env.VERCEL_BIN || "vercel"
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      NO_UPDATE_NOTIFIER: "1",
      VERCEL_TELEMETRY_DISABLED: "1",
    },
  })

  if (result.error?.code === "ENOENT") {
    if (required) throw new Error("Pinned Vercel CLI is not installed or not on PATH")
    return null
  }
  if (result.status !== 0) {
    throw new Error(`Vercel CLI version check failed with exit code ${result.status}`)
  }

  return assertPinnedCliVersion(`${result.stdout}\n${result.stderr}`, pinnedVersion)
}

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes("--check-only")
  const requireCli = args.includes("--require-cli")
  const requireResolved = args.includes("--require-resolved")
  const reportIndex = args.indexOf("--report")
  const knownArgs = new Set(["--check-only", "--require-cli", "--require-resolved", "--report"])
  const unknown = args.filter((arg, index) => !knownArgs.has(arg) && index !== reportIndex + 1)
  if (unknown.length > 0 || (!checkOnly && reportIndex < 0)) {
    throw new Error(
      "Usage: node scripts/probe-vercel-capabilities.mjs --check-only [--require-cli] [--require-resolved] [--report <file>]"
    )
  }
  if (requireResolved && reportIndex < 0) {
    throw new Error("--require-resolved requires a sanitized --report file")
  }

  const { policy, pinnedVersion } = await readContract()
  const installedVersion = inspectInstalledCli(pinnedVersion, requireCli)

  if (reportIndex >= 0) {
    const reportFile = args[reportIndex + 1]
    if (!reportFile) throw new Error("--report requires a path to a sanitized JSON report")
    const report = JSON.parse(await readFile(path.resolve(root, reportFile), "utf8"))
    validateCapabilityReport(report, policy, pinnedVersion, { requireResolved })
  }

  const cliStatus = installedVersion
    ? `installed ${installedVersion}`
    : `committed pin ${pinnedVersion} (CLI not executed)`
  const resolution = requireResolved
    ? "sanitized provider evidence is fully resolved and every required capability is available"
    : "provider capabilities remain unresolved until `npm run preflight:vercel`"
  const boundary = requireCli
    ? "The CLI version check ran with provider credentials removed; provider evidence came only from the sanitized report."
    : "No CLI or provider call was made."
  console.log(`Vercel capability contract valid; CLI ${cliStatus}; ${resolution}. ${boundary}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Vercel capability probe failed: ${error.message}`)
    process.exit(1)
  })
}
