import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("Vercel capability policy names every required capability and fallback", async () => {
  const policy = JSON.parse(await readFile("config/vercel-capability-policy.json", "utf8"))

  assert.equal(policy.schemaVersion, 1)
  assert.deepEqual(Object.keys(policy.capabilities).sort(), [
    "database",
    "durableTransport",
    "previewProtection",
    "sandbox",
    "stagedProduction",
  ])

  for (const capability of Object.values(policy.capabilities)) {
    assert.equal(typeof capability.required, "boolean")
    assert.match(capability.fallback, /^[a-z][a-z0-9-]+$/)
  }
})

test("Vercel probe rejects an installed CLI version that differs from the pin", async () => {
  const { assertPinnedCliVersion } = await import("../scripts/probe-vercel-capabilities.mjs")

  assert.doesNotThrow(() => assertPinnedCliVersion("Vercel CLI 54.14.2", "54.14.2"))
  assert.throws(
    () => assertPinnedCliVersion("Vercel CLI 54.15.0", "54.14.2"),
    /does not match pinned version/
  )
})

test("Vercel offline contract check never executes the configured CLI", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/probe-vercel-capabilities.mjs", "--check-only"],
    {
      encoding: "utf8",
      env: { ...process.env, VERCEL_BIN: "/definitely/not/a/vercel-binary" },
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /CLI not executed/)
  assert.match(result.stdout, /No CLI or provider call was made/)
})

test("Vercel report validation rejects placeholder provider identifiers", async () => {
  const { validateCapabilityReport } = await import("../scripts/probe-vercel-capabilities.mjs")
  const policy = JSON.parse(await readFile("config/vercel-capability-policy.json", "utf8"))
  const capabilities = Object.fromEntries(
    Object.keys(policy.capabilities).map((name) => [name, { status: "not-checked" }])
  )

  assert.throws(
    () =>
      validateCapabilityReport(
        {
          schemaVersion: 1,
          cliVersion: "54.14.2",
          scope: { userId: "not-recorded", teamId: "not-recorded" },
          capabilities,
        },
        policy,
        "54.14.2"
      ),
    /immutable Vercel userId and teamId/
  )
})

test("Vercel provider preflight rejects unresolved required capabilities", async () => {
  const { validateCapabilityReport } = await import("../scripts/probe-vercel-capabilities.mjs")
  const policy = JSON.parse(await readFile("config/vercel-capability-policy.json", "utf8"))
  const capabilities = Object.fromEntries(
    Object.keys(policy.capabilities).map((name) => [name, { status: "not-checked" }])
  )

  assert.throws(
    () =>
      validateCapabilityReport(
        {
          schemaVersion: 1,
          cliVersion: "54.14.2",
          scope: { userId: "user_123456", teamId: "team_123456" },
          capabilities,
        },
        policy,
        "54.14.2",
        { requireResolved: true },
      ),
    /must be resolved/,
  )
})

test("Vercel provider preflight blocks an unavailable required capability", async () => {
  const { validateCapabilityReport } = await import("../scripts/probe-vercel-capabilities.mjs")
  const policy = JSON.parse(await readFile("config/vercel-capability-policy.json", "utf8"))
  const capabilities = Object.fromEntries(
    Object.entries(policy.capabilities).map(([name, capability]) => [
      name,
      {
        status: name === "previewProtection" ? "unavailable" : "available",
        evidence: "approved-read-only-check",
        ...(name === "previewProtection" ? { fallback: capability.fallback } : {}),
      },
    ]),
  )

  assert.throws(
    () =>
      validateCapabilityReport(
        {
          schemaVersion: 1,
          cliVersion: "54.14.2",
          scope: { userId: "user_123456", teamId: "team_123456" },
          capabilities,
        },
        policy,
        "54.14.2",
        { requireResolved: true },
      ),
    /previewProtection is required and must be available.*blocks dependent provider writes/,
  )
})

test("Gitleaks release pin includes checksums for supported macOS and Linux targets", async () => {
  const version = (await readFile("tools/gitleaks.version", "utf8")).trim()
  const checksumText = await readFile("tools/gitleaks.sha256", "utf8")

  assert.match(version, /^\d+\.\d+\.\d+$/)
  for (const target of ["darwin_arm64", "darwin_x64", "linux_arm64", "linux_x64"]) {
    assert.match(
      checksumText,
      new RegExp(`^[a-f0-9]{64}  gitleaks_${version}_${target}\\.tar\\.gz$`, "m")
    )
  }
})

test("Gitleaks installer rejects an archive whose digest differs from the release pin", async () => {
  const { assertArchiveChecksum } = await import("../tools/install-gitleaks.mjs")

  assert.throws(
    () => assertArchiveChecksum(Buffer.from("not a release archive"), "0".repeat(64)),
    /checksum mismatch/
  )
})

test("secret-scan policy excludes only the inert negative fixture from clean-tree scans", async () => {
  const config = await readFile(".gitleaks.toml", "utf8")
  const fixture = await readFile("test/fixtures/secrets/fake-github-token.txt", "utf8")

  assert.match(config, /useDefault = true/)
  assert.match(config, /\^test\/fixtures\/secrets\/fake-github-token\\\.txt\$/)
  assert.equal((config.match(/paths\s*=/g) ?? []).length, 1)
  assert.match(fixture, /SYNCLAIR_TEST_SECRET=[A-Za-z0-9-]{20,}/)
})

test("offline secret scanner detects the negative fixture without echoing its value", async () => {
  const { scanTextForCredentialShapes } = await import("../scripts/check-secrets.mjs")
  const fixture = await readFile("test/fixtures/secrets/fake-github-token.txt", "utf8")

  assert.deepEqual(scanTextForCredentialShapes("ordinary source text"), [])
  assert.deepEqual(scanTextForCredentialShapes(fixture), ["synthetic-test-secret"])
})
