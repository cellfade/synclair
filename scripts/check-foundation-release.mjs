#!/usr/bin/env node

import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import Ajv2020 from "ajv/dist/2020.js"
import path from "node:path"
import process from "node:process"

const root = process.cwd()

async function readJson(relativePath) {
  const source = await readFile(path.join(root, relativePath), "utf8")
  return JSON.parse(source)
}

const PAYLOAD_CLASSES = [
  "foundation",
  "agent-pack",
  "project-seed-template",
  "runtime-template",
]

const schema = await readJson("schemas/foundation-release.schema.json")
const template = await readJson("data/foundation-release.template.json")
const policy = await readJson("config/foundation-payload-policy.json")

const validateTemplate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
assert.equal(
  validateTemplate(template),
  true,
  `foundation release template does not satisfy its schema: ${JSON.stringify(validateTemplate.errors)}`,
)
assert.equal(
  validateTemplate({ ...template, unexpectedReleaseField: true }),
  false,
  "schema must reject undeclared release template fields",
)

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema")
assert.equal(schema.$id, "https://schemas.cellfade.dev/synclair/foundation-release-v1.json")
assert.deepEqual(schema.required, [
  "schemaVersion",
  "repository",
  "compatibility",
  "license",
  "payload",
])

assert.equal(template.schemaVersion, 1)
assert.deepEqual(template.repository, { owner: "cellfade", name: "synclair" })
assert.deepEqual(template.compatibility.projectSchemaVersions, [1])
assert.match(template.compatibility.generatorRange, /^>=\d+\.\d+\.\d+ <\d+\.\d+\.\d+$/)
assert.equal(template.license.spdx, "GPL-3.0-or-later")
assert.deepEqual(template.license.noticeFiles, ["LICENSE"])
assert.equal(template.payload.manifestAsset, "foundation-files.json")
assert.equal(template.payload.archiveAsset, "synclair-foundation.tar.gz")
assert.deepEqual(template.payload.classes, PAYLOAD_CLASSES)

for (const forbidden of [
  "sourceCommit",
  "releaseTag",
  "payloadManifestDigest",
  "archiveDigest",
  "attestation",
]) {
  assert.equal(
    Object.hasOwn(template, forbidden),
    false,
    `source template must not contain release-bound field ${forbidden}`,
  )
}

assert.equal(policy.schemaVersion, 1)
assert.equal(policy.defaultClass, "foundation")
assert.deepEqual(Object.keys(policy.classes).sort(), PAYLOAD_CLASSES.slice().sort())
assert.deepEqual(policy.classes.foundation, [])
assert.ok(policy.classes["agent-pack"].includes(".claude/agents/**"))
assert.ok(policy.classes["agent-pack"].includes(".claude/skills/**"))
assert.ok(policy.classes["project-seed-template"].includes("lib/system/seed/**"))
assert.ok(policy.classes["runtime-template"].includes("data/reports/**"))
assert.ok(policy.exclude.includes("dist/**"))
assert.ok(policy.exclude.includes("**/dist/**"))
assert.ok(policy.exclude.includes(".git/**"))
assert.ok(policy.exclude.includes("**/.env*"))
assert.ok(policy.exclude.includes("**/node_modules/**"))
assert.ok(policy.exclude.includes("tools/bin/**"))
assert.ok(policy.exclude.includes("**/tools/bin/**"))

const policyText = JSON.stringify(policy)
assert.doesNotMatch(policyText, /\b[a-f0-9]{64}\b/i, "committed policy must be digest-free")
assert.doesNotMatch(policyText, /(?:sha256|digest)/i, "committed policy must not define hashes")

await assert.rejects(
  access(path.join(root, "data/foundation-files.json")),
  /ENOENT/,
  "a hashed manifest must not be committed inside the payload",
)

const { buildFoundationManifest, serializeFoundationManifest } = await import(
  "./build-foundation-manifest.mjs"
)

const firstManifest = await buildFoundationManifest({ root })
const secondManifest = await buildFoundationManifest({ root })
const firstBytes = serializeFoundationManifest(firstManifest)
const secondBytes = serializeFoundationManifest(secondManifest)

assert.equal(firstBytes, secondBytes, "manifest generation must be byte-identical")
assert.equal(firstManifest.schemaVersion, 1)
assert.equal(firstManifest.algorithm, "sha256")
assert.equal(firstManifest.policy, "config/foundation-payload-policy.json")
assert.ok(firstManifest.files.length > 0)
assert.equal(
  firstManifest.files.some((entry) => entry.path.startsWith("tools/bin/")),
  false,
  "generated tool binaries must never enter the release payload",
)

const manifestPaths = firstManifest.files.map((entry) => entry.path)
const sortedPaths = manifestPaths.slice().sort((left, right) =>
  left < right ? -1 : left > right ? 1 : 0,
)
assert.deepEqual(manifestPaths, sortedPaths, "manifest paths must be sorted")
assert.equal(new Set(manifestPaths).size, manifestPaths.length, "manifest paths must be unique")

for (const entry of firstManifest.files) {
  assert.equal(path.posix.normalize(entry.path), entry.path)
  assert.equal(path.posix.isAbsolute(entry.path), false)
  assert.equal(entry.path.includes("\\"), false)
  assert.match(entry.sha256, /^[a-f0-9]{64}$/)
  assert.ok(PAYLOAD_CLASSES.includes(entry.class), `unknown payload class for ${entry.path}`)
  assert.ok(Number.isSafeInteger(entry.size) && entry.size >= 0)
  assert.ok(["100644", "100755", "120000"].includes(entry.mode))
  assert.equal(entry.path === "dist" || entry.path.startsWith("dist/"), false)
}

assert.deepEqual(
  [...new Set(firstManifest.files.map((entry) => entry.class))].sort(),
  PAYLOAD_CLASSES.slice().sort(),
  "the current payload must exercise every declared class",
)
assert.ok(manifestPaths.includes("config/foundation-payload-policy.json"))
assert.ok(manifestPaths.includes("data/foundation-release.template.json"))
assert.ok(manifestPaths.includes("schemas/foundation-release.schema.json"))
assert.ok(manifestPaths.includes("scripts/build-foundation-manifest.mjs"))
assert.ok(manifestPaths.includes("scripts/check-foundation-release.mjs"))

console.log(
  `Foundation release contract valid: schema, template, policy, and ${firstManifest.files.length} deterministic payload entries agree.`,
)
