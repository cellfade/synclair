#!/usr/bin/env node

import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { lstat, mkdir, readFile, readlink, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const POLICY_PATH = "config/foundation-payload-policy.json"
const OUTPUT_PATH = "dist/foundation-files.json"

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeRepoPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/").normalize("NFC")
  if (
    normalized.length === 0 ||
    normalized.includes("\\") ||
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.normalize(normalized) !== normalized
  ) {
    throw new Error(`unsafe or non-normalized payload path: ${relativePath}`)
  }
  return normalized
}

function globToRegExp(pattern) {
  let source = "^"
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*"
        index += 1
      } else {
        source += "[^/]*"
      }
    } else if (character === "?") {
      source += "[^/]"
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    }
  }
  return new RegExp(`${source}$`)
}

function compilePolicy(policy) {
  const exclude = policy.exclude.map((pattern) => ({ pattern, regex: globToRegExp(pattern) }))
  const classes = Object.entries(policy.classes).map(([name, patterns]) => ({
    name,
    patterns: patterns.map((pattern) => ({ pattern, regex: globToRegExp(pattern) })),
  }))
  return { exclude, classes }
}

function matchesPath(compiledPattern, repoPath, isDirectory = false) {
  return (
    compiledPattern.regex.test(repoPath) ||
    (isDirectory && compiledPattern.regex.test(`${repoPath}/`))
  )
}

function isExcluded(compiledPolicy, repoPath, isDirectory = false) {
  return compiledPolicy.exclude.some((pattern) => matchesPath(pattern, repoPath, isDirectory))
}

function classifyPath(policy, compiledPolicy, repoPath) {
  const matches = compiledPolicy.classes
    .filter(({ patterns }) => patterns.some((pattern) => matchesPath(pattern, repoPath)))
    .map(({ name }) => name)

  if (matches.length > 1) {
    throw new Error(`payload path matches multiple classes (${matches.join(", ")}): ${repoPath}`)
  }
  return matches[0] ?? policy.defaultClass
}

function fileMode(stats) {
  if (stats.isSymbolicLink()) return "120000"
  return stats.mode & 0o111 ? "100755" : "100644"
}

async function payloadBytes(root, absolutePath, stats) {
  if (stats.isSymbolicLink()) {
    const target = await readlink(absolutePath)
    const resolvedTarget = path.resolve(path.dirname(absolutePath), target)
    const relativeTarget = path.relative(root, resolvedTarget)
    if (
      path.isAbsolute(target) ||
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${path.sep}`)
    ) {
      throw new Error(`payload symlink escapes the repository: ${absolutePath}`)
    }
    return Buffer.from(target.normalize("NFC"), "utf8")
  }
  return readFile(absolutePath)
}

function gitOutput(root, args, options = {}) {
  const encoding = Object.prototype.hasOwnProperty.call(options, "encoding")
    ? options.encoding
    : "utf8"
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || "foundation manifest requires a Git worktree")
  }
  return result.stdout
}

function repositoryTree(root) {
  const untrackedResult = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
  if (untrackedResult.status !== 0) {
    throw new Error(untrackedResult.stderr || "foundation manifest requires a Git worktree")
  }

  const untrackedFiles = untrackedResult.stdout.split("\0").filter(Boolean).sort(compareText)
  if (untrackedFiles.length > 0) {
    throw new Error(
      `untracked files must be committed or removed before building the foundation manifest: ${untrackedFiles.map((file) => JSON.stringify(file)).join(", ")}`,
    )
  }

  const output = gitOutput(root, ["ls-tree", "-r", "-z", "--full-tree", "HEAD"])
  return output.split("\0").filter(Boolean).map((record) => {
    const separator = record.indexOf("\t")
    if (separator < 0) throw new Error(`invalid Git tree record: ${JSON.stringify(record)}`)

    const [mode, type, objectId] = record.slice(0, separator).split(" ")
    if (!mode || !type || !objectId) {
      throw new Error(`invalid Git tree metadata: ${JSON.stringify(record)}`)
    }

    return { mode, type, objectId, path: record.slice(separator + 1) }
  })
}

function repositoryBlob(root, objectId) {
  return gitOutput(root, ["cat-file", "blob", objectId], { encoding: null })
}

function validateRepositorySymlink(repoPath, bytes) {
  const target = bytes.toString("utf8")
  const resolvedTarget = path.posix.normalize(path.posix.join(path.posix.dirname(repoPath), target))
  if (
    target.includes("\0") ||
    path.posix.isAbsolute(target) ||
    resolvedTarget === ".." ||
    resolvedTarget.startsWith("../")
  ) {
    throw new Error(`payload symlink escapes the repository: ${repoPath}`)
  }
}

async function walkPayload(root, policy, compiledPolicy, rawPaths) {
  const entries = []
  const normalizedPaths = new Map()

  for (const rawRelativePath of rawPaths) {
    const repoPath = normalizeRepoPath(rawRelativePath)
    if (isExcluded(compiledPolicy, repoPath)) continue

    const previousPath = normalizedPaths.get(repoPath)
    if (previousPath) {
      throw new Error(`payload paths normalize to the same value: ${previousPath}, ${rawRelativePath}`)
    }
    normalizedPaths.set(repoPath, rawRelativePath)

    const absolutePath = path.join(root, rawRelativePath)
    let stats
    try {
      stats = await lstat(absolutePath)
    } catch (error) {
      if (error?.code === "ENOENT") continue
      throw error
    }
    if (!stats.isFile() && !stats.isSymbolicLink()) {
      throw new Error(`unsupported payload entry type: ${repoPath}`)
    }
    const bytes = await payloadBytes(root, absolutePath, stats)
    entries.push({
      path: repoPath,
      class: classifyPath(policy, compiledPolicy, repoPath),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.byteLength,
      mode: fileMode(stats),
    })
  }

  entries.sort((left, right) => compareText(left.path, right.path))
  return entries
}

function walkRepositoryTree(root, policy, compiledPolicy, treeEntries) {
  const entries = []
  const normalizedPaths = new Map()

  for (const treeEntry of treeEntries) {
    const repoPath = normalizeRepoPath(treeEntry.path)
    if (isExcluded(compiledPolicy, repoPath)) continue

    const previousPath = normalizedPaths.get(repoPath)
    if (previousPath) {
      throw new Error(`payload paths normalize to the same value: ${previousPath}, ${treeEntry.path}`)
    }
    normalizedPaths.set(repoPath, treeEntry.path)

    if (treeEntry.type !== "blob" || !["100644", "100755", "120000"].includes(treeEntry.mode)) {
      throw new Error(`unsupported payload entry type: ${repoPath}`)
    }

    const bytes = repositoryBlob(root, treeEntry.objectId)
    if (treeEntry.mode === "120000") validateRepositorySymlink(repoPath, bytes)
    entries.push({
      path: repoPath,
      class: classifyPath(policy, compiledPolicy, repoPath),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.byteLength,
      mode: treeEntry.mode,
    })
  }

  entries.sort((left, right) => compareText(left.path, right.path))
  return entries
}

export async function buildFoundationManifest({ root = process.cwd(), filePaths } = {}) {
  if (filePaths) {
    const policy = JSON.parse(await readFile(path.join(root, POLICY_PATH), "utf8"))
    const compiledPolicy = compilePolicy(policy)
    const files = await walkPayload(root, policy, compiledPolicy, filePaths)
    return {
      schemaVersion: 1,
      algorithm: "sha256",
      policy: POLICY_PATH,
      files,
    }
  }

  const treeEntries = repositoryTree(root)
  const policyEntry = treeEntries.find((entry) => entry.path === POLICY_PATH)
  if (!policyEntry || policyEntry.type !== "blob") {
    throw new Error(`${POLICY_PATH} is missing from HEAD`)
  }
  const policy = JSON.parse(repositoryBlob(root, policyEntry.objectId).toString("utf8"))
  const compiledPolicy = compilePolicy(policy)
  const files = walkRepositoryTree(root, policy, compiledPolicy, treeEntries)
  return {
    schemaVersion: 1,
    algorithm: "sha256",
    policy: POLICY_PATH,
    files,
  }
}

export function serializeFoundationManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

async function main() {
  const root = process.cwd()
  const outputPath = path.join(root, OUTPUT_PATH)
  const expected = serializeFoundationManifest(await buildFoundationManifest({ root }))

  if (process.argv.includes("--check")) {
    let actual
    try {
      actual = await readFile(outputPath, "utf8")
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`${OUTPUT_PATH} is missing; generate it before checking`)
      }
      throw error
    }
    if (actual !== expected) throw new Error(`${OUTPUT_PATH} is stale; regenerate it`)
    console.log(`Foundation file manifest current: ${JSON.parse(actual).files.length} entries.`)
    return
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, expected, "utf8")
  console.log(`Generated ${OUTPUT_PATH}: ${JSON.parse(expected).files.length} entries.`)
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  await main()
}
