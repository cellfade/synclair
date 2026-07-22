#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { access, readFile, readdir } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const workflowDir = path.join(root, ".github/workflows")
const workflowNames = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/.test(name)).sort()
const failures = []
const requireActionlint = process.argv.includes("--require-actionlint")

for (const name of workflowNames) {
  const source = await readFile(path.join(workflowDir, name), "utf8")
  if (!/^permissions:/m.test(source)) {
    failures.push(`${name}: workflow must declare explicit least-privilege permissions`)
  }
  const checkoutCount = [...source.matchAll(/uses:\s*actions\/checkout@/g)].length
  const nonPersistentCheckoutCount = [...source.matchAll(/persist-credentials:\s*false/g)].length
  if (checkoutCount !== nonPersistentCheckoutCount) {
    failures.push(`${name}: every checkout must set persist-credentials: false`)
  }
  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) {
    const use = match[1]
    if (use.startsWith("./") || use.startsWith("docker://")) continue
    if (!/@[a-f0-9]{40}$/.test(use)) failures.push(`${name}: action is not pinned to a full SHA: ${use}`)
  }
  if (
    name === "foundation-release.yml" &&
    /(?:actions\/upload-|gh\s+release|vercel\s+(?:deploy|promote)|npm\s+publish)/i.test(source)
  ) {
    failures.push(`${name}: validation workflow must not contain a publishing or deployment command`)
  }
  if (name === "synclair-catalog.yml") {
    if (!/^  comment:\n    needs: gate/m.test(source)) {
      failures.push(`${name}: writable PR commenting must be isolated in a separate job`)
    }
    const commentJob = source.split(/^  comment:\s*$/m)[1] ?? ""
    if (/actions\/checkout|ci-pr-catalog-check/.test(commentJob)) {
      failures.push(`${name}: writable comment job must not check out or execute PR code`)
    }
  }
}

const binary = path.join(root, "tools/bin/actionlint")
try {
  await access(binary)
  const result = spawnSync(binary, [], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) failures.push(result.stdout || result.stderr || "actionlint failed")
} catch {
  if (requireActionlint) failures.push("checksum-pinned actionlint is required but is not installed")
}

if (failures.length) {
  console.error("Workflow gate failed:")
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`Workflows valid: ${workflowNames.length} file(s), immutable action pins enforced.`)
