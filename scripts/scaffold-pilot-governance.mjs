#!/usr/bin/env node
import { access, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { validateProjectManifest } from "./validate-project-manifest.mjs"

function valueFor(args, flag) {
  const index = args.indexOf(flag)
  const value = index >= 0 ? args[index + 1] : null
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
  return value
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function refuseSymlinkedPath(target, relative) {
  const parts = relative.split("/")
  const candidates = [
    target,
    ...parts.map((_, index) => path.join(target, ...parts.slice(0, index + 1))),
  ]
  for (const candidate of candidates) {
    try {
      if ((await lstat(candidate)).isSymbolicLink()) {
        throw new Error(`Refusing symbolic link in governance destination: ${candidate}`)
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
  }
}

async function listWorkspaceEntries(target, relative = "") {
  const directory = path.join(target, relative)
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (child === ".git") continue
    found.push(child)
    if (entry.isDirectory()) found.push(...(await listWorkspaceEntries(target, child)))
  }
  return found
}

async function main() {
  const args = process.argv.slice(2)
  const target = path.resolve(valueFor(args, "--target"))
  const manifestPath = path.resolve(valueFor(args, "--manifest"))
  const expectedManifestPath = path.join(target, "synclair.project.json")
  if (manifestPath !== expectedManifestPath) {
    throw new Error("--manifest must be the target workspace synclair.project.json")
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  await validateProjectManifest(manifest)

  const mainRuleset = {
    name: "main-governance",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 1,
          required_review_thread_resolution: true,
        },
      },
    ],
  }

  const files = {
    "README.md": `# ${manifest.project.name}\n\n${manifest.project.summary}\n\nPrivate Cellfade project. Setup decisions are recorded in \`synclair.project.json\`.\n`,
    ".gitignore": "node_modules/\n.next/\ndist/\n.vercel/\n.env\n.env.*\n!.env.example\n.DS_Store\n",
    ".editorconfig": "root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\ninsert_final_newline = true\nindent_style = space\nindent_size = 2\n",
    ".github/CODEOWNERS": "* @cellfade\n",
    ".github/ruleset-main.json": `${JSON.stringify(mainRuleset, null, 2)}\n`,
    ".github/workflows/ci.yml": `name: project-verification\n\non:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0\n        with:\n          node-version: 22\n      - name: Verify declared roots\n        shell: bash\n        run: |\n          if [[ -f apps/web/package-lock.json ]]; then\n            npm --prefix apps/web ci\n            npm --prefix apps/web run build\n          fi\n          if [[ -f synclair/package-lock.json ]]; then\n            npm --prefix synclair ci\n            npm --prefix synclair run bootstrap:foundation\n            npm --prefix synclair run verify:foundation\n          fi\n`,
    "docs/repository-rules.md": `# Repository rules\n\nExpected state for \`${manifest.repository.owner}/${manifest.repository.name}\`:\n\n- visibility: private\n- default branch: \`${manifest.repository.defaultBranch}\`\n- application changes arrive through pull requests\n- at least one eligible human approval before merge\n- conversations resolved before merge\n- force-push and branch deletion disabled\n- production deployment requires separate explicit approval\n\nProvider configuration must be read back and recorded in the setup PR. If the account plan cannot enforce a rule, stop and report the gap; do not claim it is protected.\n`,
  }

  const allowedEntries = new Set(["synclair.project.json"])
  for (const relative of Object.keys(files)) {
    allowedEntries.add(relative)
    const parts = relative.split("/")
    for (let index = 1; index < parts.length; index += 1) {
      allowedEntries.add(parts.slice(0, index).join("/"))
    }
  }
  const unexpectedEntries = (await listWorkspaceEntries(target)).filter(
    (entry) => !allowedEntries.has(entry),
  )
  if (unexpectedEntries.length > 0) {
    throw new Error(
      `Governance target must otherwise be empty; found: ${unexpectedEntries.sort().join(", ")}`,
    )
  }

  for (const relative of Object.keys(files)) {
    await refuseSymlinkedPath(target, relative)
    if (await exists(path.join(target, relative))) {
      throw new Error(`Refusing to overwrite existing governance file: ${relative}`)
    }
  }

  for (const [relative, contents] of Object.entries(files)) {
    const destination = path.join(target, relative)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, contents, { flag: "wx" })
  }

  console.log(`Governance seed created locally for private ${manifest.repository.owner}/${manifest.repository.name}.`)
  console.log("No GitHub or deployment resources were created.")
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
