import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("pilot documentation uses the authenticated private clone path", async () => {
  const documents = await Promise.all(
    ["README.md", "docs/new-project.md", "docs/existing-project.md", "cli/README.md"].map(
      (path) => readFile(path, "utf8"),
    ),
  )

  for (const document of documents) {
    assert.match(document, /gh repo clone cellfade\/synclair/)
    assert.doesNotMatch(document, /npx synclair new --cellfade-foundation/)
  }
})

test("development and production servers bind to the documented port 4100", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"))

  assert.equal(packageJson.scripts.dev, "next dev -p 4100")
  assert.equal(packageJson.scripts.start, "next start -p 4100")
})

test("port-collision guidance is fixed-port and refuses unrelated listeners", async () => {
  const coLocate = await readFile(".claude/skills/co-locate-synclair/SKILL.md", "utf8")
  const previewServer = await readFile(".claude/skills/preview-server/SKILL.md", "utf8")

  for (const guide of [coLocate, previewServer]) {
    assert.doesNotMatch(guide, /auto-?bump|4101|4102/i)
    assert.match(guide, /refuse|do not kill|must not kill/i)
  }
})

test("one explicit bootstrap command installs pinned tools and builds the manifest", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"))

  assert.equal(
    packageJson.scripts["bootstrap:foundation"],
    "node tools/install-actionlint.mjs && node tools/install-gitleaks.mjs --install && node scripts/build-foundation-manifest.mjs",
  )
  assert.doesNotMatch(packageJson.scripts.postinstall, /install-actionlint|install-gitleaks/)
})

test("installation guides place explicit bootstrap before foundation verification", async () => {
  for (const path of ["README.md", "docs/new-project.md", "docs/existing-project.md", "docs/pilot-option-a.md"]) {
    const guide = await readFile(path, "utf8")
    const bootstrap = guide.indexOf("bootstrap:foundation")
    const verify = guide.indexOf("verify:foundation")

    assert.ok(bootstrap >= 0, `${path} must document bootstrap:foundation`)
    assert.ok(verify > bootstrap, `${path} must run verify:foundation after bootstrap`)
  }
})

test("project-bootstrap skill runs the manual wizard and commits its reproducible manifest", async () => {
  const skill = await readFile(".claude/skills/project-bootstrap/SKILL.md", "utf8")

  assert.match(skill, /^---\nname: project-bootstrap\n/m)
  assert.match(skill, /^category: foundation$/m)
  assert.match(skill, /^layer: foundation$/m)
  assert.match(skill, /^description: .+$/m)
  assert.match(skill, /synclair\.project\.json/)
  assert.match(skill, /Option A/)
  assert.match(skill, /Option B/)
  assert.match(skill, /explicit approval before production/i)
  assert.match(skill, /commit/i)
  assert.match(skill, /validate-project-manifest\.mjs/)
})

test("legacy CLI package cannot publish to the unrelated public namespace", async () => {
  const packageJson = JSON.parse(await readFile("cli/package.json", "utf8"))

  assert.equal(packageJson.private, true)
  assert.equal(packageJson.name, "@cellfade/synclair-legacy")
})

test("Option labels describe delivery while setup paths and topology stay distinct", async () => {
  const setupModes = await readFile("docs/setup-modes.md", "utf8")
  const adoption = await readFile("docs/cellfade-adoption.md", "utf8")

  assert.match(setupModes, /Option A.+mainline/is)
  assert.match(setupModes, /Option B.+overlay/is)
  assert.doesNotMatch(setupModes, /Mode [ABC]/)
  assert.doesNotMatch(adoption, /Route [ABC]/)
})

test("Actions policy distinguishes the PR gate, path-filtered catalog scan, and manual release", async () => {
  const verify = await readFile(".github/workflows/verify.yml", "utf8")
  const release = await readFile(".github/workflows/foundation-release.yml", "utf8")
  const catalog = await readFile(".github/workflows/synclair-catalog.yml", "utf8")
  const runbook = await readFile("docs/pilot-option-a.md", "utf8")

  assert.match(verify, /^  pull_request:/m)
  assert.match(release, /^  workflow_dispatch:/m)
  assert.doesNotMatch(release, /^  pull_request:/m)
  assert.match(catalog, /^  pull_request:/m)
  assert.match(catalog, /paths:/)
  assert.match(runbook, /zero-dollar spending cap/i)
  assert.match(runbook, /included Actions minutes/i)
})

test("Option A pilot runbook reaches a reviewable preview and stops before production", async () => {
  const runbook = await readFile("docs/pilot-option-a.md", "utf8")
  const readme = await readFile("README.md", "utf8")

  assert.match(readme, /docs\/pilot-option-a\.md/)
  assert.match(runbook, /governance seed/i)
  assert.match(runbook, /40-character commit SHA/i)
  assert.match(runbook, /apps\/web/)
  assert.match(runbook, /synclair\//)
  assert.match(runbook, /codex\/synclair-setup/)
  assert.match(runbook, /pull request/i)
  assert.match(runbook, /Vercel preview/i)
  assert.match(runbook, /stop before production/i)
  assert.match(runbook, /scaffold-pilot-governance\.mjs/)
  assert.match(runbook, /npm create vite@9\.1\.1/)
  assert.match(runbook, /gh api "repos\/cellfade\/synclair\/commits\/\$FOUNDATION_SHA"/)
  assert.match(runbook, /gh repo create cellfade\/<product-slug> --private/)
  assert.match(runbook, /gh repo view cellfade\/<product-slug>/)
  assert.match(runbook, /--method POST repos\/cellfade\/<product-slug>\/rulesets/)
  assert.match(runbook, /required_review_thread_resolution/)
  assert.match(runbook, /validate-project-manifest\.mjs[\s\S]+--verify-remote/)
  assert.match(runbook, /--check-subtree/)
  assert.match(runbook, /record-setup-mode\.mjs embedded/)
  assert.doesNotMatch(runbook, /npx synclair/)
})

test("existing-project repository creation has explicit approval and visibility readback", async () => {
  const adoption = await readFile("docs/cellfade-adoption.md", "utf8")

  assert.match(adoption, /After explicit approval/i)
  assert.match(adoption, /gh auth status/)
  assert.match(adoption, /gh repo view cellfade\/<product-name>-synclair/)
  assert.match(adoption, /visibility/i)
})

test("pilot reset runs before topology record and agent bridging", async () => {
  const runbook = await readFile("docs/pilot-option-a.md", "utf8")
  const reset = runbook.indexOf("synclair-reset.sh")
  const record = runbook.indexOf("synclair/data/setup.json")
  const bridge = runbook.indexOf("bridge-agents.mjs")

  assert.ok(reset >= 0, "pilot must reset the embedded seed")
  assert.ok(record > reset, "pilot must record topology after reset")
  assert.ok(bridge > record, "pilot must bridge agents after recording embedded topology")
})

test("pilot creates a pinned preview without connecting the Git production path", async () => {
  const runbook = await readFile("docs/pilot-option-a.md", "utf8")

  assert.match(runbook, /npx vercel@54\.14\.2 deploy/)
  assert.match(runbook, /link --yes --cwd apps\/web/)
  assert.match(runbook, /project add "\$VERCEL_PROJECT"/)
  assert.ok(
    runbook.indexOf('project add "$VERCEL_PROJECT"') < runbook.indexOf("link --yes --cwd apps/web"),
    "the approved Vercel project must be created before it is linked",
  )
  assert.match(runbook, /project inspect "\$VERCEL_PROJECT"/)
  assert.match(runbook, /deploy apps\/web --yes[\s\S]+--project "\$VERCEL_PROJECT"/)
  assert.doesNotMatch(runbook, /link the private GitHub repository to Vercel/i)
  assert.doesNotMatch(runbook, /vercel[^\n]*--prod/)
  assert.match(runbook, /defer Git integration/i)
})

test("new-project guidance matches the apps/web plus synclair Option A layout", async () => {
  const readme = await readFile("README.md", "utf8")
  const guide = await readFile("docs/new-project.md", "utf8")
  const foundationModel = await readFile("docs/foundation-model.md", "utf8")

  assert.match(guide, /apps\/web/)
  assert.match(guide, /--prefix synclair/)
  assert.doesNotMatch(readme, /your product grows at `\/`|your product lives at `\/`/i)
  assert.doesNotMatch(guide, /clone \*\*is\*\* the project|product grows inside the clone/i)
  assert.match(foundationModel, /apps\/web/)
  assert.match(foundationModel, /synclair\.project\.json/)
  assert.match(guide, /defer Git integration/i)
  assert.doesNotMatch(foundationModel, /clones this foundation.+prunes/is)
})
