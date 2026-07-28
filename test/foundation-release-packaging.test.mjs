import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { gunzipSync, gzipSync } from "node:zlib"

import {
  buildReleaseEnvelope,
  packageFoundationRelease,
} from "../scripts/package-foundation-release.mjs"
import {
  createReleaseTagRecord,
  parseFoundationTag,
} from "../scripts/release-tag.mjs"
import { buildAttestationVerificationArgs } from "../scripts/verify-foundation-attestation.mjs"
import { verifyFoundationRelease } from "../scripts/verify-foundation-release.mjs"

test("foundation release tags use the immutable foundation-v<semver> contract", () => {
  assert.deepEqual(parseFoundationTag("foundation-v0.1.0"), {
    tag: "foundation-v0.1.0",
    version: "0.1.0",
  })
  assert.throws(() => parseFoundationTag("v0.1.0"), /foundation-v<semver>/)
  assert.throws(
    () => parseFoundationTag("foundation-v0.1"),
    /foundation-v<semver>/
  )
  assert.throws(
    () => parseFoundationTag("foundation-v0.1.0-rc.1"),
    /foundation-v<semver>/
  )
})

test("release tag records bind the immutable tag to one exact source commit", () => {
  const sourceCommit = "a".repeat(40)
  assert.deepEqual(createReleaseTagRecord("foundation-v0.1.0", sourceCommit), {
    schemaVersion: 1,
    tag: "foundation-v0.1.0",
    version: "0.1.0",
    sourceCommit,
  })
  assert.throws(
    () => createReleaseTagRecord("foundation-v0.1.0", "main"),
    /full 40-character source commit/
  )
})

test("release envelopes bind repository identity, source, assets, and attestation workflow", () => {
  const digest = "b".repeat(64)
  const envelope = buildReleaseEnvelope({
    template: {
      schemaVersion: 1,
      repository: { owner: "cellfade", name: "synclair" },
      compatibility: {
        projectSchemaVersions: [1],
        generatorRange: ">=0.1.0 <2.0.0",
      },
      license: { spdx: "GPL-3.0-or-later", noticeFiles: ["LICENSE"] },
      payload: {
        manifestAsset: "foundation-files.json",
        archiveAsset: "synclair-foundation.tar.gz",
        classes: [
          "foundation",
          "agent-pack",
          "project-seed-template",
          "runtime-template",
        ],
      },
    },
    repositoryId: 1308412422,
    sourceCommit: "a".repeat(40),
    releaseTag: "foundation-v0.1.0",
    payloadManifestDigest: digest,
    archiveDigest: "c".repeat(64),
    agentPackDigest: "d".repeat(64),
    fileCount: 385,
  })

  assert.equal(envelope.repository.id, 1308412422)
  assert.equal(envelope.sourceCommit, "a".repeat(40))
  assert.equal(envelope.releaseTag, "foundation-v0.1.0")
  assert.equal(envelope.payloadManifestDigest, digest)
  assert.equal(envelope.archiveDigest, "c".repeat(64))
  assert.equal(envelope.agentPackDigest, "d".repeat(64))
  assert.equal(envelope.payload.fileCount, 385)
  assert.equal(Object.hasOwn(envelope, "$schema"), false)
  assert.deepEqual(envelope.attestation, {
    issuer: "https://token.actions.githubusercontent.com",
    workflow:
      "cellfade/synclair/.github/workflows/publish-foundation-release.yml",
  })
})

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

async function releaseFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "synclair-release-package-"))
  await mkdir(path.join(root, "config"), { recursive: true })
  await mkdir(path.join(root, "data"), { recursive: true })
  await mkdir(path.join(root, ".claude/skills/example"), { recursive: true })
  await writeFile(path.join(root, ".gitignore"), "dist/\n")
  await writeFile(path.join(root, "LICENSE"), "test license\n")
  await writeFile(
    path.join(root, ".claude/skills/example/SKILL.md"),
    "example agent pack\n"
  )
  await writeFile(
    path.join(root, "config/foundation-payload-policy.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      defaultClass: "foundation",
      classes: {
        foundation: [],
        "agent-pack": [".claude/skills/**"],
        "project-seed-template": [],
        "runtime-template": [],
      },
      exclude: ["dist/**"],
    })}\n`
  )
  await writeFile(
    path.join(root, "data/foundation-release.template.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      repository: { owner: "cellfade", name: "synclair" },
      compatibility: {
        projectSchemaVersions: [1],
        generatorRange: ">=0.1.0 <2.0.0",
      },
      license: { spdx: "GPL-3.0-or-later", noticeFiles: ["LICENSE"] },
      payload: {
        manifestAsset: "foundation-files.json",
        archiveAsset: "synclair-foundation.tar.gz",
        classes: [
          "foundation",
          "agent-pack",
          "project-seed-template",
          "runtime-template",
        ],
      },
    })}\n`
  )
  git(root, ["init", "--quiet"])
  git(root, ["config", "user.name", "Synclair Test"])
  git(root, ["config", "user.email", "synclair-test@example.invalid"])
  git(root, ["add", "."])
  git(root, ["commit", "--quiet", "-m", "release fixture"])
  return root
}

test("foundation packaging emits deterministic artifacts bound to exact HEAD", async () => {
  const root = await releaseFixture()
  try {
    const first = await packageFoundationRelease({
      root,
      tag: "foundation-v0.1.0",
      repositoryId: 1308412422,
    })
    const firstArchive = await readFile(
      path.join(root, "dist/synclair-foundation.tar.gz")
    )
    const second = await packageFoundationRelease({
      root,
      tag: "foundation-v0.1.0",
      repositoryId: 1308412422,
    })
    const secondArchive = await readFile(
      path.join(root, "dist/synclair-foundation.tar.gz")
    )
    const envelope = JSON.parse(
      await readFile(path.join(root, "dist/foundation-release.json"))
    )
    const manifest = JSON.parse(
      await readFile(path.join(root, "dist/foundation-files.json"))
    )

    assert.deepEqual(second, first)
    assert.deepEqual(secondArchive, firstArchive)
    assert.equal(envelope.sourceCommit, git(root, ["rev-parse", "HEAD"]))
    assert.equal(envelope.repository.id, 1308412422)
    assert.equal(envelope.payload.fileCount, manifest.files.length)
    assert.equal(
      envelope.archiveDigest,
      createHash("sha256").update(firstArchive).digest("hex")
    )
    assert.equal(
      manifest.files.some((entry) => entry.path.startsWith("dist/")),
      false
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("offline verification accepts an intact package and rejects a tampered archive", async () => {
  const root = await releaseFixture()
  try {
    await packageFoundationRelease({
      root,
      tag: "foundation-v0.1.0",
      repositoryId: 1308412422,
    })
    const verified = await verifyFoundationRelease({
      directory: path.join(root, "dist"),
      expectedRepositoryId: 1308412422,
      expectedSourceCommit: git(root, ["rev-parse", "HEAD"]),
      expectedReleaseTag: "foundation-v0.1.0",
    })
    assert.equal(verified.releaseTag, "foundation-v0.1.0")
    assert.equal(verified.fileCount > 0, true)

    await assert.rejects(
      verifyFoundationRelease({
        directory: path.join(root, "dist"),
        expectedRepositoryId: 1308412422,
        expectedSourceCommit: "f".repeat(40),
        expectedReleaseTag: "foundation-v0.1.0",
      }),
      /source commit does not match approved source/
    )

    await writeFile(
      path.join(root, "dist/synclair-foundation.tar.gz"),
      "tampered"
    )
    await assert.rejects(
      verifyFoundationRelease({
        directory: path.join(root, "dist"),
        expectedRepositoryId: 1308412422,
        expectedSourceCommit: git(root, ["rev-parse", "HEAD"]),
        expectedReleaseTag: "foundation-v0.1.0",
      }),
      /archive digest does not match release envelope/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("offline verification rejects altered trusted identity and hidden tar content", async () => {
  const root = await releaseFixture()
  const sourceCommit = git(root, ["rev-parse", "HEAD"])
  const verification = {
    directory: path.join(root, "dist"),
    expectedRepositoryId: 1308412422,
    expectedSourceCommit: sourceCommit,
    expectedReleaseTag: "foundation-v0.1.0",
  }
  try {
    await packageFoundationRelease({
      root,
      tag: verification.expectedReleaseTag,
      repositoryId: verification.expectedRepositoryId,
    })
    const envelopePath = path.join(root, "dist/foundation-release.json")
    const envelope = JSON.parse(await readFile(envelopePath, "utf8"))
    envelope.repository.name = "lookalike"
    await writeFile(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`)
    await assert.rejects(
      verifyFoundationRelease(verification),
      /trusted repository owner and name do not match/
    )

    envelope.repository.name = "synclair"
    envelope.compatibility.generatorRange = "*"
    await writeFile(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`)
    await assert.rejects(
      verifyFoundationRelease(verification),
      /release compatibility metadata does not match/
    )

    envelope.compatibility.generatorRange = ">=0.1.0 <2.0.0"
    const archivePath = path.join(root, "dist/synclair-foundation.tar.gz")
    const archive = await readFile(archivePath)
    const withHiddenTail = gzipSync(
      Buffer.concat([gunzipSync(archive), Buffer.alloc(512, 1)]),
      { level: 9, mtime: 0 }
    )
    envelope.archiveDigest = createHash("sha256")
      .update(withHiddenTail)
      .digest("hex")
    await writeFile(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`)
    await writeFile(archivePath, withHiddenTail)
    await assert.rejects(
      verifyFoundationRelease(verification),
      /nonzero data after tar end marker/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("release packaging and offline verification are exposed as strict CLIs", async () => {
  const root = await releaseFixture()
  try {
    const packageResult = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/package-foundation-release.mjs"),
        "--tag",
        "foundation-v0.1.0",
        "--repository-id",
        "1308412422",
        "--source-commit",
        git(root, ["rev-parse", "HEAD"]),
      ],
      { cwd: root, encoding: "utf8" }
    )
    assert.equal(packageResult.status, 0, packageResult.stderr)
    assert.match(packageResult.stdout, /Packaged foundation-v0\.1\.0/)

    const verifyResult = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/verify-foundation-release.mjs"),
        "--directory",
        "dist",
        "--repository-id",
        "1308412422",
        "--source-commit",
        git(root, ["rev-parse", "HEAD"]),
        "--release-tag",
        "foundation-v0.1.0",
      ],
      { cwd: root, encoding: "utf8" }
    )
    assert.equal(verifyResult.status, 0, verifyResult.stderr)
    assert.match(verifyResult.stdout, /Verified foundation-v0\.1\.0/)

    const duplicateResult = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/package-foundation-release.mjs"),
        "--tag",
        "foundation-v0.1.0",
        "--tag",
        "foundation-v0.2.0",
        "--repository-id",
        "1308412422",
        "--source-commit",
        git(root, ["rev-parse", "HEAD"]),
      ],
      { cwd: root, encoding: "utf8" }
    )
    assert.notEqual(duplicateResult.status, 0)
    assert.match(duplicateResult.stderr, /duplicate release packaging argument/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("attestation verification pins repository, workflow identity, issuer, and source commit", () => {
  const args = buildAttestationVerificationArgs({
    artifact: "dist/synclair-foundation.tar.gz",
    repository: "cellfade/synclair",
    sourceCommit: "a".repeat(40),
  })
  assert.deepEqual(args, [
    "attestation",
    "verify",
    "dist/synclair-foundation.tar.gz",
    "--repo",
    "cellfade/synclair",
    "--signer-workflow",
    "cellfade/synclair/.github/workflows/publish-foundation-release.yml",
    "--cert-oidc-issuer",
    "https://token.actions.githubusercontent.com",
    "--source-digest",
    "a".repeat(40),
    "--deny-self-hosted-runners",
    "--format",
    "json",
  ])
})

test("manual publisher is pinned, attests both assets, and creates no deployment", async () => {
  const workflow = await readFile(
    ".github/workflows/publish-foundation-release.yml",
    "utf8"
  )
  const packageJson = JSON.parse(await readFile("package.json", "utf8"))

  assert.match(workflow, /^  workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^  (?:push|pull_request):/m)
  assert.match(workflow, /^  contents: write/m)
  assert.match(workflow, /^  attestations: write/m)
  assert.match(workflow, /^  id-token: write/m)
  assert.match(workflow, /source_commit:/)
  assert.match(workflow, /enterprise_attestations:/)
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$APPROVED_SOURCE_COMMIT"/)
  assert.match(workflow, /enterprise-private-attestations-enabled/)
  assert.doesNotMatch(workflow, /npm ci/)
  assert.doesNotMatch(workflow, /^      GH_TOKEN:/m)
  assert.match(workflow, /TAG_ALREADY_EXISTS/)
  assert.match(workflow, /--include/)
  assert.match(workflow, /404/)
  assert.match(workflow, /--draft/)
  assert.match(workflow, /gh release upload/)
  assert.match(workflow, /remote_digest/)
  assert.match(workflow, /-F draft=false/)
  assert.match(
    workflow,
    /actions\/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373/
  )
  assert.match(workflow, /dist\/foundation-release\.json/)
  assert.match(workflow, /dist\/synclair-foundation\.tar\.gz/)
  assert.match(workflow, /gh release create/)
  assert.match(workflow, /--verify-tag/)
  assert.doesNotMatch(workflow, /vercel|deploy|npm publish/i)
  assert.equal(
    packageJson.scripts["package:foundation-release"],
    "node scripts/package-foundation-release.mjs"
  )
  assert.equal(
    packageJson.scripts["verify:foundation-release"],
    "node scripts/verify-foundation-release.mjs"
  )
  assert.equal(
    packageJson.scripts["verify:foundation-attestation"],
    "node scripts/verify-foundation-attestation.mjs"
  )
})

test("foundation release runbook separates source review, release approval, and clean verification", async () => {
  const runbook = await readFile(
    "docs/control-plane/foundation-release.md",
    "utf8"
  )

  assert.match(runbook, /human-reviewed PR/i)
  assert.match(runbook, /foundation-v0\.1\.0/)
  assert.match(runbook, /publish-foundation-release/)
  assert.match(runbook, /explicit release approval/i)
  assert.match(runbook, /clean directory/i)
  assert.match(runbook, /gh release download/)
  assert.match(runbook, /verify-foundation-release\.mjs/)
  assert.match(runbook, /verify-foundation-attestation\.mjs/)
  assert.match(runbook, /1308412422/)
  assert.match(runbook, /does not authorize production/i)
  assert.match(runbook, /GitHub Enterprise Cloud/)
  assert.match(runbook, /tag ruleset/i)
  assert.match(runbook, /immutable releases/i)
  assert.match(runbook, /--ref main/)
  assert.match(runbook, /-f source_commit=<40-character-reviewed-merge-sha>/)
  assert.match(runbook, /node \/absolute\/path\/to\/reviewed-synclair/)
  assert.doesNotMatch(runbook, /cd synclair-foundation[\s\S]+npm run/)
})
