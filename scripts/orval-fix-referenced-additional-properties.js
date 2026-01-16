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

  // Already imported?
  const hasImport = new RegExp(`\\bimport\\s+type\\s*\\{\\s*${typeName}\\s*\\}\\s+from\\s+['"]`).test(source)
  if (hasImport) return source

  const { header, rest } = splitHeader(source)
  if (!header) return `${importLine}\n${source}`

  // Ensure one blank line after the Orval header for readability
  return `${header}\n${importLine}\n${rest}`
}

for (const file of FILES) {
  const filePath = path.join(MODELS_DIR, file)
  if (!fs.existsSync(filePath)) continue

  const source = fs.readFileSync(filePath, 'utf8')

  const detected = detectInterfaceWithIndex(source)
  if (!fs.existsSync(filePath)) throw new Error(`File ${file} doesn't have an interface within`)

  const { name, versionType, valueType, interfaceBlock } = detected

  const importPath = inferImportPath(valueType)
  let patched = ensureTypeImportAfterHeader(source, valueType, importPath)

  const replacement =
    `export type ${name} = {\n` + `  _version: ${versionType}\n` + `} & Record<string, ${valueType}>\n`

  patched = patched.replace(interfaceBlock, replacement)

  fs.writeFileSync(filePath, patched, 'utf8')
  console.log(`✔ Fixed Orval model: ${file}`)
}
