#!/usr/bin/env node
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const synclairRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function main() {
  const [mode, ...extra] = process.argv.slice(2)
  if (!['embedded', 'watcher'].includes(mode) || extra.length > 0) {
    throw new Error("Usage: node scripts/record-setup-mode.mjs <embedded|watcher>")
  }

  const setup = {
    mode,
    resolvedAt: new Date().toISOString(),
    resolvedBy: "install",
  }
  const setupPath = path.join(synclairRoot, "data/setup.json")
  await writeFile(setupPath, `${JSON.stringify(setup, null, 2)}\n`, {
    flag: "w",
  })
  console.log(`Recorded Synclair topology: ${mode}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
