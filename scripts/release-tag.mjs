#!/usr/bin/env node

const FOUNDATION_TAG = /^foundation-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function parseFoundationTag(value) {
  const match = FOUNDATION_TAG.exec(value ?? "")
  if (!match) {
    throw new Error("release tag must match foundation-v<semver>")
  }
  return {
    tag: value,
    version: `${match[1]}.${match[2]}.${match[3]}`,
  }
}

export function createReleaseTagRecord(tag, sourceCommit) {
  const parsed = parseFoundationTag(tag)
  if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? "")) {
    throw new Error(
      "release tag record requires a full 40-character source commit"
    )
  }
  return {
    schemaVersion: 1,
    tag: parsed.tag,
    version: parsed.version,
    sourceCommit,
  }
}
