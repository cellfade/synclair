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

function git(repositoryRoot, args) {
  return spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" })
}

export function readSubtreeFoundationCommit(repositoryRoot, expectedPath, { expectedTree } = {}) {
  const history = git(repositoryRoot, ["rev-list", "--merges", "--parents", "HEAD"])
  if (history.status !== 0) {
    throw new Error(`Could not read subtree history: ${history.stderr.trim()}`)
  }

  for (const line of history.stdout.trim().split("\n").filter(Boolean)) {
    const [mergeCommit, ...parents] = line.split(" ")
    const mergedParents = parents.slice(1)
    for (const candidate of mergedParents) {
      const message = git(repositoryRoot, ["show", "-s", "--format=%B", candidate])
      if (message.status !== 0) continue

      let foundationCommit
      try {
        foundationCommit = parseSubtreeFoundationCommit(message.stdout, expectedPath)
      } catch {
        continue
      }

      const prefixTree = git(repositoryRoot, ["rev-parse", `${mergeCommit}:${expectedPath}`])
      const candidateTree = git(repositoryRoot, ["rev-parse", `${candidate}^{tree}`])
      const splitTree = expectedTree
        ? { status: 0, stdout: expectedTree }
        : git(repositoryRoot, ["rev-parse", `${foundationCommit}^{tree}`])
      if (prefixTree.status !== 0 || candidateTree.status !== 0) continue
      if (prefixTree.stdout.trim() !== candidateTree.stdout.trim()) continue
      if (
        splitTree.status !== 0 ||
        candidateTree.stdout.trim() !== splitTree.stdout.trim()
      ) {
        throw new Error(
          `Subtree provenance for ${expectedPath} does not match its pinned foundation tree`,
        )
      }
      return foundationCommit
    }
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
  let remoteFoundationTree

  if (args.includes("--verify-remote")) {
    const expected = manifest.synclair.foundation.commit
    const resolved = spawnSync(
      "gh",
      [
        "api",
        `repos/cellfade/synclair/commits/${expected}`,
        "--jq",
        "[.sha, .commit.tree.sha] | @tsv",
      ],
      { encoding: "utf8" },
    )
    if (resolved.status !== 0) {
      throw new Error(`Could not verify the private foundation commit: ${resolved.stderr.trim()}`)
    }
    const [reachableCommit, tree] = resolved.stdout.trim().split("\t")
    if (!tree?.match(/^[0-9a-f]{40}$/)) {
      throw new Error("Could not verify the private foundation tree")
    }
    await validateProjectManifest(manifest, { reachableCommit })
    remoteFoundationTree = tree
  }

  if (args.includes("--check-subtree")) {
    const repositoryRoot = flagValue(args, "--repository-root") ?? process.cwd()
    const installed = readSubtreeFoundationCommit(repositoryRoot, manifest.synclair.path, {
      expectedTree: remoteFoundationTree,
    })
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
