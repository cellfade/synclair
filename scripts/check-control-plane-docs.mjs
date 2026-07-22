#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const preflightPath = path.join(root, "docs/control-plane/preflight.md")
const failures = []

let preflight = ""
try {
  preflight = await readFile(preflightPath, "utf8")
} catch (error) {
  if (error?.code === "ENOENT") {
    failures.push("docs/control-plane/preflight.md is required")
  } else {
    throw error
  }
}

const requiredEvidence = [
  ["GitHub owner", /GitHub owner:\s*`cellfade`/],
  ["private repository visibility", /Repository visibility:\s*`private`/],
  ["Vercel scope recording status", /Vercel scope status:\s*`not recorded`/],
  ["Node.js major version", /Node\.js:\s*`22\.x`/],
  ["pnpm major version", /pnpm:\s*`10\.x`/],
  ["foundation release approval boundary", /foundation release\/tag publication/i],
  ["control-plane repository approval boundary", /control-plane repository creation/i],
  ["provider configuration approval boundary", /provider integration registration/i],
  ["production approval boundary", /production promotion/i],
]

for (const [label, pattern] of requiredEvidence) {
  if (preflight && !pattern.test(preflight)) failures.push(`preflight is missing ${label}`)
}

const forbiddenCredentialShapes = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

for (const pattern of forbiddenCredentialShapes) {
  if (pattern.test(preflight)) failures.push("preflight must not contain credential values")
}

if (failures.length > 0) {
  console.error("Control-plane documentation check failed:")
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log("Control-plane preflight contract is complete and secret-free.")
