import assert from "node:assert/strict"
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
