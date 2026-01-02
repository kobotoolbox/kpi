/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd() // /srv/src/kpi
const MODELS_DIR = path.join(ROOT, 'jsapp/js/api/models')

const TARGETS = [
  {
    file: 'dataSupplementResponse.ts',
    type: 'DataSupplementResponseOneOf',
    importPath: './dataSupplementResponseOneOf',
  },
  {
    file: 'patchedDataSupplementPayload.ts',
    type: 'PatchedDataSupplementPayloadOneOf',
    importPath: './patchedDataSupplementPayloadOneOf',
  },
]

function insertImportAfterHeader(source, importLine) {
  // Match first /** ... */ block
  const headerMatch = source.match(/^\/\*\*[\s\S]*?\*\/\s*/)

  if (!headerMatch) {
    // Fallback: prepend if header not found
    return `${importLine}\n${source}`
  }

  const header = headerMatch[0]
  const rest = source.slice(header.length)

  return `${header}\n${importLine}\n${rest}`
}

/**
 * Orval has a bug that fails to generate imports for $ref in additionalProperties.
 * See https://github.com/orval-labs/orval/issues/1077.
 * This is a workaround. Remove it once the underlying bug is fixed.
 */
for (const { file, type, importPath } of TARGETS) {
  const filePath = path.join(MODELS_DIR, file)

  if (!fs.existsSync(filePath)) {
    continue
  }

  const source = fs.readFileSync(filePath, 'utf8')

  const usesType = source.includes(type)
  const hasImport = new RegExp(`import\\s+type\\s*\\{\\s*${type}\\s*\\}`).test(source)
  const hasLocalDecl = new RegExp(`\\b(type|interface)\\s+${type}\\b`).test(source)

  if (!usesType || hasImport || hasLocalDecl) {
    continue
  }

  const importLine = `import type { ${type} } from '${importPath}'`

  const patched = insertImportAfterHeader(source, importLine)

  fs.writeFileSync(filePath, patched, 'utf8')
  console.log(`✔ Added missing import for ${type} in ${file}`)
}
