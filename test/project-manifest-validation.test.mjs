import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  parseSubtreeFoundationCommit,
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

test("subtree validation reads only commits reachable from HEAD", async () => {
  const script = await readFile("scripts/validate-project-manifest.mjs", "utf8")
  assert.match(script, /\["log", "HEAD"/)
  assert.doesNotMatch(script, /\["log", "--all"/)
})
