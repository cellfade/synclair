#!/usr/bin/env node
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const root = process.cwd()
const version = (await readFile(path.join(root, "tools/actionlint.version"), "utf8")).trim()
const checksumLines = (await readFile(path.join(root, "tools/actionlint.sha256"), "utf8"))
  .trim()
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
const checksums = new Map(checksumLines)
const platform = process.platform
const arch = process.arch === "x64" ? "amd64" : process.arch
const key = `${platform}-${arch}`
const expected = checksums.get(key)

if (!/^\d+\.\d+\.\d+$/.test(version) || !expected || !/^[a-f0-9]{64}$/.test(expected)) {
  throw new Error(`unsupported or invalid actionlint pin for ${key}`)
}

if (process.argv.includes("--check")) {
  console.log(`actionlint pin valid: v${version} ${key}`)
  process.exit(0)
}

const destinationDir = path.join(root, "tools/bin")
const destination = path.join(destinationDir, "actionlint")
const existing = spawnSync(destination, ["-version"], { encoding: "utf8" })
if (existing.status === 0 && `${existing.stdout}${existing.stderr}`.includes(version)) {
  console.log(`actionlint v${version} already installed`)
  process.exit(0)
}

const filename = `actionlint_${version}_${platform}_${arch}.tar.gz`
const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${filename}`
const scratch = await mkdtemp(path.join(tmpdir(), "synclair-actionlint-"))

try {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`download failed: ${response.status} ${response.statusText}`)
  const finalHost = new URL(response.url).hostname
  if (finalHost !== "github.com" && !finalHost.endsWith("githubusercontent.com")) {
    throw new Error(`actionlint download redirected to untrusted host ${finalHost}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== expected) throw new Error(`checksum mismatch for ${filename}`)

  const archive = path.join(scratch, filename)
  await writeFile(archive, bytes)
  const extracted = spawnSync("tar", ["-xzf", archive, "-C", scratch, "actionlint"], {
    encoding: "utf8",
  })
  if (extracted.status !== 0) throw new Error(extracted.stderr || "could not extract actionlint")

  await mkdir(destinationDir, { recursive: true })
  const staged = `${destination}.next`
  await copyFile(path.join(scratch, "actionlint"), staged)
  await chmod(staged, 0o755)
  await rm(destination, { force: true })
  await rename(staged, destination)
  console.log(`installed actionlint v${version} (${key})`)
} finally {
  await rm(scratch, { recursive: true, force: true })
}
