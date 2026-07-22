#!/usr/bin/env node
/**
 * synclair — guarded legacy entrypoint for the Cellfade foundation.
 *
 * Synclair is a foundation you CLONE, not a dependency you install: the source
 * transfers to you, nothing auto-updates. New application creation is moving
 * to the private @cellfade/create-synclair factory. Until that package is
 * released, every `new` invocation fails closed and points to the authenticated
 * GitHub CLI path.
 */
import { readFileSync } from "node:fs"

const HELP = `synclair — a project foundation you clone, not a package you install
https://github.com/cellfade/synclair

Usage:
  node cli/bin/synclair.mjs --help
  node cli/bin/synclair.mjs --version

Application creation is disabled in this legacy source entrypoint. Use:
  gh repo clone cellfade/synclair <dir>

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

const args = process.argv.slice(2)
const [command] = args

if (command === "new") {
  console.error(
    "Synclair application creation has moved to the unreleased private " +
      "@cellfade/create-synclair factory. For the manual pilot, use " +
      "`gh repo clone cellfade/synclair <dir>` and follow docs/pilot-option-a.md."
  )
  process.exit(2)
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
