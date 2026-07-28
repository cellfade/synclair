#!/usr/bin/env node

import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

import {
  buildFoundationManifest,
  serializeFoundationManifest,
} from "./build-foundation-manifest.mjs"
import { createReleaseTagRecord, parseFoundationTag } from "./release-tag.mjs"

const OUTPUTS = {
  envelope: "foundation-release.json",
  manifest: "foundation-files.json",
  archive: "synclair-foundation.tar.gz",
  tag: "release-tag.txt",
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function gitOutput(root, args, encoding = null) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer: 512 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      result.error?.message || result.stderr?.toString() || "Git command failed"
    )
  }
  return result.stdout
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function buildReleaseEnvelope({
  template,
  repositoryId,
  sourceCommit,
  releaseTag,
  payloadManifestDigest,
  archiveDigest,
  agentPackDigest,
  fileCount,
}) {
  parseFoundationTag(releaseTag)
  const releaseNeutral = structuredClone(template)
  delete releaseNeutral.$schema
  return {
    ...releaseNeutral,
    repository: {
      ...template.repository,
      id: repositoryId,
    },
    sourceCommit,
    releaseTag,
    payloadManifestDigest,
    archiveDigest,
    agentPackDigest,
    payload: {
      ...template.payload,
      fileCount,
    },
    attestation: {
      issuer: "https://token.actions.githubusercontent.com",
      workflow:
        "cellfade/synclair/.github/workflows/publish-foundation-release.yml",
    },
  }
}

export async function packageFoundationRelease({
  root = process.cwd(),
  tag,
  repositoryId,
  expectedSourceCommit,
  outputDirectory = "dist",
}) {
  const sourceCommit = gitOutput(root, ["rev-parse", "HEAD"], "utf8").trim()
  if (
    expectedSourceCommit !== undefined &&
    sourceCommit !== expectedSourceCommit
  ) {
    throw new Error("HEAD does not match approved source commit")
  }
  const tagRecord = createReleaseTagRecord(tag, sourceCommit)
  const manifest = await buildFoundationManifest({ root })
  const manifestBytes = Buffer.from(
    serializeFoundationManifest(manifest),
    "utf8"
  )
  const templateBytes = gitOutput(root, [
    "show",
    "HEAD:data/foundation-release.template.json",
  ])
  const template = JSON.parse(templateBytes.toString("utf8"))
  const archiveTar = gitOutput(root, [
    "archive",
    "--format=tar",
    "HEAD",
    "--",
    ...manifest.files.map((entry) => entry.path),
  ])
  const archiveBytes = gzipSync(archiveTar, { level: 9, mtime: 0 })
  const agentPackBytes = Buffer.from(
    serializeJson(
      manifest.files.filter((entry) => entry.class === "agent-pack")
    ),
    "utf8"
  )
  const envelope = buildReleaseEnvelope({
    template,
    repositoryId,
    sourceCommit,
    releaseTag: tagRecord.tag,
    payloadManifestDigest: sha256(manifestBytes),
    archiveDigest: sha256(archiveBytes),
    agentPackDigest: sha256(agentPackBytes),
    fileCount: manifest.files.length,
  })
  const outputRoot = path.resolve(root, outputDirectory)
  await mkdir(outputRoot, { recursive: true })
  await Promise.all([
    writeFile(
      path.join(outputRoot, OUTPUTS.envelope),
      serializeJson(envelope),
      "utf8"
    ),
    writeFile(path.join(outputRoot, OUTPUTS.manifest), manifestBytes),
    writeFile(path.join(outputRoot, OUTPUTS.archive), archiveBytes),
    writeFile(
      path.join(outputRoot, OUTPUTS.tag),
      serializeJson(tagRecord),
      "utf8"
    ),
  ])
  return {
    sourceCommit,
    releaseTag: tagRecord.tag,
    payloadManifestDigest: envelope.payloadManifestDigest,
    archiveDigest: envelope.archiveDigest,
    agentPackDigest: envelope.agentPackDigest,
    fileCount: manifest.files.length,
  }
}

function valueFor(args, flag) {
  const index = args.indexOf(flag)
  const value = index >= 0 ? args[index + 1] : undefined
  if (!value || value.startsWith("--"))
    throw new Error(`${flag} requires a value`)
  return value
}

function validateArguments(args, allowed) {
  const seen = new Set()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    if (!allowed.has(flag) || args[index + 1] === undefined) {
      throw new Error(`unexpected release packaging argument: ${flag ?? ""}`)
    }
    if (seen.has(flag)) {
      throw new Error(`duplicate release packaging argument: ${flag}`)
    }
    seen.add(flag)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const allowed = new Set([
    "--tag",
    "--repository-id",
    "--source-commit",
    "--output-directory",
  ])
  validateArguments(args, allowed)
  const tag = valueFor(args, "--tag")
  const repositoryId = Number(valueFor(args, "--repository-id"))
  const expectedSourceCommit = valueFor(args, "--source-commit")
  if (!/^[0-9a-f]{40}$/.test(expectedSourceCommit)) {
    throw new Error("--source-commit must be a full 40-character commit SHA")
  }
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    throw new Error(
      "--repository-id must be a positive numeric GitHub repository ID"
    )
  }
  const outputDirectory = args.includes("--output-directory")
    ? valueFor(args, "--output-directory")
    : "dist"
  const result = await packageFoundationRelease({
    tag,
    repositoryId,
    expectedSourceCommit,
    outputDirectory,
  })
  console.log(
    `Packaged ${result.releaseTag} from ${result.sourceCommit} with ${result.fileCount} files.`
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null
if (invokedPath === import.meta.url) await main()
