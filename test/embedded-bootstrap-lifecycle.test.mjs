import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const foundationCommit = "a".repeat(40)

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`)
  return result
}

function runFailure(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  assert.notEqual(result.status, 0, `${command} ${args.join(" ")} unexpectedly succeeded`)
  return result
}

test("embedded reset preserves foundation provenance, then topology enables checked doorways", async () => {
  const hostRoot = await mkdtemp(path.join(tmpdir(), "synclair-embedded-lifecycle-"))
  const synclairRoot = path.join(hostRoot, "synclair")

  for (const directory of [
    "scripts",
    "lib/system/seed",
    "lib/system/knowledge",
    "data/figma-manifest",
    "data/knowledge/summaries",
    "public",
    ".claude/agents",
    ".claude/skills/product-spec/references",
    ".claude/skills/project-identity",
  ]) {
    await mkdir(path.join(synclairRoot, directory), { recursive: true })
  }

  await Promise.all([
    cp("scripts/synclair-reset.sh", path.join(synclairRoot, "scripts/synclair-reset.sh")),
    cp("scripts/bridge-agents.mjs", path.join(synclairRoot, "scripts/bridge-agents.mjs")),
    cp("scripts/record-setup-mode.mjs", path.join(synclairRoot, "scripts/record-setup-mode.mjs")),
    writeFile(path.join(synclairRoot, "lib/system/seed/brand-ramps.ts"), "export const BRAND_RAMPS = []\n"),
    writeFile(path.join(synclairRoot, "lib/system/knowledge/types.ts"), "export {}\n"),
    writeFile(path.join(synclairRoot, "lib/system/references.ts"), "export const REFERENCES: Reference[] = []\n"),
    writeFile(path.join(synclairRoot, "data/setup.json"), '{"mode":null}\n'),
    writeFile(path.join(synclairRoot, ".claude/skills/product-spec/references/_TEMPLATE.md"), "# Template\n"),
    writeFile(
      path.join(synclairRoot, ".claude/skills/product-spec/SKILL.md"),
      "---\nname: product-spec\ndescription: Product requirements.\n---\n",
    ),
    writeFile(
      path.join(synclairRoot, ".claude/skills/project-identity/SKILL.md"),
      "---\nname: project-identity\ndescription: Project identity.\n---\n",
    ),
  ])

  run("git", ["init"], hostRoot)
  run("git", ["config", "user.name", "Synclair Test"], hostRoot)
  run("git", ["config", "user.email", "synclair-test@example.invalid"], hostRoot)
  await writeFile(path.join(hostRoot, "README.md"), "# Host\n")
  run("git", ["add", "README.md"], hostRoot)
  run("git", ["commit", "-m", "governance seed"], hostRoot)

  const missingCommit = runFailure(
    "bash",
    ["scripts/synclair-reset.sh", ".", "--yes", "--foundation-commit"],
    synclairRoot,
  )
  assert.match(missingCommit.stderr, /requires a value/i)

  run(
    "bash",
    ["scripts/synclair-reset.sh", ".", "--yes", "--foundation-commit", foundationCommit],
    synclairRoot,
  )

  const mother = JSON.parse(await readFile(path.join(synclairRoot, "data/mother.json"), "utf8"))
  const unresolved = JSON.parse(await readFile(path.join(synclairRoot, "data/setup.json"), "utf8"))
  assert.equal(mother.commit, foundationCommit)
  assert.equal(unresolved.mode, null)

  run("node", ["synclair/scripts/record-setup-mode.mjs", "embedded"], hostRoot)
  await assert.rejects(readFile(path.join(hostRoot, "data/setup.json"), "utf8"))
  run("node", ["scripts/bridge-agents.mjs"], synclairRoot)
  run("node", ["scripts/bridge-agents.mjs", "--check"], synclairRoot)

  assert.match(await readFile(path.join(hostRoot, "AGENTS.md"), "utf8"), /Product knowledge \(Synclair\)/)
  for (const doorway of [".claude/skills", ".agents/skills", ".cursor/skills"]) {
    assert.match(
      await readFile(path.join(hostRoot, doorway, "project-identity/SKILL.md"), "utf8"),
      /name: project-identity/,
    )
  }
})
