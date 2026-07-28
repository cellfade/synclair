#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"

import { createReleaseTagRecord } from "./release-tag.mjs"

const ASSETS = {
  envelope: "foundation-release.json",
  manifest: "foundation-files.json",
  archive: "synclair-foundation.tar.gz",
  tag: "release-tag.txt",
}
const TRUSTED_REPOSITORY = { owner: "cellfade", name: "synclair" }
const TRUSTED_ATTESTATION = {
  issuer: "https://token.actions.githubusercontent.com",
  workflow:
    "cellfade/synclair/.github/workflows/publish-foundation-release.yml",
}
const DIGEST = /^[0-9a-f]{64}$/

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function parseOctal(bytes) {
  const value = bytes.toString("utf8").replace(/\0.*$/s, "").trim()
  if (value === "") return 0
  if (!/^[0-7]+$/.test(value)) throw new Error("invalid octal archive field")
  return Number.parseInt(value, 8)
}

function parsePax(bytes) {
  const fields = {}
  let offset = 0
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset)
    if (space < 0) throw new Error("invalid PAX archive record")
    const length = Number.parseInt(
      bytes.subarray(offset, space).toString("ascii"),
      10
    )
    if (
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      offset + length > bytes.length
    ) {
      throw new Error("invalid PAX archive record length")
    }
    const record = bytes
      .subarray(space + 1, offset + length - 1)
      .toString("utf8")
    if (bytes[offset + length - 1] !== 0x0a) {
      throw new Error("invalid PAX archive record terminator")
    }
    const equals = record.indexOf("=")
    if (equals > 0) fields[record.slice(0, equals)] = record.slice(equals + 1)
    offset += length
  }
  return fields
}

function parseArchive(archiveBytes) {
  const tar = gunzipSync(archiveBytes)
  if (tar.length % 512 !== 0) {
    throw new Error("archive length is not aligned to tar blocks")
  }
  const files = new Map()
  let offset = 0
  let pax = {}
  let longName
  let foundEndMarker = false

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      const second = tar.subarray(offset + 512, offset + 1024)
      if (second.length !== 512 || !second.every((byte) => byte === 0)) {
        throw new Error("archive is missing the two-block tar end marker")
      }
      if (!tar.subarray(offset + 1024).every((byte) => byte === 0)) {
        throw new Error("archive contains nonzero data after tar end marker")
      }
      foundEndMarker = true
      break
    }
    const storedChecksum = parseOctal(header.subarray(148, 156))
    const checksumHeader = Buffer.from(header)
    checksumHeader.fill(0x20, 148, 156)
    const computedChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0)
    if (storedChecksum !== computedChecksum)
      throw new Error("archive header checksum is invalid")

    const nul = (bytes) => bytes.toString("utf8").replace(/\0.*$/s, "")
    const name = nul(header.subarray(0, 100))
    const prefix = nul(header.subarray(345, 500))
    const headerPath = prefix ? `${prefix}/${name}` : name
    const mode = parseOctal(header.subarray(100, 108))
    const size = parseOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] || 0x30)
    const linkName = nul(header.subarray(157, 257))
    const bodyStart = offset + 512
    const bodyEnd = bodyStart + size
    if (bodyEnd > tar.length)
      throw new Error("archive entry exceeds archive length")
    const body = tar.subarray(bodyStart, bodyEnd)
    offset = bodyStart + Math.ceil(size / 512) * 512

    if (type === "x") {
      pax = parsePax(body)
      continue
    }
    if (type === "g") {
      parsePax(body)
      continue
    }
    if (type === "L") {
      longName = body.toString("utf8").replace(/\0.*$/s, "")
      continue
    }

    const entryPath = pax.path ?? longName ?? headerPath
    pax = {}
    longName = undefined
    if (type === "5") continue
    if (files.has(entryPath))
      throw new Error(`archive contains duplicate path ${entryPath}`)

    if (type === "2") {
      const target = Buffer.from(linkName, "utf8")
      files.set(entryPath, {
        mode: "120000",
        size: target.length,
        bytes: target,
      })
      continue
    }
    if (type !== "0" && type !== "\0") {
      throw new Error(
        `archive contains unsupported entry type ${type} for ${entryPath}`
      )
    }
    files.set(entryPath, {
      mode: mode & 0o111 ? "100755" : "100644",
      size,
      bytes: body,
    })
  }
  if (!foundEndMarker) throw new Error("archive is missing a tar end marker")
  return files
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message)
}

function assertExactKeys(value, expected, message) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify(expected.slice().sort())
  ) {
    throw new Error(message)
  }
}

function validateReleaseStructures({ envelope, manifest, tagRecord }) {
  assertExactKeys(
    envelope,
    [
      "schemaVersion",
      "repository",
      "compatibility",
      "license",
      "payload",
      "sourceCommit",
      "releaseTag",
      "payloadManifestDigest",
      "archiveDigest",
      "agentPackDigest",
      "attestation",
    ],
    "release envelope fields do not match the schema"
  )
  assertEqual(envelope.schemaVersion, 1, "unsupported release envelope schema")
  assertExactKeys(
    envelope.repository,
    ["owner", "name", "id"],
    "release repository fields do not match the schema"
  )
  if (
    envelope.repository?.owner !== TRUSTED_REPOSITORY.owner ||
    envelope.repository?.name !== TRUSTED_REPOSITORY.name
  ) {
    throw new Error("trusted repository owner and name do not match")
  }
  if (
    envelope.attestation?.issuer !== TRUSTED_ATTESTATION.issuer ||
    envelope.attestation?.workflow !== TRUSTED_ATTESTATION.workflow
  ) {
    throw new Error("trusted attestation identity does not match")
  }
  assertExactKeys(
    envelope.attestation,
    ["issuer", "workflow"],
    "release attestation fields do not match the schema"
  )
  if (
    JSON.stringify(envelope.compatibility) !==
    JSON.stringify({
      projectSchemaVersions: [1],
      generatorRange: ">=0.1.0 <2.0.0",
    })
  ) {
    throw new Error("release compatibility metadata does not match")
  }
  if (
    JSON.stringify(envelope.license) !==
    JSON.stringify({
      spdx: "GPL-3.0-or-later",
      noticeFiles: ["LICENSE"],
    })
  ) {
    throw new Error("release license metadata does not match")
  }
  for (const [field, value] of [
    ["payload manifest", envelope.payloadManifestDigest],
    ["archive", envelope.archiveDigest],
    ["agent pack", envelope.agentPackDigest],
  ]) {
    if (!DIGEST.test(value ?? "")) throw new Error(`${field} digest is invalid`)
  }
  assertEqual(
    envelope.payload?.manifestAsset,
    ASSETS.manifest,
    "manifest asset name does not match"
  )
  assertEqual(
    envelope.payload?.archiveAsset,
    ASSETS.archive,
    "archive asset name does not match"
  )
  assertExactKeys(
    envelope.payload,
    ["manifestAsset", "archiveAsset", "classes", "fileCount"],
    "release payload fields do not match the schema"
  )
  if (
    JSON.stringify(envelope.payload.classes) !==
    JSON.stringify([
      "foundation",
      "agent-pack",
      "project-seed-template",
      "runtime-template",
    ])
  ) {
    throw new Error("release payload classes are invalid")
  }
  if (
    !Number.isSafeInteger(envelope.payload?.fileCount) ||
    envelope.payload.fileCount < 1
  ) {
    throw new Error("release payload file count is invalid")
  }
  assertEqual(manifest.schemaVersion, 1, "unsupported manifest schema")
  assertExactKeys(
    manifest,
    ["schemaVersion", "algorithm", "policy", "files"],
    "manifest fields do not match the schema"
  )
  assertEqual(manifest.algorithm, "sha256", "unsupported manifest algorithm")
  assertEqual(
    manifest.policy,
    "config/foundation-payload-policy.json",
    "unexpected manifest policy"
  )
  if (!Array.isArray(manifest.files))
    throw new Error("manifest files are invalid")
  const seen = new Set()
  for (const entry of manifest.files) {
    assertExactKeys(
      entry,
      ["path", "class", "sha256", "size", "mode"],
      "manifest entry fields do not match the schema"
    )
    if (
      typeof entry.path !== "string" ||
      path.posix.isAbsolute(entry.path) ||
      path.posix.normalize(entry.path) !== entry.path ||
      entry.path === ".." ||
      entry.path.startsWith("../") ||
      entry.path.includes("\\")
    ) {
      throw new Error("manifest contains an unsafe path")
    }
    if (seen.has(entry.path))
      throw new Error("manifest contains a duplicate path")
    seen.add(entry.path)
    if (!envelope.payload.classes.includes(entry.class)) {
      throw new Error("manifest contains an undeclared payload class")
    }
    if (!DIGEST.test(entry.sha256 ?? "")) {
      throw new Error("manifest contains an invalid digest")
    }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new Error("manifest contains an invalid size")
    }
    if (!["100644", "100755", "120000"].includes(entry.mode)) {
      throw new Error("manifest contains an invalid mode")
    }
  }
  assertEqual(tagRecord.schemaVersion, 1, "unsupported tag record schema")
  assertExactKeys(
    tagRecord,
    ["schemaVersion", "tag", "version", "sourceCommit"],
    "tag record fields do not match the schema"
  )
}

export async function verifyFoundationRelease({
  directory = process.cwd(),
  expectedRepositoryId,
  expectedSourceCommit,
  expectedReleaseTag,
}) {
  if (
    !Number.isSafeInteger(expectedRepositoryId) ||
    expectedRepositoryId <= 0
  ) {
    throw new Error(
      "expectedRepositoryId must be a positive numeric GitHub repository ID"
    )
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSourceCommit ?? "")) {
    throw new Error(
      "expectedSourceCommit must be an independently approved 40-character commit SHA"
    )
  }
  createReleaseTagRecord(expectedReleaseTag, expectedSourceCommit)
  const root = path.resolve(directory)
  const [envelopeBytes, manifestBytes, archiveBytes, tagBytes] =
    await Promise.all(
      Object.values(ASSETS).map((asset) => readFile(path.join(root, asset)))
    )
  const envelope = JSON.parse(envelopeBytes.toString("utf8"))
  const manifest = JSON.parse(manifestBytes.toString("utf8"))
  const tagRecord = JSON.parse(tagBytes.toString("utf8"))
  const expectedTag = createReleaseTagRecord(
    envelope.releaseTag,
    envelope.sourceCommit
  )
  validateReleaseStructures({ envelope, manifest, tagRecord })

  assertEqual(
    envelope.repository?.id,
    expectedRepositoryId,
    "repository ID does not match"
  )
  assertEqual(
    envelope.sourceCommit,
    expectedSourceCommit,
    "source commit does not match approved source"
  )
  assertEqual(
    envelope.releaseTag,
    expectedReleaseTag,
    "release tag does not match approved tag"
  )
  assertEqual(
    tagRecord.tag,
    expectedTag.tag,
    "tag record does not match release envelope"
  )
  assertEqual(
    tagRecord.version,
    expectedTag.version,
    "tag version does not match release envelope"
  )
  assertEqual(
    tagRecord.sourceCommit,
    expectedTag.sourceCommit,
    "tag source commit does not match release envelope"
  )
  assertEqual(
    sha256(manifestBytes),
    envelope.payloadManifestDigest,
    "manifest digest does not match release envelope"
  )
  assertEqual(
    sha256(archiveBytes),
    envelope.archiveDigest,
    "archive digest does not match release envelope"
  )
  assertEqual(
    manifest.files?.length,
    envelope.payload?.fileCount,
    "manifest file count does not match release envelope"
  )

  const archive = parseArchive(archiveBytes)
  assertEqual(
    archive.size,
    manifest.files.length,
    "archive membership does not match manifest"
  )
  for (const entry of manifest.files) {
    const archived = archive.get(entry.path)
    if (!archived)
      throw new Error(`archive is missing manifest path ${entry.path}`)
    assertEqual(
      archived.mode,
      entry.mode,
      `archive mode does not match manifest for ${entry.path}`
    )
    assertEqual(
      archived.size,
      entry.size,
      `archive size does not match manifest for ${entry.path}`
    )
    assertEqual(
      sha256(archived.bytes),
      entry.sha256,
      `archive digest does not match manifest for ${entry.path}`
    )
  }

  const agentPackBytes = Buffer.from(
    `${JSON.stringify(
      manifest.files.filter((entry) => entry.class === "agent-pack"),
      null,
      2
    )}\n`,
    "utf8"
  )
  assertEqual(
    sha256(agentPackBytes),
    envelope.agentPackDigest,
    "agent pack digest does not match release envelope"
  )
  return {
    repositoryId: expectedRepositoryId,
    sourceCommit: envelope.sourceCommit,
    releaseTag: envelope.releaseTag,
    fileCount: manifest.files.length,
    archiveDigest: envelope.archiveDigest,
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
      throw new Error(`unexpected release verification argument: ${flag ?? ""}`)
    }
    if (seen.has(flag)) {
      throw new Error(`duplicate release verification argument: ${flag}`)
    }
    seen.add(flag)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const allowed = new Set([
    "--directory",
    "--repository-id",
    "--source-commit",
    "--release-tag",
    "--tag-file",
  ])
  validateArguments(args, allowed)
  const expectedRepositoryId = Number(valueFor(args, "--repository-id"))
  const expectedSourceCommit = valueFor(args, "--source-commit")
  const expectedReleaseTag = valueFor(args, "--release-tag")
  const tagFile = args.includes("--tag-file")
    ? valueFor(args, "--tag-file")
    : undefined
  const directory = args.includes("--directory")
    ? valueFor(args, "--directory")
    : tagFile
      ? path.dirname(tagFile)
      : process.cwd()
  const result = await verifyFoundationRelease({
    directory,
    expectedRepositoryId,
    expectedSourceCommit,
    expectedReleaseTag,
  })
  if (tagFile) {
    const actualTag = JSON.parse(await readFile(path.resolve(tagFile), "utf8"))
    assertEqual(
      actualTag.tag,
      result.releaseTag,
      "explicit tag file does not match verified release"
    )
  }
  console.log(
    `Verified ${result.releaseTag} from ${result.sourceCommit} with ${result.fileCount} files.`
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null
if (invokedPath === import.meta.url) await main()
