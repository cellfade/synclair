import { readFile } from "node:fs/promises"
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

const mother = await text("lib/system/mother.ts")
const callHome = await text("scripts/call-home.mjs")
const sync = await text("scripts/synclair-sync.sh")
const synclairSkill = await text(".claude/skills/synclair/SKILL.md")
const registry = await json("registry.json")
const publicRegistry = await json("public/r/registry.json")

expect(mother.includes('MOTHER_REPO = "cellfade/synclair"'), "runtime mother must be cellfade/synclair")
expect(callHome.includes('MOTHER_REPO = "cellfade/synclair"'), "call-home mother must be cellfade/synclair")
expect(
  sync.includes('UPSTREAM_URL="https://github.com/cellfade/synclair.git"'),
  "sync fallback must use the Cellfade foundation"
)
expect(
  synclairSkill.includes("https://github.com/cellfade/synclair"),
  "Synclair skill must identify the Cellfade mother"
)
expect(
  registry.homepage === "https://github.com/cellfade/synclair" &&
    publicRegistry.homepage === "https://github.com/cellfade/synclair",
  "registry metadata must point to the Cellfade foundation"
)

const adoption = await text("docs/cellfade-adoption.md")
for (const heading of [
  "Route A — create a new project from the foundation",
  "Route B — attach beside an existing project",
  "Route C — attach inside an existing repository",
]) {
  expect(adoption.includes(heading), `adoption guide missing: ${heading}`)
}
expect(
  (adoption.match(/gh repo create/g) ?? []).length ===
    (adoption.match(/--private/g) ?? []).length,
  "every documented gh repo create command must specify --private"
)

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
