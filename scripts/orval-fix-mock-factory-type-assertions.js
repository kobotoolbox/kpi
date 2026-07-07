/* eslint-disable no-console */
/**
 * Fixes TypeScript errors in MSW mock factories.
 *
 * Why this is needed: When Orval generates types like
 * `{ _version: string } & Record<string, SomeOtherType>`, TypeScript's type system
 * sees a conflict - _version must be both a `string` AND a `SomeOtherType`, which
 * is impossible. This causes the mock factory return values to fail type checking
 * even though they're structurally correct at runtime.
 *
 * What this does: Adds explicit type assertions (`as TypeName`) to mock factory
 * return statements. This tells TypeScript "trust me, this object matches the type"
 * without changing runtime behavior. Safe for test mocks where we control the data.
 *
 * Types currently affected:
 * - DataSupplementResponse (intersection with Record)
 * - PatchedDataSupplementPayload (union with Record)
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const MODELS_DIR = path.join(ROOT, 'jsapp/js/api/models')
const REACT_QUERY_DIR = path.join(ROOT, 'jsapp/js/api/react-query')

// Types that need fixing
const TYPE_FILES = {
  'dataSupplementResponse.ts': {
    typeName: 'DataSupplementResponse',
    factoryFile: 'survey-data.ts',
  },
  'patchedDataSupplementPayload.ts': {
    typeName: 'PatchedDataSupplementPayload',
    factoryFile: 'survey-data.ts',
  },
}

function detectTypeWithVersionAndRecord(source) {
  // Look for patterns like:
  // export type SomeName = { _version: ... } & Record<...>
  // These might span multiple lines

  if (!source.includes('export type')) return null
  if (!source.includes('_version')) return null
  if (!source.includes('Record<')) return null

  // Find the line with "export type"
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('export type')) continue

    // Extract type name: "export type DataSupplementResponse = {"
    const afterExport = line.split('export type')[1]
    if (!afterExport) continue

    const typeName = afterExport.split('=')[0].trim()
    if (typeName) return typeName
  }

  return null
}

let totalFixed = 0

for (const [modelFile, config] of Object.entries(TYPE_FILES)) {
  const modelPath = path.join(MODELS_DIR, modelFile)
  if (!fs.existsSync(modelPath)) {
    console.log(`⊘ Skipped ${modelFile} (file not found)`)
    continue
  }

  const modelSource = fs.readFileSync(modelPath, 'utf8')
  const detectedType = detectTypeWithVersionAndRecord(modelSource)

  if (!detectedType) {
    console.log(`⊘ Skipped ${modelFile} (no problematic type pattern found)`)
    continue
  }

  if (detectedType !== config.typeName) {
    console.log(`⚠ Warning: Expected type ${config.typeName} but found ${detectedType} in ${modelFile}`)
  }

  // Now fix the mock factories
  const factoryPath = path.join(REACT_QUERY_DIR, config.factoryFile)
  if (!fs.existsSync(factoryPath)) {
    console.log(`⊘ Skipped ${config.factoryFile} (file not found)`)
    continue
  }

  let factorySource = fs.readFileSync(factoryPath, 'utf8')

  // Find factories that return this type and add `as TypeName` if missing
  // Turns: ): TypeName => ({ _version: ..., ...overrideResponse })
  // Into:  ): TypeName => ({ _version: ..., ...overrideResponse }) as TypeName
  const lines = factorySource.split('\n')
  let fixCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip lines that don't look like factory returns
    if (!line.includes(`): ${config.typeName} =>`)) continue
    if (!line.includes('_version:')) continue
    if (!line.includes('...override')) continue

    // Skip if already has the type assertion
    if (line.includes(` as ${config.typeName}`)) continue

    // Add the type assertion before the closing parenthesis at the end
    lines[i] = line.replace(/\)\s*$/, `) as ${config.typeName}`)
    fixCount++
  }

  if (fixCount > 0) {
    const patchedFactory = lines.join('\n')
    fs.writeFileSync(factoryPath, patchedFactory, 'utf8')
    console.log(`✔ Fixed ${fixCount} mock factories for ${config.typeName} in ${config.factoryFile}`)
    totalFixed += fixCount
  } else {
    console.log(`⊙ No fixes needed for ${config.typeName} in ${config.factoryFile}`)
  }
}

if (totalFixed > 0) {
  console.log(`\n✨ Total: Fixed ${totalFixed} mock factory type assertions`)
}
