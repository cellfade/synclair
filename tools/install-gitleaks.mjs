#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
const toolsDir = path.join(root, "tools")
const versionPath = path.join(toolsDir, "gitleaks.version")
const checksumPath = path.join(toolsDir, "gitleaks.sha256")
const destination = path.join(toolsDir, "bin", "gitleaks")

export function assertArchiveChecksum(bytes, expected) {
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== expected) {
    throw new Error(`Gitleaks archive checksum mismatch: expected ${expected}, received ${actual}`)
  }
  return actual
}

export function parseChecksums(text) {
  const entries = new Map()
  for (const line of text.trim().split("\n")) {
    const match = line.match(/^([a-f0-9]{64}) {2}(gitleaks_[0-9.]+_[a-z0-9_]+\.tar\.gz)$/)
    if (!match) throw new Error(`Invalid Gitleaks checksum line: ${line}`)
    entries.set(match[2], match[1])
  }
  return entries
}

export function releaseAssetName(version, platform = process.platform, arch = process.arch) {
  const platformName = { darwin: "darwin", linux: "linux" }[platform]
  const archName = { arm64: "arm64", x64: "x64" }[arch]
  if (!platformName || !archName) {
    throw new Error(`Unsupported Gitleaks installer target: ${platform}-${arch}`)
  }
  return `gitleaks_${version}_${platformName}_${archName}.tar.gz`
}

function assertInstalledVersion(binary, pinnedVersion) {
  const result = spawnSync(binary, ["version"], { encoding: "utf8" })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Gitleaks version check exited ${result.status}`)
  const installedVersion = `${result.stdout}\n${result.stderr}`.match(/\d+\.\d+\.\d+/)?.[0]
  if (installedVersion !== pinnedVersion) {
    throw new Error(
      `Installed Gitleaks ${installedVersion ?? "unknown"} does not match pinned ${pinnedVersion}`
    )
  }
}

async function readReleasePin() {
  const [versionText, checksumText] = await Promise.all([
    readFile(versionPath, "utf8"),
    readFile(checksumPath, "utf8"),
  ])
  const version = versionText.trim()
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("tools/gitleaks.version must contain one exact semantic version")
  }

  const asset = releaseAssetName(version)
  const expectedChecksum = parseChecksums(checksumText).get(asset)
  if (!expectedChecksum) throw new Error(`No checksum is pinned for ${asset}`)
  return { asset, expectedChecksum, version }
}

async function install({ asset, expectedChecksum, version }) {
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${version}/${asset}`
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`Gitleaks download failed with HTTP ${response.status}`)
  const finalHost = new URL(response.url).hostname
  if (finalHost !== "github.com" && !finalHost.endsWith("githubusercontent.com")) {
    throw new Error(`Gitleaks download redirected to untrusted host ${finalHost}`)
  }

  const archiveBytes = Buffer.from(await response.arrayBuffer())
  assertArchiveChecksum(archiveBytes, expectedChecksum)

  await mkdir(toolsDir, { recursive: true })
  const temporaryDirectory = await mkdtemp(path.join(toolsDir, ".gitleaks-install-"))
  try {
    const archivePath = path.join(temporaryDirectory, asset)
    await writeFile(archivePath, archiveBytes, { mode: 0o600 })
    const extract = spawnSync(
      "tar",
      ["-xzf", archivePath, "-C", temporaryDirectory, "gitleaks"],
      { encoding: "utf8" }
    )
    if (extract.error) throw extract.error
    if (extract.status !== 0) throw new Error(`Gitleaks extraction failed: ${extract.stderr.trim()}`)

    const extractedBinary = path.join(temporaryDirectory, "gitleaks")
    await chmod(extractedBinary, 0o755)
    assertInstalledVersion(extractedBinary, version)
    await mkdir(path.dirname(destination), { recursive: true })
    if (existsSync(destination)) await rm(destination)
    await rename(extractedBinary, destination)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !["--check-only", "--install"].includes(args[0])) {
    throw new Error("Usage: node tools/install-gitleaks.mjs --check-only|--install")
  }

  const releasePin = await readReleasePin()
  if (args[0] === "--install") {
    await install(releasePin)
    console.log(`Installed checksum-verified Gitleaks ${releasePin.version} at tools/bin/gitleaks.`)
    return
  }

  if (existsSync(destination)) assertInstalledVersion(destination, releasePin.version)
  const status = existsSync(destination) ? "installed version matches" : "binary not installed"
  console.log(`Gitleaks ${releasePin.version} installer contract valid; ${status}. No download was made.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Gitleaks installer failed: ${error.message}`)
    process.exit(1)
  })
}
