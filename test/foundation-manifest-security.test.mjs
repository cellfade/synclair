import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { buildFoundationManifest } from "../scripts/build-foundation-manifest.mjs"

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "synclair-manifest-security-"))
  await mkdir(path.join(root, "config"), { recursive: true })
  await writeFile(
    path.join(root, "config/foundation-payload-policy.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      defaultClass: "foundation",
      classes: {
        foundation: [],
        "agent-pack": [],
        "project-seed-template": [],
        "runtime-template": [],
      },
      exclude: ["dist/**"],
    })}\n`,
  )
  return root
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function commitFixture(root) {
  git(root, ["init", "--quiet"])
  git(root, ["config", "user.name", "Synclair Test"])
  git(root, ["config", "user.email", "synclair-test@example.invalid"])
  git(root, ["add", "."])
  git(root, ["commit", "--quiet", "-m", "fixture baseline"])
}

test("foundation manifest rejects a symlink that escapes the repository", async () => {
  const root = await fixtureRoot()
  try {
    await symlink("../../outside", path.join(root, "escape-link"))
    await assert.rejects(
      buildFoundationManifest({
        root,
        filePaths: ["config/foundation-payload-policy.json", "escape-link"],
      }),
      /payload symlink escapes the repository/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("foundation manifest excludes generated tool binaries even when presented", async () => {
  const root = await fixtureRoot()
  try {
    await mkdir(path.join(root, "tools/bin"), { recursive: true })
    await writeFile(path.join(root, "tools/bin/actionlint"), "platform-specific-binary")
    const policyPath = path.join(root, "config/foundation-payload-policy.json")
    const policy = JSON.parse(await readFile(policyPath, "utf8"))
    policy.exclude.push("tools/bin/**", "**/tools/bin/**")
    await writeFile(policyPath, `${JSON.stringify(policy)}\n`)

    const manifest = await buildFoundationManifest({
      root,
      filePaths: ["config/foundation-payload-policy.json", "tools/bin/actionlint"],
    })
    assert.equal(manifest.files.some((entry) => entry.path.startsWith("tools/bin/")), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("foundation manifest rejects untracked release files", async () => {
  const root = await fixtureRoot()
  try {
    commitFixture(root)
    await mkdir(path.join(root, "docs"), { recursive: true })
    await writeFile(path.join(root, "docs/reference 2.md"), "iCloud conflict copy")

    await assert.rejects(
      buildFoundationManifest({ root }),
      /untracked files must be committed or removed before building the foundation manifest: "docs\/reference 2\.md"/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("foundation manifest reads one exact HEAD tree despite index and worktree drift", async () => {
  const root = await fixtureRoot()
  try {
    await writeFile(path.join(root, "modified.txt"), "committed bytes")
    await writeFile(path.join(root, "deleted.txt"), "committed and later deleted")
    commitFixture(root)

    const baseline = await buildFoundationManifest({ root })
    assert.equal(
      baseline.files.every((entry) => Number.isSafeInteger(entry.size) && entry.size >= 0),
      true,
    )

    await writeFile(path.join(root, "modified.txt"), "staged bytes")
    git(root, ["add", "modified.txt"])
    await writeFile(path.join(root, "modified.txt"), "unstaged bytes after staging")
    git(root, ["rm", "--quiet", "deleted.txt"])
    await writeFile(path.join(root, "staged-addition.txt"), "not in HEAD")
    git(root, ["add", "staged-addition.txt"])

    assert.deepEqual(await buildFoundationManifest({ root }), baseline)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("foundation manifest allows ignored generated output without changing HEAD", async () => {
  const root = await fixtureRoot()
  try {
    await writeFile(path.join(root, ".gitignore"), "dist/\n")
    commitFixture(root)
    const baseline = await buildFoundationManifest({ root })

    await mkdir(path.join(root, "dist"), { recursive: true })
    await writeFile(path.join(root, "dist/foundation-files.json"), "generated")

    assert.deepEqual(await buildFoundationManifest({ root }), baseline)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
