import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const manifest = {
  schemaVersion: 1,
  project: { name: "Pilot App", slug: "pilot-app", summary: "A real Synclair pilot." },
  repository: {
    owner: "cellfade",
    name: "pilot-app",
    visibility: "private",
    defaultBranch: "main",
    setupBranch: "codex/synclair-setup",
    requirePullRequest: true,
  },
  application: { lifecycle: "new", framework: "vite-react", layout: "apps/web", rootDirectory: "apps/web" },
  synclair: {
    topology: "embedded",
    path: "synclair",
    delivery: { strategy: "mainline", overlayBranch: null, overlayPolicy: null },
    foundation: { repository: "cellfade/synclair", commit: "a".repeat(40), updateMode: "recommended" },
  },
  deployment: {
    provider: "vercel",
    previewRequired: true,
    productionAutoDeploy: false,
    productionRequiresExplicitApproval: true,
  },
}

test("governance scaffold creates a deterministic local-only seed and refuses overwrite", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "synclair-governance-"))
  const manifestPath = path.join(target, "synclair.project.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const first = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.equal(first.status, 0, first.stderr)

  for (const file of [
    "README.md",
    ".gitignore",
    ".editorconfig",
    ".github/CODEOWNERS",
    ".github/workflows/ci.yml",
    ".github/ruleset-main.json",
    "docs/repository-rules.md",
  ]) {
    assert.ok((await readFile(path.join(target, file), "utf8")).length > 0, `${file} must exist`)
  }

  const workflow = await readFile(path.join(target, ".github/workflows/ci.yml"), "utf8")
  assert.match(workflow, /^  workflow_dispatch:/m)
  assert.doesNotMatch(workflow, /^  pull_request:/m)
  assert.match(await readFile(path.join(target, "README.md"), "utf8"), /Pilot App/)
  const ruleset = JSON.parse(await readFile(path.join(target, ".github/ruleset-main.json"), "utf8"))
  assert.equal(ruleset.enforcement, "active")
  assert.ok(ruleset.rules.some((rule) => rule.type === "deletion"))
  assert.ok(ruleset.rules.some((rule) => rule.type === "non_fast_forward"))
  const pullRequest = ruleset.rules.find((rule) => rule.type === "pull_request")
  assert.equal(pullRequest.parameters.required_approving_review_count, 1)
  assert.equal(pullRequest.parameters.required_review_thread_resolution, true)

  const second = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.notEqual(second.status, 0)
  assert.match(second.stderr, /refusing to overwrite/i)
})

test("governance scaffold refuses a symlinked destination directory", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "synclair-governance-link-"))
  const outside = await mkdtemp(path.join(tmpdir(), "synclair-governance-outside-"))
  const manifestPath = path.join(target, "synclair.project.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await mkdir(path.join(target, ".github"))
  await symlink(outside, path.join(target, ".github", "workflows"))

  const result = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /symbolic link/i)
  await assert.rejects(access(path.join(outside, "ci.yml")))
})

test("governance scaffold refuses a dangling destination symlink", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "synclair-governance-dangling-"))
  const outside = await mkdtemp(path.join(tmpdir(), "synclair-governance-dangling-outside-"))
  const manifestPath = path.join(target, "synclair.project.json")
  const outsideReadme = path.join(outside, "README.md")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await symlink(outsideReadme, path.join(target, "README.md"))

  const result = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /symbolic link/i)
  await assert.rejects(access(outsideReadme))
})

test("governance scaffold refuses a nonempty target outside its manifest and git metadata", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "synclair-governance-nonempty-"))
  const manifestPath = path.join(target, "synclair.project.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(target, "unexpected.txt"), "do not mix workspaces\n")

  const result = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /must otherwise be empty/i)
})

test("governance scaffold refuses an unexpected nested workflow", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "synclair-governance-nested-"))
  const manifestPath = path.join(target, "synclair.project.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await mkdir(path.join(target, ".github", "workflows"), { recursive: true })
  await writeFile(path.join(target, ".github", "workflows", "unexpected.yml"), "on: push\n")

  const result = spawnSync(
    "node",
    ["scripts/scaffold-pilot-governance.mjs", "--target", target, "--manifest", manifestPath],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /must otherwise be empty/i)
})
