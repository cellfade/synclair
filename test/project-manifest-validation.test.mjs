import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  parseSubtreeFoundationCommit,
  readSubtreeFoundationCommit,
  validateProjectManifest,
} from "../scripts/validate-project-manifest.mjs"

const validManifest = {
  schemaVersion: 1,
  project: { name: "Pilot Product", slug: "pilot-product", summary: "A pilot product." },
  repository: {
    owner: "cellfade",
    name: "pilot-product",
    visibility: "private",
    defaultBranch: "main",
    setupBranch: "codex/synclair-setup",
    requirePullRequest: true,
  },
  application: {
    lifecycle: "new",
    framework: "vite-react",
    layout: "apps/web",
    rootDirectory: "apps/web",
  },
  synclair: {
    topology: "embedded",
    path: "synclair",
    delivery: { strategy: "mainline", overlayBranch: null, overlayPolicy: null },
    foundation: {
      repository: "cellfade/synclair",
      commit: "a".repeat(40),
      updateMode: "recommended",
    },
  },
  deployment: {
    provider: "vercel",
    previewRequired: true,
    productionAutoDeploy: false,
    productionRequiresExplicitApproval: true,
  },
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`)
  return result.stdout.trim()
}

test("project manifest validator accepts the canonical private Option A contract", async () => {
  await assert.doesNotReject(() => validateProjectManifest(validManifest))
})

test("project manifest validator rejects unsafe identity, paths, refs, and production policy", async () => {
  const mutations = [
    (value) => { value.repository.visibility = "public" },
    (value) => { value.repository.owner = "unknown-owner" },
    (value) => { value.application.rootDirectory = "../outside" },
    (value) => { value.synclair.path = "/absolute/synclair" },
    (value) => { value.synclair.path = "." },
    (value) => { value.synclair.path = ".." },
    (value) => { value.synclair.path = "../outside" },
    (value) => { value.synclair.path = "a/../b" },
    (value) => { value.repository.name = "." },
    (value) => { value.repository.name = ".." },
    (value) => { value.repository.setupBranch = "codex/../main" },
    (value) => { value.synclair.foundation.repository = "other/synclair" },
    (value) => { value.synclair.foundation.commit = "0".repeat(40) },
    (value) => { value.synclair.foundation.commit = "main" },
    (value) => { value.deployment.previewRequired = false },
    (value) => { value.deployment.productionAutoDeploy = true },
    (value) => { value.deployment.productionRequiresExplicitApproval = false },
    (value) => { value.synclair.delivery.overlayBranch = "synclair/overlay" },
  ]

  for (const mutate of mutations) {
    const candidate = structuredClone(validManifest)
    mutate(candidate)
    await assert.rejects(() => validateProjectManifest(candidate))
  }
})

test("subtree provenance parser binds the installed foundation to the manifest commit", () => {
  const message = `Squashed 'synclair/' content from commit ${"b".repeat(40)}\n\n` +
    "git-subtree-dir: synclair\n" +
    `git-subtree-split: ${"a".repeat(40)}\n`

  assert.equal(parseSubtreeFoundationCommit(message, "synclair"), "a".repeat(40))
  assert.throws(() => parseSubtreeFoundationCommit(message, "other"), /subtree provenance/i)
})

test("subtree validation rejects forged trailers on an ordinary reachable commit", async () => {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), "synclair-subtree-spoof-"))
  git(repositoryRoot, ["init"])
  git(repositoryRoot, ["config", "user.name", "Synclair Test"])
  git(repositoryRoot, ["config", "user.email", "synclair-test@example.invalid"])
  await writeFile(path.join(repositoryRoot, "README.md"), "# Host\n")
  git(repositoryRoot, ["add", "README.md"])
  git(repositoryRoot, [
    "commit",
    "-m",
    `fake provenance\n\ngit-subtree-dir: synclair\ngit-subtree-split: ${"a".repeat(40)}`,
  ])

  assert.throws(
    () => readSubtreeFoundationCommit(repositoryRoot, "synclair"),
    /subtree provenance/i,
  )
})

test("subtree validation accepts a standard squash merge whose prefix tree matches", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "synclair-subtree-real-"))
  const upstreamRoot = path.join(fixtureRoot, "upstream")
  const repositoryRoot = path.join(fixtureRoot, "host")
  await mkdir(upstreamRoot)
  await mkdir(repositoryRoot)

  for (const root of [upstreamRoot, repositoryRoot]) {
    git(root, ["init"])
    git(root, ["config", "user.name", "Synclair Test"])
    git(root, ["config", "user.email", "synclair-test@example.invalid"])
  }
  await writeFile(path.join(upstreamRoot, "foundation.txt"), "pinned foundation\n")
  git(upstreamRoot, ["add", "foundation.txt"])
  git(upstreamRoot, ["commit", "-m", "foundation"])
  const foundationCommit = git(upstreamRoot, ["rev-parse", "HEAD"])

  await writeFile(path.join(repositoryRoot, "README.md"), "# Host\n")
  git(repositoryRoot, ["add", "README.md"])
  git(repositoryRoot, ["commit", "-m", "governance seed"])
  git(repositoryRoot, [
    "subtree",
    "add",
    "--prefix",
    "synclair",
    upstreamRoot,
    foundationCommit,
    "--squash",
  ])

  assert.equal(readSubtreeFoundationCommit(repositoryRoot, "synclair"), foundationCommit)
  assert.throws(
    () =>
      readSubtreeFoundationCommit(repositoryRoot, "synclair", {
        expectedTree: "0".repeat(40),
      }),
    /subtree provenance/i,
  )

  await writeFile(path.join(upstreamRoot, "foundation.txt"), "updated foundation\n")
  git(upstreamRoot, ["add", "foundation.txt"])
  git(upstreamRoot, ["commit", "-m", "foundation update"])
  const updatedCommit = git(upstreamRoot, ["rev-parse", "HEAD"])
  git(repositoryRoot, [
    "subtree",
    "pull",
    "--prefix",
    "synclair",
    upstreamRoot,
    updatedCommit,
    "--squash",
  ])

  assert.equal(readSubtreeFoundationCommit(repositoryRoot, "synclair"), updatedCommit)
  const originalTree = git(upstreamRoot, ["rev-parse", `${foundationCommit}^{tree}`])
  assert.throws(
    () => readSubtreeFoundationCommit(repositoryRoot, "synclair", { expectedTree: originalTree }),
    /subtree provenance/i,
  )
})
