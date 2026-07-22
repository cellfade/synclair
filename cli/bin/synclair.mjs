#!/usr/bin/env node
/**
 * synclair — guarded legacy entrypoint for the Cellfade foundation.
 *
 * Synclair is a foundation you CLONE, not a dependency you install: the source
 * transfers to you, nothing auto-updates. New application creation is moving
 * to the private @cellfade/create-synclair factory. Until that package is
 * released, the explicit --cellfade-foundation escape hatch clones only the
 * private Cellfade mother; bare `new` fails closed.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const CELLFADE_FOUNDATION_URL = "https://github.com/cellfade/synclair.git"

const HELP = `synclair — a project foundation you clone, not a package you install
https://github.com/cellfade/synclair

Usage:
  npx synclair new <dir>
      Disabled: use the private factory when it is released.

  npx synclair new --cellfade-foundation <dir>
      Temporary migration path: clone the private Cellfade foundation only.

What you get: design tokens, a live component library (shadcn-style registry),
UX docs, and an AI knowledge layer — served by an in-repo hub at /synclair,
built for humans browsing and agents building.

After scaffolding:
  cd <dir>
  npm install && npm run dev          # hub at http://localhost:4100/synclair
  docs/new-project.md                 # the clone IS the project
  docs/existing-project.md            # companion beside an existing app

Updates are opt-in (nothing phones home): npm run call-home, synclair-sync skill.
`

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const args = process.argv.slice(2)
const [command] = args

if (command === "new") {
  const privateFoundation = args.includes("--cellfade-foundation")
  const dryRun = args.includes("--dry-run")
  const target = args.slice(1).find((arg) => !arg.startsWith("--"))

  if (!privateFoundation) {
    console.error(
      "Synclair application creation has moved to the private @cellfade/create-synclair factory. " +
        "Until it is released, use `synclair new --cellfade-foundation <dir>` explicitly."
    )
    process.exit(2)
  }
  if (!target) {
    console.error("Usage: npx synclair new --cellfade-foundation <dir>")
    process.exit(1)
  }
  if (existsSync(target)) {
    console.error(`✗ ${target} already exists — pick a fresh directory.`)
    process.exit(1)
  }
  if (!dryRun && spawnSync("git", ["--version"], { stdio: "ignore" }).status !== 0) {
    console.error("✗ git is required — install git and retry.")
    process.exit(1)
  }

  if (dryRun) {
    console.log(`git clone ${CELLFADE_FOUNDATION_URL} ${target}`)
    process.exit(0)
  }

  console.log(`› Cloning the private Cellfade Synclair foundation into ${target}…`)
  run("git", ["clone", CELLFADE_FOUNDATION_URL, target])
  // The clone is YOUR repo: the mother becomes `upstream` (for synclair-sync);
  // `origin` is freed for wherever this project will live.
  run("git", ["-C", target, "remote", "rename", "origin", "upstream"])

  console.log(`
✓ Foundation cloned. The source is yours (GPL-3.0) — next steps:

  cd ${target}
  npm install && npm run dev          # hub at http://localhost:4100/synclair

  New project?      read docs/new-project.md   (reseed brand, identity, knowledge)
  Existing app?     read docs/existing-project.md
  Foundation updates stay opt-in:     npm run call-home

  The mother repo is wired as the 'upstream' remote; add your own 'origin'
  when you create the project's repo.
`)
} else if (!command || command === "help" || command === "--help" || command === "-h") {
  console.log(HELP)
} else if (command === "--version" || command === "-v") {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  console.log(pkg.version)
} else {
  console.error(`Unknown command "${command}".\n`)
  console.log(HELP)
  process.exit(1)
}
