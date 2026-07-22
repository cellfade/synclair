#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import Ajv from "ajv"

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const schema = JSON.parse(
  await readFile(path.join(scriptRoot, "schemas/synclair.project.schema.json"), "utf8"),
)
const ajv = new Ajv({ allErrors: true, strict: true })
const validateSchema = ajv.compile(schema)

function validationMessage(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ")
}

export async function validateProjectManifest(manifest, { reachableCommit } = {}) {
  if (!validateSchema(manifest)) {
    throw new Error(`Invalid synclair.project.json: ${validationMessage(validateSchema.errors)}`)
  }
  if (reachableCommit !== undefined && reachableCommit !== manifest.synclair.foundation.commit) {
    throw new Error(
      `Foundation commit mismatch: manifest has ${manifest.synclair.foundation.commit}, provider resolved ${reachableCommit}`,
    )
  }
  return manifest
}

export function parseSubtreeFoundationCommit(logText, expectedPath) {
  const blocks = logText.split("\0")
  for (const block of blocks) {
    const directory = block.match(/^git-subtree-dir:\s*(.+)$/m)?.[1]?.trim()
    const commit = block.match(/^git-subtree-split:\s*([0-9a-f]{40})$/m)?.[1]
    if (directory === expectedPath && commit) return commit
  }
  throw new Error(`Subtree provenance for ${expectedPath} was not found in Git history`)
}

function flagValue(args, flag) {
  const index = args.indexOf(flag)
  if (index < 0) return null
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const manifestPath = args.find((argument) => !argument.startsWith("--")) ?? "synclair.project.json"
  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8"))
  await validateProjectManifest(manifest)

  if (args.includes("--verify-remote")) {
    const expected = manifest.synclair.foundation.commit
    const resolved = spawnSync(
      "gh",
      ["api", `repos/cellfade/synclair/commits/${expected}`, "--jq", ".sha"],
      { encoding: "utf8" },
    )
    if (resolved.status !== 0) {
      throw new Error(`Could not verify the private foundation commit: ${resolved.stderr.trim()}`)
    }
    await validateProjectManifest(manifest, { reachableCommit: resolved.stdout.trim() })
  }

  if (args.includes("--check-subtree")) {
    const repositoryRoot = flagValue(args, "--repository-root") ?? process.cwd()
    const log = spawnSync(
      "git",
      ["log", "HEAD", "--format=%B%x00", "--", manifest.synclair.path],
      { cwd: repositoryRoot, encoding: "utf8" },
    )
    if (log.status !== 0) throw new Error(`Could not read subtree history: ${log.stderr.trim()}`)
    const installed = parseSubtreeFoundationCommit(log.stdout, manifest.synclair.path)
    if (installed !== manifest.synclair.foundation.commit) {
      throw new Error(
        `Subtree foundation mismatch: manifest has ${manifest.synclair.foundation.commit}, installed ${installed}`,
      )
    }
  }

  console.log(
    `Synclair project manifest valid: private ${manifest.repository.owner}/${manifest.repository.name}, ` +
      `${manifest.application.framework}, ${manifest.synclair.delivery.strategy}, ` +
      `foundation ${manifest.synclair.foundation.commit}.`,
  )
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
