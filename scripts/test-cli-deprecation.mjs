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
const dryRun = invoke(["new", "--cellfade-foundation", privateTarget, "--dry-run"])
if (dryRun.status !== 0) {
  throw new Error(`private dry-run failed: ${dryRun.stderr}`)
}
if (!dryRun.stdout.includes("https://github.com/cellfade/synclair.git")) {
  throw new Error("private dry-run must resolve the Cellfade foundation")
}
if (existsSync(path.join(scratch, privateTarget))) {
  throw new Error("private dry-run must not create a directory")
}

const source = readFileSync(cli, "utf8")
if (source.includes("joshuaiwata/synclair")) {
  throw new Error("the private CLI execution path must not contain the public lineage clone URL")
}

console.log("Legacy CLI guarded: bare new fails closed; explicit dry-run targets Cellfade only.")
