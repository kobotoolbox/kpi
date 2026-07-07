/* eslint-disable no-console */
/**
 * Orval doesn't have a feature yet to support `unevaluatedProperties`.
 * See https://github.com/orval-labs/orval/issues/2156.
 * This is a workaround. Remove it once the underlying bug is fixed.
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd() // /srv/src/kpi
const MODELS_DIR = path.join(ROOT, 'jsapp/js/api/models')

const FILES = ['dataSupplementResponse.ts', 'patchedDataSupplementPayload.ts']

function splitHeader(source) {
  const m = source.match(/^\/\*\*[\s\S]*?\*\/\s*/)
  if (!m) return { header: '', rest: source }
  return { header: m[0], rest: source.slice(m[0].length) }
}

function inferImportPath(typeName) {
  // Orval usually writes file names as lowerCamelCase.
  return `./${typeName[0].toLowerCase()}${typeName.slice(1)}`
}

function detectInterfaceWithIndex(source) {
  const m = source.match(/export\s+interface\s+([A-Za-z0-9_]+)\s*\{\s*([\s\S]*?)\s*\}\s*/m)
  if (!m) return null

  const name = m[1]
  const body = m[2]

  const v = body.match(/^\s*_version\s*:\s*([^;\n]+)\s*;?\s*$/m)
  const k = body.match(/^\s*\[\s*key\s*:\s*string\s*\]\s*:\s*([^;\n]+)\s*;?\s*$/m)

  if (!v || !k) return null

  return {
    name,
    versionType: v[1].trim(),
    valueType: k[1].trim(),
    interfaceBlock: m[0],
  }
}

function ensureTypeImportAfterHeader(source, typeName, importPath) {
  const importLine = `import type { ${typeName} } from '${importPath}'`

  // Check if this type is already imported
  const hasImport = new RegExp(`\\bimport\\s+type\\s*\\{\\s*${typeName}\\s*\\}\\s+from\\s+['"]`).test(source)
  if (hasImport) return source

  // Split the file into Orval's header comment and the rest
  const { header, rest } = splitHeader(source)

  // If no header exists, add import at the top
  if (!header) return `${importLine}\n${source}`

  // Insert import right after the Orval header with one blank line for readability
  return `${header}\n${importLine}\n${rest}`
}

for (const file of FILES) {
  const filePath = path.join(MODELS_DIR, file)
  if (!fs.existsSync(filePath)) continue

  const source = fs.readFileSync(filePath, 'utf8')

  const detected = detectInterfaceWithIndex(source)
  if (!detected) {
    // File already processed (converted from interface to type)
    continue
  }

  const { name, versionType, valueType, interfaceBlock } = detected

  const importPath = inferImportPath(valueType)
  let patched = ensureTypeImportAfterHeader(source, valueType, importPath)

  // TypeScript index signatures behave differently with unions vs intersections:
  // - Use `|` (union) for Payload types: allows assigning objects without all Record keys
  // - Use `&` (intersection) for Response types: allows reading all properties safely
  const operator = file.includes('Payload') ? '|' : '&'

  const replacement =
    `export type ${name} = {\n` + `  _version: ${versionType}\n` + `} ${operator} Record<string, ${valueType}>\n`

  patched = patched.replace(interfaceBlock, replacement)

  fs.writeFileSync(filePath, patched, 'utf8')
  console.log(`✔ Fixed Orval model: ${file}`)
}
