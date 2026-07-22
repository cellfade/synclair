#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const root = process.cwd()
const cli = path.join(root, "cli", "bin", "synclair.mjs")
const scratch = mkdtempSync(path.join(tmpdir(), "synclair-cli-guard-"))

function invoke(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: scratch,
    encoding: "utf8",
  })
}

const blockedTarget = "blocked-project"
const blocked = invoke(["new", blockedTarget])
if (blocked.status === 0 || existsSync(path.join(scratch, blockedTarget))) {
  throw new Error("bare `synclair new` must fail before creating a directory")
}
if (!`${blocked.stdout}${blocked.stderr}`.includes("@cellfade/create-synclair")) {
  throw new Error("bare `synclair new` must explain the private factory migration")
}

const privateTarget = "private-foundation"
const deprecatedEscapeHatch = invoke(["new", "--cellfade-foundation", privateTarget, "--dry-run"])
if (deprecatedEscapeHatch.status === 0 || existsSync(path.join(scratch, privateTarget))) {
  throw new Error("the legacy --cellfade-foundation path must fail before creating a directory")
}
if (!`${deprecatedEscapeHatch.stdout}${deprecatedEscapeHatch.stderr}`.includes("gh repo clone cellfade/synclair")) {
  throw new Error("the legacy CLI must point to the authenticated private clone path")
}

const source = readFileSync(cli, "utf8")
if (source.includes("git clone") || source.includes("CELLFADE_FOUNDATION_URL")) {
  throw new Error("the guarded legacy CLI must not retain a clone execution path")
}

console.log("Legacy CLI guarded: every new command fails closed and points to authenticated GitHub clone guidance.")
