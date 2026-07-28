#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const REPOSITORY = "cellfade/synclair"
const SIGNER_WORKFLOW =
  "cellfade/synclair/.github/workflows/publish-foundation-release.yml"
const OIDC_ISSUER = "https://token.actions.githubusercontent.com"
const ATTESTED_ASSETS = [
  "foundation-release.json",
  "synclair-foundation.tar.gz",
]

export function buildAttestationVerificationArgs({
  artifact,
  repository = REPOSITORY,
  sourceCommit,
}) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? "")) {
    throw new Error(
      "attestation verification requires a full 40-character source commit"
    )
  }
  return [
    "attestation",
    "verify",
    artifact,
    "--repo",
    repository,
    "--signer-workflow",
    SIGNER_WORKFLOW,
    "--cert-oidc-issuer",
    OIDC_ISSUER,
    "--source-digest",
    sourceCommit,
    "--deny-self-hosted-runners",
    "--format",
    "json",
  ]
}

export function verifyFoundationAttestations({
  directory = process.cwd(),
  repository = REPOSITORY,
  sourceCommit,
  run = spawnSync,
}) {
  const verified = []
  for (const asset of ATTESTED_ASSETS) {
    const artifact = path.join(directory, asset)
    const result = run(
      "gh",
      buildAttestationVerificationArgs({ artifact, repository, sourceCommit }),
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    )
    if (result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr ||
          `attestation failed for ${asset}`
      )
    }
    const records = JSON.parse(result.stdout)
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error(`GitHub returned no verified attestations for ${asset}`)
    }
    verified.push({ asset, attestations: records.length })
  }
  return verified
}

function valueFor(args, flag) {
  const index = args.indexOf(flag)
  const value = index >= 0 ? args[index + 1] : undefined
  if (!value || value.startsWith("--"))
    throw new Error(`${flag} requires a value`)
  return value
}

function validateArguments(args, allowed) {
  const seen = new Set()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    if (!allowed.has(flag) || args[index + 1] === undefined) {
      throw new Error(
        `unexpected attestation verification argument: ${flag ?? ""}`
      )
    }
    if (seen.has(flag)) {
      throw new Error(`duplicate attestation verification argument: ${flag}`)
    }
    seen.add(flag)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const allowed = new Set([
    "--directory",
    "--repo",
    "--source-commit",
    "--release-tag",
  ])
  validateArguments(args, allowed)
  const directory = args.includes("--directory")
    ? valueFor(args, "--directory")
    : "dist"
  const repository = args.includes("--repo")
    ? valueFor(args, "--repo")
    : REPOSITORY
  const expectedSourceCommit = valueFor(args, "--source-commit")
  const expectedReleaseTag = valueFor(args, "--release-tag")
  if (repository !== REPOSITORY)
    throw new Error(`trusted repository must be ${REPOSITORY}`)
  const envelope = JSON.parse(
    await readFile(
      path.join(path.resolve(directory), "foundation-release.json"),
      "utf8"
    )
  )
  if (envelope.sourceCommit !== expectedSourceCommit) {
    throw new Error("attested source commit does not match approved source")
  }
  if (envelope.releaseTag !== expectedReleaseTag) {
    throw new Error("attested release tag does not match approved tag")
  }
  const verified = verifyFoundationAttestations({
    directory: path.resolve(directory),
    repository,
    sourceCommit: expectedSourceCommit,
  })
  console.log(
    `Verified GitHub workflow attestations for ${verified.map(({ asset }) => asset).join(" and ")}.`
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null
if (invokedPath === import.meta.url) await main()
