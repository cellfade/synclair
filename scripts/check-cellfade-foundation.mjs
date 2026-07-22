import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const failures = []

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8")
}

async function json(relativePath) {
  return JSON.parse(await text(relativePath))
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function sourceFiles(relativePath) {
  const absolutePath = path.join(root, relativePath)

  let entries
  try {
    entries = await readdir(absolutePath, { withFileTypes: true })
  } catch (error) {
    if (error?.code === "ENOENT") return []
    throw error
  }

  const files = []
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(child)))
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
      files.push(child)
    }
  }
  return files
}

const project = await text("lib/system/seed/project.ts")
const brand = await text("lib/system/seed/brand-ramps.ts")
const knowledge = await text("lib/system/knowledge/sources.ts")
const setup = await json("data/setup.json")
const catalog = await json("data/external-catalog.json")
const systemMap = await json("data/system-map.json")
const pages = await json("data/pages-map.json")
const summaries = await json("data/knowledge/summaries/index.json")
const devServers = await json("data/dev-servers.json")

expect(project.includes('name: "Your Product"'), "project identity must remain neutral")
expect(brand.includes("BRAND_RAMPS: ColorGroup[] = []"), "brand ramp seed must remain empty")
expect(
  knowledge.includes("KNOWLEDGE_SOURCES: KnowledgeSource[] = []"),
  "knowledge seed must remain empty"
)
expect(setup.mode === null, "foundation setup mode must remain unresolved")
expect(catalog.hosts?.length === 0 && catalog.items?.length === 0, "host catalog must remain empty")
expect(
  systemMap.repo === null &&
    ["areas", "api", "data", "jobs", "integrations"].every(
      (key) => Array.isArray(systemMap[key]) && systemMap[key].length === 0
    ),
  "system map must remain empty"
)
expect(pages.repo === null && pages.pages?.length === 0, "pages map must remain empty")
expect(summaries.summaries?.length === 0, "project summaries must remain empty")
expect(devServers.servers?.length === 0, "dev-server seed must remain empty")

const previewAdapterTypes = await text("lib/system/adapters/types.ts")
const previewAdapterIndex = await text("lib/system/adapters/index.ts")
expect(
  previewAdapterTypes.includes("export interface PreviewAdapter") &&
    previewAdapterIndex.includes('export type { PreviewAdapter } from "./types"'),
  "gallery preview seam must export PreviewAdapter"
)
expect(
  !previewAdapterTypes.includes("PlatformAdapter") &&
    !previewAdapterIndex.includes("PlatformAdapter") &&
    !previewAdapterTypes.includes("exportToken") &&
    !previewAdapterTypes.includes("distribution"),
  "gallery preview seam must not restore the ambiguous adapter or absorb export/distribution"
)

const generatorSourceFiles = (
  await Promise.all(
    ["packages", "lib/generator", "lib/generators"].map((directory) =>
      sourceFiles(directory)
    )
  )
).flat()
for (const relativePath of generatorSourceFiles) {
  const source = await text(relativePath)
  expect(
    !source.includes("PreviewAdapter"),
    `generator source must not reuse the gallery PreviewAdapter type: ${relativePath}`
  )
}

const mother = await text("lib/system/mother.ts")
const lineage = await text("lib/system/lineage.ts")
const callHome = await text("scripts/call-home.mjs")
const sync = await text("scripts/synclair-sync.sh")
const synclairSkill = await text(".claude/skills/synclair/SKILL.md")
const synclairSyncSkill = await text(".claude/skills/synclair-sync/SKILL.md")
const registry = await json("registry.json")
const publicRegistry = await json("public/r/registry.json")

expect(
  lineage.includes('repository: "cellfade/synclair"') &&
    lineage.includes('repositoryUrl: "https://github.com/cellfade/synclair"') &&
    lineage.includes('gitUrl: "https://github.com/cellfade/synclair.git"') &&
    lineage.includes('publicLineageRepository: "joshuaiwata/synclair"'),
  "canonical lineage must separate the private Cellfade foundation from public lineage"
)
expect(
  mother.includes("FOUNDATION_LINEAGE.repository") &&
    mother.includes("FOUNDATION_LINEAGE.repositoryUrl"),
  "runtime mother must derive from the canonical lineage module"
)
expect(callHome.includes('MOTHER_REPO = "cellfade/synclair"'), "call-home mother must be cellfade/synclair")
expect(
  sync.includes('UPSTREAM_URL="https://github.com/cellfade/synclair.git"'),
  "sync fallback must use the Cellfade foundation"
)
expect(
  sync.includes('git remote get-url --all upstream') &&
    sync.includes('"$upstream_urls" != "$UPSTREAM_URL"'),
  "sync must reject a pre-existing upstream that is not the canonical Cellfade foundation",
)
expect(
  synclairSkill.includes("https://github.com/cellfade/synclair"),
  "Synclair skill must identify the Cellfade mother"
)
expect(
  synclairSyncSkill.includes("https://github.com/cellfade/synclair") &&
    synclairSyncSkill.includes("lineage only"),
  "Synclair sync skill must use Cellfade and describe public upstream as lineage only"
)
expect(
  registry.homepage === "https://github.com/cellfade/synclair" &&
    publicRegistry.homepage === "https://github.com/cellfade/synclair",
  "registry metadata must point to the Cellfade foundation"
)

const adoption = await text("docs/cellfade-adoption.md")
const newProjectGuide = await text("docs/new-project.md")
const existingProjectGuide = await text("docs/existing-project.md")
const rootReadme = await text("README.md")
const handbookInstallation = await text("handbook/installation.mdx")
const handbookReadme = await text("handbook/README.md")
const handbookConfig = await text("handbook/docs.json")
for (const heading of [
  "Route A — create a new project from the foundation",
  "Route B — attach beside an existing project",
  "Route C — attach inside an existing repository",
]) {
  expect(adoption.includes(heading), `adoption guide missing: ${heading}`)
}

for (const [name, guide] of [
  ["root README", rootReadme],
  ["handbook installation", handbookInstallation],
]) {
  expect(
    guide.includes("npx synclair new --cellfade-foundation"),
    `${name} must present the explicit private Cellfade command`,
  )
}
expect(
  handbookReadme.includes("cellfade/synclair") &&
    !handbookReadme.includes("joshuaiwata/synclair"),
  "handbook hosting instructions must connect the private Cellfade repository",
)
expect(
  handbookConfig.includes("https://github.com/cellfade/synclair") &&
    !handbookConfig.includes("https://github.com/joshuaiwata/synclair"),
  "handbook links must point to the private Cellfade repository",
)
expect(
  !synclairSkill.includes("activeAdapter") &&
    synclairSkill.includes("adapterFor(item.surface)"),
  "Synclair skill must describe per-surface preview adapter selection",
)
expect(
  (adoption.match(/gh repo create/g) ?? []).length ===
    (adoption.match(/--private/g) ?? []).length,
  "every documented gh repo create command must specify --private"
)
for (const [name, guide] of [
  ["new-project", newProjectGuide],
  ["existing-project", existingProjectGuide],
]) {
  expect(
    guide.includes("npx synclair new --cellfade-foundation"),
    `${name} guide must use the explicit private Cellfade migration path`,
  )
  expect(
    !guide.includes("https://github.com/joshuaiwata/synclair.git"),
    `${name} guide must not present public lineage as an executable clone source`,
  )
}

const conflictStop = sync.indexOf("STOPPED: merge conflicts remain")
const baselineStamp = sync.indexOf("# Stamp the call-home baseline")
expect(
  conflictStop >= 0 && baselineStamp >= 0 && conflictStop < baselineStamp,
  "sync conflict stop must occur before baseline stamping"
)

const preview = await text("scripts/preview-server.sh")
expect(
  !preview.includes("{ synclair_dev_pids; pids_on_port; }"),
  "preview cleanup must not merge arbitrary port listeners into the kill list"
)
expect(
  preview.includes("which is not a Next process from"),
  "preview cleanup must refuse an unrelated listener"
)

if (failures.length > 0) {
  console.error("Cellfade foundation gate failed:")
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log("Cellfade foundation clean: neutral seed, private lineage, adoption paths, and safety guards verified.")
